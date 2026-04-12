require("dotenv").config();
const path = require("path");

const INSECURE_DEFAULTS = new Set(["change-this-secret", "change-this-password"]);
const IS_PROD = process.env.NODE_ENV === "production";

function required(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  if (IS_PROD && INSECURE_DEFAULTS.has(value)) {
    throw new Error(`[SECURITY] ${name} is using an insecure default value. Set a strong value before running in production.`);
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
  adminAppBaseUrl: process.env.ADMIN_APP_BASE_URL || "http://localhost:5175",
  defaultSiteAssetsDir:
    process.env.DEFAULT_SITE_ASSETS_DIR ||
    path.resolve(projectRoot, "resources", "default-site-assets"),
  defaultSensitiveWordsDir:
    process.env.DEFAULT_SENSITIVE_WORDS_DIR ||
    path.resolve(projectRoot, "resources", "default-sensitive-words"),
  studentRosterPath:
    process.env.STUDENT_ROSTER_PATH ||
    path.resolve(projectRoot, "..", "2025学年学生信息.xls"),
  uploadsDir: process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.resolve(projectRoot, "uploads"),
};
