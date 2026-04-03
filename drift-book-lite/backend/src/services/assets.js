const fs = require("fs");
const path = require("path");
const { prisma } = require("../lib/prisma");
const { materialsDir, uploadsDir } = require("../lib/env");
const { ensureDir, normalizePublicPath } = require("../utils/paths");
const { HttpError } = require("../utils/httpError");

const defaultProcessContent = [
  {
    id: "step-1",
    title: "扫码进入活动",
    description: "使用学校平板扫描统一二维码，进入“一本书的漂流”首页。",
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

async function bootstrapFromMaterials() {
  if (!fs.existsSync(materialsDir)) {
    throw new Error(`Materials directory not found: ${materialsDir}`);
  }

  const current = await getSiteAsset();

  const files = fs
    .readdirSync(materialsDir)
    .filter((name) => !name.startsWith("."))
    .sort();

  const logoFile = files.find((name) => name.toLowerCase() === "logo.jpg");
  const imageFiles = files.filter((name) => name !== logoFile);

  let schoolLogoPath = null;
  if (logoFile) {
    schoolLogoPath = copyIntoUploads(
      path.join(materialsDir, logoFile),
      "site-assets",
      `school-logo${path.extname(logoFile)}`
    );
  }

  const carouselImages = imageFiles.map((file, index) => {
    const storedPath = copyIntoUploads(
      path.join(materialsDir, file),
      "site-assets",
      `campus-${String(index + 1).padStart(2, "0")}${path.extname(file)}`
    );
    return {
      id: `slide-${index + 1}`,
      path: storedPath,
      enabled: true,
      sortOrder: index,
      label: `校园轮播 ${index + 1}`,
    };
  });

  await updateSiteAsset({
    schoolLogoPath,
    carouselImages,
    processContent: current.processContent,
  });

  return getSiteAsset();
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

module.exports = {
  defaultProcessContent,
  getSiteAsset,
  updateSiteAsset,
  bootstrapFromMaterials,
  uploadLogoAsset,
  uploadCarouselAsset,
};
