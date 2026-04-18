const fs = require("fs");
const path = require("path");

const backendRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(backendRoot, "..");
const workspaceRoot = path.resolve(projectRoot, "..");

function readWorkspaceFile(...segments) {
  return fs.readFileSync(path.join(workspaceRoot, ...segments), "utf8");
}

describe("deployment configuration", () => {
  test("env templates let cors follow configured frontend addresses", () => {
    const rootEnv = readWorkspaceFile(".env.example");
    const backendEnv = readWorkspaceFile("drift-book-lite", "backend", ".env.example");

    expect(rootEnv).toContain("APP_BASE_URL=http://localhost:5174");
    expect(rootEnv).toContain("ADMIN_APP_BASE_URL=http://localhost:5175");
    expect(rootEnv).not.toContain("ALLOWED_ORIGINS=");

    expect(backendEnv).toContain('APP_BASE_URL="http://localhost:5174"');
    expect(backendEnv).toContain('ADMIN_APP_BASE_URL="http://localhost:5175"');
    expect(backendEnv).toContain('TEACHER_ROSTER_PATH=""');
    expect(backendEnv).not.toContain("ALLOWED_ORIGINS=");
  });

  test("keeps legacy review schema fields for safe db push upgrades", () => {
    const schema = readWorkspaceFile("drift-book-lite", "backend", "prisma", "schema.prisma");

    expect(schema).toMatch(/enum ReviewStatus \{[\s\S]*rejected[\s\S]*\}/);
    expect(schema).toMatch(/rejectionReason\s+String\?/);
  });


});
