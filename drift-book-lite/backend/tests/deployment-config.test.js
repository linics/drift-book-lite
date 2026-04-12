const fs = require("fs");
const path = require("path");

const backendRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(backendRoot, "..");
const workspaceRoot = path.resolve(projectRoot, "..");

function readWorkspaceFile(...segments) {
  return fs.readFileSync(path.join(workspaceRoot, ...segments), "utf8");
}

describe("deployment configuration", () => {
  test("keeps legacy review schema fields for safe db push upgrades", () => {
    const schema = readWorkspaceFile("drift-book-lite", "backend", "prisma", "schema.prisma");

    expect(schema).toMatch(/enum ReviewStatus \{[\s\S]*rejected[\s\S]*\}/);
    expect(schema).toMatch(/rejectionReason\s+String\?/);
  });

  test("root compose exposes all bundled default resource directories", () => {
    const compose = readWorkspaceFile("docker-compose.yml");

    expect(compose).toContain("DEFAULT_SITE_ASSETS_DIR: /app/resources/default-site-assets");
    expect(compose).toContain("DEFAULT_SENSITIVE_WORDS_DIR: /app/resources/default-sensitive-words");
    expect(compose).toContain(
      "STUDENT_ROSTER_PATH: /app/resources/student-roster/2025学年学生信息.xls"
    );
    expect(compose).toContain(
      "./drift-book-lite/resources/default-site-assets:/app/resources/default-site-assets:ro"
    );
    expect(compose).toContain(
      "./drift-book-lite/resources/default-sensitive-words:/app/resources/default-sensitive-words:ro"
    );
    expect(compose).toContain(
      "./2025学年学生信息.xls:/app/resources/student-roster/2025学年学生信息.xls:ro"
    );
  });

  test("nested compose exposes bundled resources from the project directory", () => {
    const compose = readWorkspaceFile("drift-book-lite", "docker-compose.yml");

    expect(compose).toContain("DEFAULT_SITE_ASSETS_DIR: /app/resources/default-site-assets");
    expect(compose).toContain("DEFAULT_SENSITIVE_WORDS_DIR: /app/resources/default-sensitive-words");
    expect(compose).toContain(
      "STUDENT_ROSTER_PATH: /app/resources/student-roster/2025学年学生信息.xls"
    );
    expect(compose).toContain("./resources/default-site-assets:/app/resources/default-site-assets:ro");
    expect(compose).toContain(
      "./resources/default-sensitive-words:/app/resources/default-sensitive-words:ro"
    );
    expect(compose).toContain(
      "../2025学年学生信息.xls:/app/resources/student-roster/2025学年学生信息.xls:ro"
    );
  });

  test("nested compose builds frontends with an explicit backend api url", () => {
    const compose = readWorkspaceFile("drift-book-lite", "docker-compose.yml");

    expect(compose).toContain(
      "VITE_API_BASE_URL: ${FRONTEND_API_BASE_URL:-http://localhost:8080/api}"
    );
    expect(compose).toContain(
      "VITE_API_BASE_URL: ${ADMIN_FRONTEND_API_BASE_URL:-http://localhost:8080/api}"
    );
  });
});
