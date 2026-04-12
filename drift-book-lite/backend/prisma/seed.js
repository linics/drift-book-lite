require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { defaultProcessContent, syncDefaultSiteAssets } = require("../src/services/assets");
const { loadStudentRosterRows } = require("../src/services/studentRoster");

const prisma = new PrismaClient();

async function main() {
  const usernames = (process.env.ADMIN_USERNAMES || "admin1,admin2,admin3")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const password = process.env.ADMIN_PASSWORD || "change-this-password";
  const passwordHash = await bcrypt.hash(password, 10);

  for (const username of usernames) {
    await prisma.adminUser.upsert({
      where: { username },
      update: { passwordHash },
      create: { username, passwordHash },
    });
  }

  await prisma.siteAsset.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, carouselImages: [], processContent: defaultProcessContent },
  });
  await syncDefaultSiteAssets({ mode: "fill-missing" });

  if ((await prisma.studentRoster.count()) === 0) {
    await prisma.studentRoster.createMany({
      data: loadStudentRosterRows(),
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
