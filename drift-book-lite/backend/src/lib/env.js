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
const workspaceRoot = path.resolve(projectRoot, "..");

module.exports = {
  backendRoot,
  projectRoot,
  workspaceRoot,
  port: Number(process.env.PORT || 8080),
  jwtSecret: required("JWT_SECRET", "change-this-secret"),
  adminUsernames: requiredList("ADMIN_USERNAMES", "admin1,admin2,admin3"),
  adminPassword: required("ADMIN_PASSWORD", "change-this-password"),
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:5174",
  materialsDir:
    process.env.MATERIALS_DIR || path.resolve(workspaceRoot, "materials"),
  studentRosterPath:
    process.env.STUDENT_ROSTER_PATH ||
    path.resolve(workspaceRoot, "2025学年学生信息.xls"),
  uploadsDir: path.resolve(projectRoot, "uploads"),
};
