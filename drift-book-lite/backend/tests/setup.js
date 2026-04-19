const fs = require("fs");
const path = require("path");

const testDatabasePath = path.resolve(__dirname, "..", "prisma", "test.db");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || `file:${testDatabasePath}`;
process.env.UPLOADS_DIR =
  process.env.UPLOADS_DIR || path.resolve(__dirname, "..", ".test-uploads");
process.env.DEFAULT_BOOK_CATALOG_PATH =
  process.env.DEFAULT_BOOK_CATALOG_PATH ||
  path.resolve(__dirname, "fixtures", "missing-default-book-catalog.xlsx");
process.env.DEFAULT_STUDENT_ROSTER_PATH =
  process.env.DEFAULT_STUDENT_ROSTER_PATH ||
  path.resolve(__dirname, "fixtures", "missing-default-student-roster.xls");
process.env.DEFAULT_SENSITIVE_WORDS_DIR =
  process.env.DEFAULT_SENSITIVE_WORDS_DIR ||
  path.resolve(__dirname, "fixtures", "missing-default-sensitive-words");
process.env.STUDENT_ROSTER_PATH =
  process.env.STUDENT_ROSTER_PATH ||
  process.env.DEFAULT_STUDENT_ROSTER_PATH;

fs.rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
fs.mkdirSync(process.env.UPLOADS_DIR, { recursive: true });
