const multer = require("multer");
const path = require("path");
const { uploadsDir } = require("../lib/env");
const { ensureDir } = require("../utils/paths");
const { HttpError } = require("../utils/httpError");

ensureDir(path.join(uploadsDir, "covers"));
ensureDir(path.join(uploadsDir, "site-assets"));

const imageStorage = multer.diskStorage({
  destination(_req, _file, callback) {
    callback(null, path.join(uploadsDir, "covers"));
  },
  filename(_req, file, callback) {
    const ext = path.extname(file.originalname) || ".jpg";
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const siteAssetStorage = multer.diskStorage({
  destination(_req, _file, callback) {
    callback(null, path.join(uploadsDir, "site-assets"));
  },
  filename(_req, file, callback) {
    const ext = path.extname(file.originalname) || ".jpg";
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

function imageFileFilter(_req, file, callback) {
  if (!file.mimetype.startsWith("image/")) {
    callback(new HttpError(400, "只能上传图片文件"));
    return;
  }
  callback(null, true);
}

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
});
const uploadSiteAsset = multer({
  storage: siteAssetStorage,
  fileFilter: imageFileFilter,
});
const uploadMemory = multer({ storage: multer.memoryStorage() });

module.exports = { uploadImage, uploadMemory, uploadSiteAsset };
