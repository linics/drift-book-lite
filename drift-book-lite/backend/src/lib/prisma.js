const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function initPragmas() {
  await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;").catch((e) =>
    console.warn("PRAGMA journal_mode=WAL failed:", e.message)
  );
  await prisma.$queryRawUnsafe("PRAGMA synchronous=NORMAL;").catch((e) =>
    console.warn("PRAGMA synchronous=NORMAL failed:", e.message)
  );
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000;").catch((e) =>
    console.warn("PRAGMA busy_timeout=5000 failed:", e.message)
  );
}

module.exports = { prisma, initPragmas };
