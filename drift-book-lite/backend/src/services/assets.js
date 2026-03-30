const fs = require("fs");
const path = require("path");
const { prisma } = require("../lib/prisma");
const { materialsDir, uploadsDir } = require("../lib/env");
const { ensureDir, normalizePublicPath } = require("../utils/paths");

function sanitizeCarouselEntry(entry, index) {
  return {
    id: entry.id || `slide-${index + 1}`,
    path: entry.path,
    enabled: entry.enabled !== false,
    sortOrder: typeof entry.sortOrder === "number" ? entry.sortOrder : index,
    label: entry.label || `校园轮播 ${index + 1}`,
  };
}

async function getSiteAsset() {
  const asset = await prisma.siteAsset.findUnique({ where: { id: 1 } });
  return {
    id: asset.id,
    schoolLogoPath: asset.schoolLogoPath,
    carouselImages: Array.isArray(asset.carouselImages)
      ? asset.carouselImages.map(sanitizeCarouselEntry)
      : [],
  };
}

async function updateSiteAsset({ schoolLogoPath, carouselImages }) {
  return prisma.siteAsset.update({
    where: { id: 1 },
    data: {
      schoolLogoPath,
      carouselImages: carouselImages.map(sanitizeCarouselEntry),
    },
  });
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

  await updateSiteAsset({ schoolLogoPath, carouselImages });
  return getSiteAsset();
}

module.exports = { getSiteAsset, updateSiteAsset, bootstrapFromMaterials };
