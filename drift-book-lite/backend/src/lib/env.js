require("dotenv").config();
const path = require("path");

function required(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requiredList(name, fallback) {
  return required(name, fallback)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const backendRoot = path.resolve(__dirname, "..", "..");
const projectRoot = path.resolve(backendRoot, "..");
module.exports = {
  backendRoot,
  projectRoot,
  port: Number(process.env.PORT || 8080),
  jwtSecret: required("JWT_SECRET", "change-this-secret"),
  adminUsernames: requiredList("ADMIN_USERNAMES", "admin1,admin2,admin3"),
  adminPassword: required("ADMIN_PASSWORD", "change-this-password"),
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:5174",
  defaultSiteAssetsDir:
    process.env.DEFAULT_SITE_ASSETS_DIR ||
    path.resolve(projectRoot, "resources", "default-site-assets"),
  studentRosterPath:
    process.env.STUDENT_ROSTER_PATH || path.resolve(projectRoot, "..", "2025学年学生信息.xls"),
  uploadsDir: process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.resolve(projectRoot, "uploads"),
};
