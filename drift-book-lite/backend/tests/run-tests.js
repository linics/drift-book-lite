const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const backendRoot = path.resolve(__dirname, "..");
const testUploadsDir = path.join(backendRoot, ".test-uploads");
const testDatabasePath = path.join(backendRoot, "prisma", "test.db");

fs.rmSync(testUploadsDir, { recursive: true, force: true });
fs.rmSync(testDatabasePath, { force: true });
fs.rmSync(`${testDatabasePath}-journal`, { force: true });
fs.closeSync(fs.openSync(testDatabasePath, "w"));

const env = {
  ...process.env,
  DATABASE_URL: `file:${testDatabasePath}`,
  UPLOADS_DIR: testUploadsDir,
  ADMIN_PASSWORD: "jyzx2026",
};

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: backendRoot,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run("npx", ["prisma", "db", "push", "--accept-data-loss"]);
run("npx", ["vitest", "run"]);
