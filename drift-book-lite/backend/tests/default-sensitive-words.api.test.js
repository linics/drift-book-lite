const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const { prisma } = require("../src/lib/prisma");

const APP_MODULES = [
  "../src/lib/env",
  "../src/services/library",
  "../src/services/defaultSensitiveWords",
  "../src/services/bootstrap",
  "../src/routes/admin",
  "../src/routes/public",
  "../src/app",
];

const studentIdentity = {
  systemId: "320250002",
  studentName: "王沁愉",
  idCardSuffix: "3225",
  className: "高一(01)班",
};
const bundledDefaultSensitiveWordsDir = path.resolve(
  __dirname,
  "..",
  "..",
  "resources",
  "default-sensitive-words"
);

function purgeAppModules() {
  for (const modulePath of APP_MODULES) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch (_error) {
      // Ignore modules that do not exist before the feature is implemented.
    }
  }
}

async function createAppWithDefaultSensitiveWordsDir(defaultSensitiveWordsDir) {
  process.env.DEFAULT_SENSITIVE_WORDS_DIR = defaultSensitiveWordsDir;
  purgeAppModules();
  return require("../src/app").createApp();
}

function writeFixtureFile(dir, filename, content) {
  fs.writeFileSync(path.join(dir, filename), content, "utf8");
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
    "StudentRoster",
    "BookReview",
    "Book",
    "ImportBatch",
    "SiteAsset",
    "AdminUser",
  ];

  for (const table of tables) {
    await clearTableIfExists(table);
  }
}

async function loginAs(app, username = "admin1", password = "change-this-password") {
  const response = await request(app).post("/api/admin/login").send({
    username,
    password,
  });
  expect(response.status).toBe(200);
  return response.body.token;
}

async function importSingleBook(app, adminToken, title = "测试图书") {
  const response = await request(app)
    .post("/api/admin/imports")
    .set("Authorization", `Bearer ${adminToken}`)
    .field("catalogName", "敏感词默认库目录")
    .field("importMode", "create_only")
    .attach(
      "file",
      Buffer.from(
        `book_id,title,author,publisher,total_copies,available_copies\n1001,${title},作者甲,出版社甲,5,3\n`,
        "utf8"
      ),
      "catalog.csv"
    );

  expect(response.status).toBe(201);

  const searchResponse = await request(app).get("/api/books/search").query({ q: title });
  expect(searchResponse.status).toBe(200);
  expect(searchResponse.body.books).toHaveLength(1);
  return searchResponse.body.books[0];
}

describe("default sensitive words import", () => {
  afterEach(() => {
    delete process.env.DEFAULT_SENSITIVE_WORDS_DIR;
    purgeAppModules();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("imports default sensitive words once and skips existing custom entries", async () => {
    await clearData();

    const defaultSensitiveWordsDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "default-sensitive-words-")
    );

    try {
      writeFixtureFile(defaultSensitiveWordsDir, "01-广告类型.txt", "加微信\n私聊\n加微信\n");
      writeFixtureFile(defaultSensitiveWordsDir, "02-色情词库.txt", "成人色情网\n色情网\n");
      writeFixtureFile(defaultSensitiveWordsDir, "03-涉枪涉爆.txt", "出售炸药配方\n枪支\n");
      writeFixtureFile(defaultSensitiveWordsDir, "04-非法网址.txt", "机场推荐\n翻墙\n");
      writeFixtureFile(defaultSensitiveWordsDir, "README.md", "# ignored\n");

      const app = await createAppWithDefaultSensitiveWordsDir(defaultSensitiveWordsDir);
      const adminToken = await loginAs(app);

      const customWordResponse = await request(app)
        .post("/api/admin/sensitive-words")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ word: "私聊" });
      expect(customWordResponse.status).toBe(201);

      const importResponse = await request(app)
        .post("/api/admin/sensitive-words/import-defaults")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(importResponse.status).toBe(200);
      expect(importResponse.body).toEqual(
        expect.objectContaining({
          totalWords: 8,
          importedWords: 7,
          skippedWords: 1,
          defaultSensitiveWordsDir,
        })
      );

      const wordsResponse = await request(app)
        .get("/api/admin/sensitive-words")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(wordsResponse.status).toBe(200);
      expect(wordsResponse.body.words.map((word) => word.word)).toEqual(
        expect.arrayContaining([
          "私聊",
          "加微信",
          "成人色情网",
          "色情网",
          "出售炸药配方",
          "枪支",
          "机场推荐",
          "翻墙",
        ])
      );

      const secondImportResponse = await request(app)
        .post("/api/admin/sensitive-words/import-defaults")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(secondImportResponse.status).toBe(200);
      expect(secondImportResponse.body).toEqual(
        expect.objectContaining({
          totalWords: 8,
          importedWords: 0,
          skippedWords: 8,
        })
      );
    } finally {
      fs.rmSync(defaultSensitiveWordsDir, { recursive: true, force: true });
    }
  });

  test("matches imported default words without returning duplicate hits", async () => {
    await clearData();

    const defaultSensitiveWordsDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "default-sensitive-words-")
    );

    try {
      writeFixtureFile(defaultSensitiveWordsDir, "02-色情词库.txt", "色情网\n色情网\n成人色情网\n");

      const app = await createAppWithDefaultSensitiveWordsDir(defaultSensitiveWordsDir);
      const adminToken = await loginAs(app);
      const book = await importSingleBook(app, adminToken, "默认词库命中");

      const importResponse = await request(app)
        .post("/api/admin/sensitive-words/import-defaults")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(importResponse.status).toBe(200);

      const submitResponse = await request(app).post(`/api/books/${book.id}/reviews`).send({
        ...studentIdentity,
        content: "这里有成人色情网盘资源。",
      });
      expect(submitResponse.status).toBe(201);

      const reviewsResponse = await request(app)
        .get("/api/admin/reviews")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(reviewsResponse.status).toBe(200);
      expect(reviewsResponse.body.reviews[0]).toEqual(
        expect.objectContaining({
          sensitiveHit: true,
          matchedSensitiveWords: ["成人色情网", "色情网"],
        })
      );
    } finally {
      fs.rmSync(defaultSensitiveWordsDir, { recursive: true, force: true });
    }
  });

  test("does not flag normal political book discussion when default scope excludes politics", async () => {
    await clearData();

    const defaultSensitiveWordsDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "default-sensitive-words-")
    );

    try {
      writeFixtureFile(defaultSensitiveWordsDir, "01-广告类型.txt", "加微信\n私聊\n");
      writeFixtureFile(defaultSensitiveWordsDir, "02-色情词库.txt", "成人色情网\n");
      writeFixtureFile(defaultSensitiveWordsDir, "03-涉枪涉爆.txt", "出售炸药配方\n");
      writeFixtureFile(defaultSensitiveWordsDir, "04-非法网址.txt", "翻墙\n机场推荐\n");

      const app = await createAppWithDefaultSensitiveWordsDir(defaultSensitiveWordsDir);
      const adminToken = await loginAs(app);
      const book = await importSingleBook(app, adminToken, "共产党宣言");

      const importResponse = await request(app)
        .post("/api/admin/sensitive-words/import-defaults")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(importResponse.status).toBe(200);

      const submitResponse = await request(app).post(`/api/books/${book.id}/reviews`).send({
        ...studentIdentity,
        content: "老师推荐我们读《共产党宣言》，很有启发，适合做政治理论入门。",
      });
      expect(submitResponse.status).toBe(201);

      const reviewsResponse = await request(app)
        .get("/api/admin/reviews")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(reviewsResponse.status).toBe(200);
      expect(reviewsResponse.body.reviews[0]).toEqual(
        expect.objectContaining({
          sensitiveHit: false,
          matchedSensitiveWords: [],
        })
      );
    } finally {
      fs.rmSync(defaultSensitiveWordsDir, { recursive: true, force: true });
    }
  });

  test("bundled default snapshot includes the seven medium-expansion source files", async () => {
    await clearData();

    const app = await createAppWithDefaultSensitiveWordsDir(
      bundledDefaultSensitiveWordsDir
    );
    const adminToken = await loginAs(app);

    const importResponse = await request(app)
      .post("/api/admin/sensitive-words/import-defaults")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(importResponse.status).toBe(200);
    expect(importResponse.body.sourceFiles).toEqual([
      "01-广告类型.txt",
      "02-色情词库.txt",
      "03-涉枪涉爆.txt",
      "04-非法网址.txt",
      "05-暴恐词库.txt",
      "06-补充词库.txt",
      "07-贪腐词库.txt",
    ]);
    expect(importResponse.body.totalWords).toBeGreaterThan(16000);
  });

  test("bundled default snapshot hits all seven selected categories", async () => {
    await clearData();

    const app = await createAppWithDefaultSensitiveWordsDir(
      bundledDefaultSensitiveWordsDir
    );
    const adminToken = await loginAs(app);
    const book = await importSingleBook(app, adminToken, "七类命中");

    const importResponse = await request(app)
      .post("/api/admin/sensitive-words/import-defaults")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(importResponse.status).toBe(200);

    const samples = [
      { content: "看到兼职招聘后加微信联系。", expected: "兼职" },
      { content: "这段话出现性交描述。", expected: "性交" },
      { content: "有人出售雷管和枪支。", expected: "出售雷管" },
      { content: "请访问 001fans.com 获取内容。", expected: "001fans.com" },
      { content: "他在传播福音会内容。", expected: "福音会" },
      { content: "有人卖迷药还推广老虎机。", expected: "老虎机" },
      { content: "文章提到贪污和受贿问题。", expected: "贪污" },
    ];

    for (const sample of samples) {
      const submitResponse = await request(app).post(`/api/books/${book.id}/reviews`).send({
        ...studentIdentity,
        content: sample.content,
      });
      expect(submitResponse.status).toBe(201);
    }

    const reviewsResponse = await request(app)
      .get("/api/admin/reviews")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(reviewsResponse.status).toBe(200);

    for (const sample of samples) {
      expect(reviewsResponse.body.reviews).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            originalContent: sample.content,
            sensitiveHit: true,
            matchedSensitiveWords: expect.arrayContaining([sample.expected]),
          }),
        ])
      );
    }
  });
});
