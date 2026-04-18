const bcrypt = require("bcryptjs");
const { prisma } = require("../lib/prisma");
const { adminUsernames, adminPassword } = require("../lib/env");
const { defaultProcessContent, syncDefaultSiteAssets } = require("./assets");
const { seedStudentRosterIfEmpty } = require("./studentRoster");
const { ensureTeacherRoster } = require("./teacherRoster");

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
  const existingSiteAsset = await prisma.siteAsset.findUnique({
    where: { id: 1 },
    select: { id: true },
  });

  if (existingSiteAsset) {
    return { created: false };
  }

  await prisma.siteAsset.create({
    data: {
      id: 1,
      schoolLogoPath: null,
      carouselImages: [],
      processContent: defaultProcessContent,
    },
  });

  return { created: true };
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
  const siteAsset = await ensureSiteAsset();
  await syncDefaultSiteAssets({
    mode: "fill-missing",
    fillEmptyCarousel: siteAsset.created,
  });
  await seedStudentRosterIfEmpty();
  await ensureTeacherRoster();
  await migrateLegacyReviews();
}

module.exports = { bootstrapSystem };
