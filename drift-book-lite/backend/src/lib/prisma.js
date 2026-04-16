const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Enable WAL mode for better read/write concurrency under load
prisma.$executeRawUnsafe("PRAGMA journal_mode=WAL;").catch(() => {});
prisma.$executeRawUnsafe("PRAGMA synchronous=NORMAL;").catch(() => {});
prisma.$executeRawUnsafe("PRAGMA busy_timeout=5000;").catch(() => {});

module.exports = { prisma };
