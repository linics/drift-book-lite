const fs = require("fs");
const path = require("path");

const testDatabasePath = path.resolve(__dirname, "..", "prisma", "test.db");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || `file:${testDatabasePath}`;
process.env.UPLOADS_DIR =
  process.env.UPLOADS_DIR || path.resolve(__dirname, "..", ".test-uploads");

fs.rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
fs.mkdirSync(process.env.UPLOADS_DIR, { recursive: true });
