const fs = require("fs");
const path = require("path");
const { prisma } = require("../lib/prisma");
const { defaultSiteAssetsDir, uploadsDir } = require("../lib/env");
const { ensureDir, normalizePublicPath } = require("../utils/paths");
const { HttpError } = require("../utils/httpError");

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".avif",
  ".bmp",
  ".svg",
]);

const defaultProcessContent = [
  {
    id: "step-1",
    title: "扫码进入活动",
    description: "使用学校平板扫描统一二维码，进入“一本书的旅行”首页。",
  },
  {
    id: "step-2",
    title: "搜索目标图书",
    description: "在首页搜索栏输入书名关键词，查找你想阅读或评价的图书。",
  },
  {
    id: "step-3",
    title: "查看图书详情",
    description: "进入图书详情页，查看书名、作者、出版社和馆藏信息。",
  },
  {
    id: "step-4",
    title: "提交阅读评语",
    description: "填写姓名或昵称并提交评语，等待管理员审核后公开展示。",
  },
];

const siteAssetsUploadsDir = path.resolve(uploadsDir, "site-assets");

function sanitizeCarouselEntry(entry, index) {
  if (!entry?.path || typeof entry.path !== "string") {
    throw new HttpError(400, "轮播图缺少有效路径");
  }

  return {
    id: entry.id || `slide-${index + 1}`,
    path: entry.path,
    enabled: entry.enabled !== false,
    sortOrder: typeof entry.sortOrder === "number" ? entry.sortOrder : index,
    label: entry.label || `校园轮播 ${index + 1}`,
  };
}

function sanitizeProcessEntry(entry, index) {
  return {
    id: entry.id || `step-${index + 1}`,
    title: entry.title || `步骤 ${index + 1}`,
    description: entry.description || "",
  };
}

function normalizeCarouselImages(entries) {
  if (!Array.isArray(entries)) {
    throw new HttpError(400, "轮播图数据格式不合法");
  }

  return [...entries]
    .map((entry, index) => sanitizeCarouselEntry(entry, index))
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((entry, index) => ({
      ...entry,
      sortOrder: index,
    }));
}

function normalizeProcessContent(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new HttpError(400, "流程说明不能为空");
  }

  return entries.map((entry, index) => sanitizeProcessEntry(entry, index));
}

function serializeSiteAsset(asset) {
  return {
    id: asset.id,
    schoolLogoPath: asset.schoolLogoPath,
    carouselImages: Array.isArray(asset.carouselImages)
      ? normalizeCarouselImages(asset.carouselImages)
      : [],
    processContent: Array.isArray(asset.processContent)
      ? normalizeProcessContent(asset.processContent)
      : defaultProcessContent,
  };
}

async function getSiteAsset() {
  const asset = await prisma.siteAsset.findUnique({ where: { id: 1 } });
  return serializeSiteAsset(asset);
}

async function updateSiteAsset({ schoolLogoPath, carouselImages, processContent }) {
  const current = await getSiteAsset();
  const updated = await prisma.siteAsset.update({
    where: { id: 1 },
    data: {
      schoolLogoPath:
        schoolLogoPath === undefined ? current.schoolLogoPath : schoolLogoPath,
      carouselImages:
        carouselImages === undefined
          ? current.carouselImages
          : normalizeCarouselImages(carouselImages),
      processContent:
        processContent === undefined
          ? current.processContent
          : normalizeProcessContent(processContent),
    },
  });

  return serializeSiteAsset(updated);
}

function copyIntoUploads(sourcePath, subdir, filename) {
  ensureDir(path.join(uploadsDir, subdir));
  const destination = path.join(uploadsDir, subdir, filename);
  fs.copyFileSync(sourcePath, destination);
  return normalizePublicPath(destination);
}

function resolveSiteAssetUploadPath(publicPath) {
  if (typeof publicPath !== "string" || !publicPath.startsWith("/uploads/")) {
    return null;
  }

  const relativePath = publicPath.slice("/uploads/".length);
  const absolutePath = path.resolve(uploadsDir, relativePath);

  if (
    absolutePath !== siteAssetsUploadsDir &&
    !absolutePath.startsWith(`${siteAssetsUploadsDir}${path.sep}`)
  ) {
    return null;
  }

  return absolutePath;
}

function deleteFileIfUnused(publicPath, assets) {
  const absolutePath = resolveSiteAssetUploadPath(publicPath);
  if (!absolutePath) {
    return;
  }

  if (assets.schoolLogoPath === publicPath) {
    return;
  }

  const stillReferenced = assets.carouselImages.some((image) => image.path === publicPath);
  if (stillReferenced) {
    return;
  }

  fs.rmSync(absolutePath, { force: true });
}

function isSupportedImageFile(filename) {
  return IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

function isLogoFilename(filename) {
  return /^logo\.[a-z0-9]+$/i.test(filename);
}

function loadDefaultSiteAssetFiles({ requireDirectory = false } = {}) {
  if (!fs.existsSync(defaultSiteAssetsDir)) {
    if (requireDirectory) {
      throw new HttpError(404, `默认站点图片目录不存在：${defaultSiteAssetsDir}`);
    }
    return {
      logoFile: null,
      carouselFiles: [],
    };
  }

  const files = fs
    .readdirSync(defaultSiteAssetsDir)
    .filter((name) => !name.startsWith("."))
    .filter((name) => isSupportedImageFile(name));

  const logoFilename = files.find((name) => isLogoFilename(name)) || null;
  const carouselFiles = files
    .filter((name) => !isLogoFilename(name))
    .sort((left, right) => left.localeCompare(right, "zh-CN"))
    .map((name) => ({
      name,
      sourcePath: path.join(defaultSiteAssetsDir, name),
    }));

  return {
    logoFile: logoFilename
      ? {
          name: logoFilename,
          sourcePath: path.join(defaultSiteAssetsDir, logoFilename),
        }
      : null,
    carouselFiles,
  };
}

function buildDefaultCarouselImages(carouselFiles) {
  return carouselFiles.map((file, index) => {
    const storedPath = copyIntoUploads(
      file.sourcePath,
      "site-assets",
      `campus-${String(index + 1).padStart(2, "0")}${path.extname(file.name).toLowerCase()}`
    );

    return {
      id: `slide-${index + 1}`,
      path: storedPath,
      enabled: true,
      sortOrder: index,
      label: `校园轮播 ${index + 1}`,
    };
  });
}

async function syncDefaultSiteAssets({ mode = "fill-missing", fillEmptyCarousel = false } = {}) {
  if (!["fill-missing", "replace-homepage-images"].includes(mode)) {
    throw new HttpError(400, "默认站点图片同步模式不合法");
  }

  const current = await getSiteAsset();
  const { logoFile, carouselFiles } = loadDefaultSiteAssetFiles({
    requireDirectory: mode === "replace-homepage-images",
  });

  let schoolLogoPath = current.schoolLogoPath;
  let carouselImages = current.carouselImages;

  if (mode === "fill-missing") {
    if (!current.schoolLogoPath && logoFile) {
      schoolLogoPath = copyIntoUploads(
        logoFile.sourcePath,
        "site-assets",
        `school-logo${path.extname(logoFile.name).toLowerCase()}`
      );
    }

    if (
      fillEmptyCarousel &&
      (!Array.isArray(current.carouselImages) || current.carouselImages.length === 0) &&
      carouselFiles.length
    ) {
      carouselImages = buildDefaultCarouselImages(carouselFiles);
    }
  }

  if (mode === "replace-homepage-images") {
    if (!logoFile) {
      throw new HttpError(400, "默认站点图片目录中缺少 logo 文件");
    }
    if (!carouselFiles.length) {
      throw new HttpError(400, "默认站点图片目录中缺少轮播图片");
    }

    schoolLogoPath = copyIntoUploads(
      logoFile.sourcePath,
      "site-assets",
      `school-logo${path.extname(logoFile.name).toLowerCase()}`
    );
    carouselImages = buildDefaultCarouselImages(carouselFiles);
  }

  if (
    schoolLogoPath === current.schoolLogoPath &&
    JSON.stringify(carouselImages) === JSON.stringify(current.carouselImages)
  ) {
    return current;
  }

  return updateSiteAsset({
    schoolLogoPath,
    carouselImages,
    processContent: current.processContent,
  });
}

async function uploadLogoAsset(file) {
  if (!file?.path) {
    throw new HttpError(400, "缺少 Logo 图片文件");
  }

  return updateSiteAsset({
    schoolLogoPath: normalizePublicPath(file.path),
  });
}

async function uploadCarouselAsset(file, label) {
  if (!file?.path) {
    throw new HttpError(400, "缺少轮播图片文件");
  }

  const current = await getSiteAsset();
  const carouselImages = [
    ...current.carouselImages,
    {
      id: `slide-${Date.now()}`,
      path: normalizePublicPath(file.path),
      enabled: true,
      sortOrder: current.carouselImages.length,
      label: String(label || "").trim() || `校园轮播 ${current.carouselImages.length + 1}`,
    },
  ];

  const updated = await updateSiteAsset({ carouselImages });
  return updated.carouselImages[updated.carouselImages.length - 1];
}

async function deleteCarouselAsset(assetId) {
  const current = await getSiteAsset();
  const targetAsset = current.carouselImages.find((image) => image.id === assetId);

  if (!targetAsset) {
    throw new HttpError(404, "轮播图不存在");
  }

  const updated = await updateSiteAsset({
    carouselImages: current.carouselImages.filter((image) => image.id !== assetId),
  });

  deleteFileIfUnused(targetAsset.path, updated);
  return updated;
}

module.exports = {
  defaultProcessContent,
  getSiteAsset,
  updateSiteAsset,
  loadDefaultSiteAssetFiles,
  syncDefaultSiteAssets,
  uploadLogoAsset,
  uploadCarouselAsset,
  deleteCarouselAsset,
};
