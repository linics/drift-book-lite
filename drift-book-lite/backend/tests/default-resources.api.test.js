const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const XLSX = require("xlsx");
const { prisma } = require("../src/lib/prisma");

const APP_MODULES = [
  "../src/lib/env",
  "../src/services/library",
  "../src/services/studentRoster",
  "../src/services/defaultSensitiveWords",
  "../src/services/defaultResources",
  "../src/services/bootstrap",
  "../src/routes/admin",
  "../src/routes/public",
  "../src/app",
];

function purgeAppModules() {
  for (const modulePath of APP_MODULES) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch (_error) {
      // Module may not exist before this feature is implemented.
    }
  }
}

async function clearTableIfExists(tableName) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    tableName
  );
  if (!rows.length) return;
  await prisma.$executeRawUnsafe(`DELETE FROM "${tableName}"`);
}

async function clearData() {
  const tables = [
    "SensitiveWord",
    "BookReview",
    "StudentRoster",
    "TeacherRoster",
    "Book",
    "ImportBatch",
    "SiteAsset",
    "AdminUser",
  ];

  for (const table of tables) {
    await clearTableIfExists(table);
  }
}

function writeWorkbook(filePath, rows) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, filePath);
}

function makeResourceFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "default-resources-"));
  const bookCatalogPath = path.join(dir, "图书馆7楼流通室数据.xlsx");
  const studentRosterPath = path.join(dir, "2025学年学生信息.xls");
  const sensitiveWordsDir = path.join(dir, "default-sensitive-words");
  fs.mkdirSync(sensitiveWordsDir);

  writeWorkbook(bookCatalogPath, [
    {
      控制号: "default-book-1",
      书名: "默认七楼图书",
      作者: "作者甲",
      出版社: "出版社甲",
      复本数: 2,
    },
  ]);
  writeWorkbook(studentRosterPath, [
    {
      系统号: "320250001",
      姓名: "默认学生",
      所在班级: "高一(01)班",
      身份证号: "1234567890123456",
    },
  ]);
  fs.writeFileSync(path.join(sensitiveWordsDir, "01-默认词库.txt"), "加微信\n私聊\n", "utf8");

  return { dir, bookCatalogPath, studentRosterPath, sensitiveWordsDir };
}

async function createAppWithDefaults(fixture) {
  process.env.DEFAULT_BOOK_CATALOG_PATH = fixture.bookCatalogPath;
  process.env.DEFAULT_STUDENT_ROSTER_PATH = fixture.studentRosterPath;
  delete process.env.STUDENT_ROSTER_PATH;
  process.env.DEFAULT_SENSITIVE_WORDS_DIR = fixture.sensitiveWordsDir;
  purgeAppModules();
  return require("../src/app").createApp();
}

async function loginAsAdmin(app) {
  const response = await request(app).post("/api/admin/login").send({
    username: "admin1",
    password: "change-this-password",
  });
  expect(response.status).toBe(200);
  return response.body.token;
}

describe("default resources", () => {
  const originalEnv = {
    DEFAULT_BOOK_CATALOG_PATH: process.env.DEFAULT_BOOK_CATALOG_PATH,
    DEFAULT_STUDENT_ROSTER_PATH: process.env.DEFAULT_STUDENT_ROSTER_PATH,
    STUDENT_ROSTER_PATH: process.env.STUDENT_ROSTER_PATH,
    DEFAULT_SENSITIVE_WORDS_DIR: process.env.DEFAULT_SENSITIVE_WORDS_DIR,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    purgeAppModules();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("bootstraps default books, student roster, and sensitive words only when tables are empty", async () => {
    await clearData();
    const fixture = makeResourceFixture();

    try {
      await createAppWithDefaults(fixture);

      await expect(prisma.book.count()).resolves.toBe(1);
      await expect(prisma.importBatch.count()).resolves.toBe(1);
      await expect(prisma.studentRoster.count()).resolves.toBe(1);
      await expect(prisma.sensitiveWord.count()).resolves.toBe(2);

      writeWorkbook(fixture.bookCatalogPath, [
        {
          控制号: "default-book-2",
          书名: "重启后不应导入",
          作者: "作者乙",
          出版社: "出版社乙",
          复本数: 1,
        },
      ]);
      writeWorkbook(fixture.studentRosterPath, [
        {
          系统号: "320250999",
          姓名: "重启后不应导入",
          所在班级: "高一(09)班",
        },
      ]);
      fs.writeFileSync(path.join(fixture.sensitiveWordsDir, "01-默认词库.txt"), "新增敏感词\n", "utf8");

      await createAppWithDefaults(fixture);

      await expect(prisma.book.count()).resolves.toBe(1);
      await expect(prisma.studentRoster.count()).resolves.toBe(1);
      await expect(prisma.sensitiveWord.count()).resolves.toBe(2);
      await expect(prisma.book.findUnique({ where: { bookId: "default-book-1" } })).resolves.not.toBeNull();
      await expect(prisma.studentRoster.findUnique({ where: { systemId: "320250001" } })).resolves.not.toBeNull();
      await expect(prisma.sensitiveWord.findUnique({ where: { normalizedWord: "新增敏感词" } })).resolves.toBeNull();
    } finally {
      fs.rmSync(fixture.dir, { recursive: true, force: true });
    }
  });

  test("returns default resource paths and counts", async () => {
    await clearData();
    const fixture = makeResourceFixture();

    try {
      const app = await createAppWithDefaults(fixture);
      const token = await loginAsAdmin(app);

      const response = await request(app)
        .get("/api/admin/default-resources")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.resources).toEqual(
        expect.objectContaining({
          bookCatalog: expect.objectContaining({
            path: fixture.bookCatalogPath,
            exists: true,
            bookCount: 1,
          }),
          studentRoster: expect.objectContaining({
            path: fixture.studentRosterPath,
            exists: true,
            studentCount: 1,
          }),
          sensitiveWords: expect.objectContaining({
            path: fixture.sensitiveWordsDir,
            exists: true,
            wordCount: 2,
          }),
          siteAssets: expect.objectContaining({
            path: expect.any(String),
            exists: expect.any(Boolean),
          }),
        })
      );
    } finally {
      fs.rmSync(fixture.dir, { recursive: true, force: true });
    }
  });

  test("imports default catalog and student roster from admin shortcut endpoints", async () => {
    await clearData();
    const fixture = makeResourceFixture();

    try {
      const app = await createAppWithDefaults(fixture);
      const token = await loginAsAdmin(app);

      writeWorkbook(fixture.bookCatalogPath, [
        {
          控制号: "default-book-1",
          书名: "默认七楼图书更新",
          作者: "作者甲",
          出版社: "出版社甲",
          复本数: 3,
        },
      ]);
      writeWorkbook(fixture.studentRosterPath, [
        {
          系统号: "320250001",
          姓名: "默认学生更新",
          所在班级: "高一(02)班",
        },
      ]);

      const catalogResponse = await request(app)
        .post("/api/admin/imports/default-catalog")
        .set("Authorization", `Bearer ${token}`);
      expect(catalogResponse.status).toBe(201);
      expect(catalogResponse.body.batch).toEqual(
        expect.objectContaining({
          catalogName: "图书馆7楼流通室数据",
          importMode: "upsert",
          successRows: 1,
        })
      );

      const rosterResponse = await request(app)
        .post("/api/admin/student-roster/import-default")
        .set("Authorization", `Bearer ${token}`);
      expect(rosterResponse.status).toBe(200);
      expect(rosterResponse.body).toEqual(
        expect.objectContaining({
          totalRows: 1,
          successRows: 1,
          failedRows: 0,
          defaultStudentRosterPath: fixture.studentRosterPath,
        })
      );

      await expect(prisma.book.findUnique({ where: { bookId: "default-book-1" } })).resolves.toEqual(
        expect.objectContaining({ title: "默认七楼图书更新", totalCopies: 3 })
      );
      await expect(prisma.studentRoster.findUnique({ where: { systemId: "320250001" } })).resolves.toEqual(
        expect.objectContaining({ studentName: "默认学生更新", className: "高一(02)班" })
      );
    } finally {
      fs.rmSync(fixture.dir, { recursive: true, force: true });
    }
  });
});
