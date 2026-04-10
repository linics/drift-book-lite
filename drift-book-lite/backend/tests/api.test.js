const path = require("path");
const request = require("supertest");
const XLSX = require("xlsx");
const { prisma } = require("../src/lib/prisma");
const { createApp } = require("../src/app");

let app;
let adminToken;

const studentIdentity = {
  systemId: "320250002",
  studentName: "王沁愉",
  idCardSuffix: "3225",
};

const siteAssetFixtureDir = path.resolve(
  __dirname,
  "..",
  "..",
  "resources",
  "default-site-assets"
);

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

async function importCsv(csv, filename = "catalog.csv", extraFields = {}) {
  const requestBuilder = request(app)
    .post("/api/admin/imports")
    .set("Authorization", `Bearer ${adminToken}`)
    .field("catalogName", extraFields.catalogName || "馆藏目录")
    .field("importMode", extraFields.importMode || "create_only")
    .attach("file", csv, filename);

  return requestBuilder;
}

describe("drift book lite api", () => {
  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(async () => {
    await clearData();
    app = await createApp();

    const login = await request(app).post("/api/admin/login").send({
      username: "admin1",
      password: "change-this-password",
    });
    adminToken = login.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("uploads logo and carousel assets through dedicated admin endpoints", async () => {
    const logoRes = await request(app)
      .post("/api/admin/assets/logo")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", path.join(siteAssetFixtureDir, "logo.jpg"));
    expect(logoRes.status).toBe(201);

    const carouselRes = await request(app)
      .post("/api/admin/assets/carousel")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", path.join(siteAssetFixtureDir, "carousel-01.jpg"))
      .field("label", "新增轮播");
    expect(carouselRes.status).toBe(201);
    expect(carouselRes.body.asset.label).toBe("新增轮播");

    const assetsRes = await request(app)
      .get("/api/admin/assets")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(assetsRes.status).toBe(200);
    expect(assetsRes.body.carouselImages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "新增轮播",
          path: expect.stringContaining("/uploads/site-assets/"),
        }),
      ])
    );
  });

  test("imports a gb18030 catalog and exposes search plus book detail", async () => {
    const importRes = await importCsv(
      Buffer.from(
        "book_id,title,author,publish_place,publisher,publish_date,barcode,subtitle,total_copies,available_copies\n1001,共产党宣言,马克思/恩格斯,北京,人民出版社,1848,BC1001,经典著作,5,4\n",
        "utf8"
      )
    );

    expect(importRes.status).toBe(201);
    expect(importRes.body.batch.successRows).toBe(1);

    const searchRes = await request(app).get("/api/books/search").query({ q: "共产党宣" });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.books).toHaveLength(1);
    expect(searchRes.body.books[0]).toEqual(
      expect.objectContaining({
        title: "共产党宣言",
        author: "马克思",
        authors: ["马克思/恩格斯"],
        publishers: ["人民出版社"],
        publishDateTexts: ["1848"],
        barcodes: ["BC1001"],
        totalCopies: 5,
      })
    );

    const detailRes = await request(app).get(`/api/books/${searchRes.body.books[0].id}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.book.title).toBe("共产党宣言");
  });

  test("imports utf8 bom files and keeps chinese filenames readable", async () => {
    const bomCsv = Buffer.from(
      "\uFEFFbook_id,title,author,publisher,total_copies,available_copies\n1001,测试书,作者甲,出版社甲,5,3\n",
      "utf8"
    );

    const importRes = await importCsv(bomCsv, "图书信息.csv", {
      catalogName: "中文文件名目录",
    });

    expect(importRes.status).toBe(201);
    expect(importRes.body.batch.fileName).toBe("图书信息.csv");
    expect(importRes.body.batch.failedRows).toBe(0);
  });

  test("tracks failed rows with line numbers during import", async () => {
    const invalidCsv = Buffer.from(
      "book_id,title,author,publisher,total_copies,available_copies\n1001,测试书,作者甲,出版社甲,5,3\n1002,,作者乙,出版社乙,3,2\n",
      "utf8"
    );

    const importRes = await importCsv(invalidCsv, "invalid.csv");
    expect(importRes.status).toBe(201);
    expect(importRes.body.batch.successRows).toBe(1);
    expect(importRes.body.batch.failedRows).toBe(1);

    const detailRes = await request(app)
      .get(`/api/admin/imports/${importRes.body.batch.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.batch.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rowNumber: 3,
          message: expect.stringContaining("title"),
        }),
      ])
    );
  });

  test("rejects stale admin token before touching protected write APIs", async () => {
    const firstLogin = await request(app).post("/api/admin/login").send({
      username: "admin1",
      password: "change-this-password",
    });
    const staleToken = firstLogin.body.token;

    await prisma.adminUser.deleteMany();
    app = await createApp();

    const importRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${staleToken}`)
      .field("catalogName", "过期会话")
      .field("importMode", "create_only")
      .attach(
        "file",
        Buffer.from(
          "book_id,title,author,publisher,total_copies,available_copies\n1001,测试书,作者甲,出版社甲,5,3\n",
          "utf8"
        ),
        "stale-token.csv"
      );

    expect(importRes.status).toBe(401);
    expect(importRes.body.message).toContain("重新登录");
  });

  test("upsert mode updates an existing catalog record", async () => {
    await importCsv(
      Buffer.from(
        "book_id,title,author,publisher,total_copies,available_copies\n1001,测试书,作者甲,出版社甲,5,3\n",
        "utf8"
      ),
      "initial.csv"
    );

    const upsertRes = await importCsv(
      Buffer.from(
        "book_id,title,author,publisher,total_copies,available_copies\n1001,测试书新版,作者甲,出版社乙,8,6\n",
        "utf8"
      ),
      "update.csv",
      { importMode: "upsert" }
    );

    expect(upsertRes.status).toBe(201);

    const searchRes = await request(app).get("/api/books/search").query({ q: "测试书新版" });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.books[0]).toEqual(
      expect.objectContaining({
        title: "测试书新版",
        publisher: "出版社乙",
        totalCopies: 8,
      })
    );
  });

  test("lists admin books with pagination metadata", async () => {
    const csv = Buffer.from(
      Array.from({ length: 3 }, (_, index) =>
        `20${index + 1},测试图书${index + 1},作者${index + 1},出版社${index + 1},2,1`
      ).join("\n").replace(/^/, "book_id,title,author,publisher,total_copies,available_copies\n"),
      "utf8"
    );

    const importRes = await importCsv(csv, "paged.csv");
    expect(importRes.status).toBe(201);

    const pageRes = await request(app)
      .get("/api/admin/books")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ page: 1, pageSize: 2 });
    expect(pageRes.status).toBe(200);
    expect(pageRes.body.books).toHaveLength(2);
    expect(pageRes.body.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      })
    );
  });

  test("imports xlsx catalog rows and exposes configured display fields in admin books", async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([
      {
        控制号: "xls-1",
        书名: "XLS 图书",
        作者: "作者甲",
        出版社: "出版社甲",
        出版日期: "2024",
        条形码: "BC-XLS-1",
        复本数: 2,
      },
      {
        控制号: "xls-2",
        书名: "XLS 图书",
        作者: "作者甲",
        出版社: "出版社甲",
        出版日期: "2024",
        条形码: "BC-XLS-2",
        复本数: 1,
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    const xlsxBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const importRes = await importCsv(xlsxBuffer, "7floor.xlsx");
    expect(importRes.status).toBe(201);
    expect(importRes.body.batch.successRows).toBe(2);

    const adminBooksRes = await request(app)
      .get("/api/admin/books")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminBooksRes.status).toBe(200);
    expect(adminBooksRes.body.books[0]).toEqual(
      expect.objectContaining({
        title: "XLS 图书",
        author: "作者甲",
      })
    );
  });

  test("returns 400 for malformed public book ids and 404 for missing public book ids", async () => {
    const malformedRes = await request(app).post("/api/books/foo/reviews").send({
      ...studentIdentity,
      content: "学生留言",
    });
    expect(malformedRes.status).toBe(400);

    const missingRes = await request(app).post("/api/books/999999/reviews").send({
      ...studentIdentity,
      content: "图书不存在时仍应返回 404",
    });
    expect(missingRes.status).toBe(404);
    expect(missingRes.body.message).toContain("图书不存在");
  });

  test("keeps default process content read-only during asset updates", async () => {
    const initialAssets = await request(app)
      .get("/api/admin/assets")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(initialAssets.status).toBe(200);

    const patchRes = await request(app)
      .patch("/api/admin/assets")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        processContent: [
          { id: "custom-1", title: "不应生效", description: "应被忽略" },
        ],
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.processContent).toEqual(initialAssets.body.processContent);
  });
});
