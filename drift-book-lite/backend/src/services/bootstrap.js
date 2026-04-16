const bcrypt = require("bcryptjs");
const { prisma } = require("../lib/prisma");
const { adminUsernames, adminPassword } = require("../lib/env");
const { defaultProcessContent, syncDefaultSiteAssets } = require("./assets");
const { ensureStudentRoster } = require("./studentRoster");

async function ensureAdminUsers() {
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  for (const username of adminUsernames) {
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { username },
      select: { id: true },
    });
    if (existingAdmin) continue;

    await prisma.adminUser.create({
      data: { username, passwordHash },
    });
  }
}

async function ensureSiteAsset() {
  await prisma.siteAsset.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      schoolLogoPath: null,
      carouselImages: [],
      processContent: defaultProcessContent,
    },
  });
}

async function migrateLegacyReviews() {
  await prisma.bookReview.updateMany({
    where: { identityType: "legacy" },
    data: {
      matchedSensitiveWords: [],
    },
  });
}

async function bootstrapSystem() {
  await ensureAdminUsers();
  await ensureSiteAsset();
  await syncDefaultSiteAssets({ mode: "fill-missing" });
  await ensureStudentRoster();
  await migrateLegacyReviews();
}

module.exports = { bootstrapSystem };
