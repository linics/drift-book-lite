const bcrypt = require("bcryptjs");
const { prisma } = require("../lib/prisma");
const { adminUsername, adminPassword } = require("../lib/env");
const { defaultProcessContent } = require("./assets");

async function ensureAdminUser() {
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.adminUser.upsert({
    where: { username: adminUsername },
    update: { passwordHash },
    create: { username: adminUsername, passwordHash },
  });
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

async function bootstrapSystem() {
  await ensureAdminUser();
  await ensureSiteAsset();
}

module.exports = { bootstrapSystem };
