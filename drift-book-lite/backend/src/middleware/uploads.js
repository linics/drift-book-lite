const multer = require("multer");
const path = require("path");
const { uploadsDir } = require("../lib/env");
const { ensureDir } = require("../utils/paths");

ensureDir(path.join(uploadsDir, "covers"));

const imageStorage = multer.diskStorage({
  destination(_req, _file, callback) {
    callback(null, path.join(uploadsDir, "covers"));
  },
  filename(_req, file, callback) {
    const ext = path.extname(file.originalname) || ".jpg";
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const uploadImage = multer({ storage: imageStorage });
const uploadMemory = multer({ storage: multer.memoryStorage() });

module.exports = { uploadImage, uploadMemory };
