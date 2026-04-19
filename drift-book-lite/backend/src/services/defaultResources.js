const fs = require("fs");
const path = require("path");
const { prisma } = require("../lib/prisma");
const {
  defaultBookCatalogPath,
  defaultStudentRosterPath,
  studentRosterPath,
  defaultSensitiveWordsDir,
  defaultSiteAssetsDir,
} = require("../lib/env");
const { HttpError } = require("../utils/httpError");
const { importCatalogFromCsv } = require("./library");
const { importDefaultSensitiveWords } = require("./defaultSensitiveWords");
const { importStudentRoster } = require("./studentRoster");

const DEFAULT_CATALOG_NAME = "图书馆7楼流通室数据";

function isExistingFile(filePath) {
  return Boolean(filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile());
}

function isExistingDirectory(dirPath) {
  return Boolean(dirPath && fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory());
}

function assertDefaultFile(filePath, label) {
  if (!isExistingFile(filePath)) {
    throw new HttpError(404, `${label}不存在：${filePath}`);
  }
}

function resolveStudentDefaultPath() {
  return studentRosterPath || defaultStudentRosterPath;
}

async function importDefaultBookCatalog({ adminUserId = null } = {}) {
  assertDefaultFile(defaultBookCatalogPath, "默认图书目录");
  const buffer = fs.readFileSync(defaultBookCatalogPath);
  const batch = await importCatalogFromCsv(buffer, {
    fileName: path.basename(defaultBookCatalogPath),
    catalogName: DEFAULT_CATALOG_NAME,
    importMode: "upsert",
    adminUserId,
  });

  return batch;
}

async function seedDefaultBookCatalogIfEmpty() {
  const existingCount = await prisma.book.count();
  if (existingCount > 0 || !isExistingFile(defaultBookCatalogPath)) return null;
  return importDefaultBookCatalog();
}

async function importDefaultStudentRoster() {
  const rosterPath = resolveStudentDefaultPath();
  assertDefaultFile(rosterPath, "默认学生名册");
  const result = await importStudentRoster(
    fs.readFileSync(rosterPath),
    path.basename(rosterPath),
    { mode: "upsert" }
  );

  return {
    ...result,
    defaultStudentRosterPath: rosterPath,
  };
}

async function seedDefaultSensitiveWordsIfEmpty() {
  const existingCount = await prisma.sensitiveWord.count();
  if (existingCount > 0 || !isExistingDirectory(defaultSensitiveWordsDir)) return null;
  return importDefaultSensitiveWords();
}

async function getDefaultResources() {
  const rosterPath = resolveStudentDefaultPath();
  const [bookCount, studentCount, wordCount] = await prisma.$transaction([
    prisma.book.count(),
    prisma.studentRoster.count(),
    prisma.sensitiveWord.count(),
  ]);

  return {
    bookCatalog: {
      path: defaultBookCatalogPath,
      exists: isExistingFile(defaultBookCatalogPath),
      bookCount,
    },
    studentRoster: {
      path: rosterPath,
      defaultPath: defaultStudentRosterPath,
      overridePath: process.env.STUDENT_ROSTER_PATH || null,
      exists: isExistingFile(rosterPath),
      studentCount,
    },
    sensitiveWords: {
      path: defaultSensitiveWordsDir,
      exists: isExistingDirectory(defaultSensitiveWordsDir),
      wordCount,
    },
    siteAssets: {
      path: defaultSiteAssetsDir,
      exists: isExistingDirectory(defaultSiteAssetsDir),
    },
  };
}

module.exports = {
  DEFAULT_CATALOG_NAME,
  getDefaultResources,
  importDefaultBookCatalog,
  importDefaultStudentRoster,
  seedDefaultBookCatalogIfEmpty,
  seedDefaultSensitiveWordsIfEmpty,
};
