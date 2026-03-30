const fs = require("fs");
const path = require("path");
const { uploadsDir } = require("../lib/env");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function normalizePublicPath(filePath) {
  const relative = path.relative(uploadsDir, filePath).split(path.sep).join("/");
  return `/uploads/${relative}`;
}

module.exports = { ensureDir, normalizePublicPath };
