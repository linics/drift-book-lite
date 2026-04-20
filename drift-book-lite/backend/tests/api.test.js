const fs = require("fs");
const path = require("path");
const request = require("supertest");
const XLSX = require("@e965/xlsx");
const { prisma } = require("../src/lib/prisma");
const { createApp } = require("../src/app");

let app;
let adminToken;

const APP_MODULES = [
  "../src/lib/env",
  "../src/utils/auth",
  "../src/middleware/adminAuth",
  "../src/routes/admin",
  "../src/routes/public",
  "../src/services/bootstrap",
  "../src/app",
];

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

function purgeAppModules() {
  for (const modulePath of APP_MODULES) {
    delete require.cache[require.resolve(modulePath)];
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

async function importCsv(csv, filename = "catalog.csv", extraFields = {}) {
  const requestBuilder = request(app)
    .post("/api/admin/imports")
    .set("Authorization", `Bearer ${adminToken}`)
    .field("catalogName", extraFields.catalogName || "馆藏目录")
    .field("importMode", extraFields.importMode || "create_only")
    .attach("file", csv, filename);

  return requestBuilder;
}

function resolveUploadedAssetPath(publicPath) {
  return path.join(
    process.env.UPLOADS_DIR,
    publicPath.replace(/^\/uploads\//, "")
  );
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
      password: "jyzx2026",
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
      .attach("file", path.join(siteAssetFixtureDir, "carousel-03.jpg"))
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

  test("deletes a carousel asset, compacts sort order, and removes the uploaded file", async () => {
    const firstUploadRes = await request(app)
      .post("/api/admin/assets/carousel")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", path.join(siteAssetFixtureDir, "carousel-03.jpg"))
      .field("label", "轮播一");
    const secondUploadRes = await request(app)
      .post("/api/admin/assets/carousel")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", path.join(siteAssetFixtureDir, "carousel-05.jpg"))
      .field("label", "轮播二");

    const deletedAsset = firstUploadRes.body.asset;
    const survivingAsset = secondUploadRes.body.asset;
    const deletedAssetPath = resolveUploadedAssetPath(deletedAsset.path);

    expect(fs.existsSync(deletedAssetPath)).toBe(true);

    const deleteRes = await request(app)
      .delete(`/api/admin/assets/carousel/${deletedAsset.id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.carouselImages).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: deletedAsset.id })])
    );
    expect(deleteRes.body.carouselImages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: survivingAsset.id,
          label: "轮播二",
          sortOrder: survivingAsset.sortOrder - 1,
        }),
      ])
    );
    expect(fs.existsSync(deletedAssetPath)).toBe(false);
  });

  test("keeps the uploaded file when another asset still references it", async () => {
    const carouselRes = await request(app)
      .post("/api/admin/assets/carousel")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", path.join(siteAssetFixtureDir, "carousel-06.jpg"))
      .field("label", "共享文件轮播");
    const asset = carouselRes.body.asset;
    const uploadedPath = resolveUploadedAssetPath(asset.path);

    await prisma.siteAsset.update({
      where: { id: 1 },
      data: {
        schoolLogoPath: asset.path,
      },
    });

    const deleteRes = await request(app)
      .delete(`/api/admin/assets/carousel/${asset.id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.carouselImages).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: asset.id })])
    );
    expect(fs.existsSync(uploadedPath)).toBe(true);
  });

  test("returns 404 when deleting a missing carousel asset", async () => {
    const deleteRes = await request(app)
      .delete("/api/admin/assets/carousel/missing-slide")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(404);
    expect(deleteRes.body.message).toContain("轮播图不存在");
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

  test("imports gb18030 csv files created by spreadsheet software", async () => {
    const gb18030Csv = Buffer.from(
      "626f6f6b5f69642c7469746c652c617574686f722c7075626c69736865722c746f74616c5f636f706965732c617661696c61626c655f636f706965730a313030312cb9b2b2fab5b3d0fbd1d42cc2edbfcbcbbc2cc8cbc3f1b3f6b0e6c9e72c352c340a",
      "hex"
    );

    const importRes = await importCsv(gb18030Csv, "图书信息.csv");

    expect(importRes.status).toBe(201);
    expect(importRes.body.batch.successRows).toBe(1);

    const searchRes = await request(app).get("/api/books/search").query({ q: "共产党宣言" });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.books[0]).toEqual(
      expect.objectContaining({
        title: "共产党宣言",
        author: "马克思",
        publishers: ["人民出版社"],
      })
    );
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
      password: "jyzx2026",
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

  test("allows the default admin frontend origin through cors", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5175");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5175");
  });

  test("allows configured lan frontend origins when ALLOWED_ORIGINS is unset", async () => {
    const previousAppBaseUrl = process.env.APP_BASE_URL;
    const previousAdminAppBaseUrl = process.env.ADMIN_APP_BASE_URL;
    const previousAllowedOrigins = process.env.ALLOWED_ORIGINS;

    try {
      process.env.APP_BASE_URL = "http://192.168.1.50:5174";
      process.env.ADMIN_APP_BASE_URL = "http://192.168.1.50:5175";
      delete process.env.ALLOWED_ORIGINS;
      purgeAppModules();

      const freshApp = await require("../src/app").createApp();
      const response = await request(freshApp)
        .get("/api/health")
        .set("Origin", "http://192.168.1.50:5175");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe("http://192.168.1.50:5175");
    } finally {
      process.env.APP_BASE_URL = previousAppBaseUrl;
      process.env.ADMIN_APP_BASE_URL = previousAdminAppBaseUrl;
      if (previousAllowedOrigins === undefined) {
        delete process.env.ALLOWED_ORIGINS;
      } else {
        process.env.ALLOWED_ORIGINS = previousAllowedOrigins;
      }
      purgeAppModules();
    }
  });

  test("rejects admin jwt after that username is removed from ADMIN_USERNAMES", async () => {
    const previousAdminUsernames = process.env.ADMIN_USERNAMES;

    try {
      process.env.ADMIN_USERNAMES = "admin1,admin2,admin3";
      purgeAppModules();

      let freshApp = await require("../src/app").createApp();
      const loginResponse = await request(freshApp).post("/api/admin/login").send({
        username: "admin2",
        password: "jyzx2026",
      });
      expect(loginResponse.status).toBe(200);

      process.env.ADMIN_USERNAMES = "admin1";
      purgeAppModules();
      freshApp = await require("../src/app").createApp();

      const response = await request(freshApp)
        .get("/api/admin/books")
        .set("Authorization", `Bearer ${loginResponse.body.token}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("重新登录");
    } finally {
      if (previousAdminUsernames === undefined) {
        delete process.env.ADMIN_USERNAMES;
      } else {
        process.env.ADMIN_USERNAMES = previousAdminUsernames;
      }
      purgeAppModules();
    }
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

  test("imports large create_only catalogs without per-row book lookup", async () => {
    const findUniqueSpy = vi.spyOn(prisma.book, "findUnique");
    try {
      const csv = Buffer.from(
        Array.from({ length: 1005 }, (_, index) => {
          const suffix = String(index + 1).padStart(4, "0");
          return `bulk-${suffix},批量图书${suffix},作者${suffix},出版社${suffix},2,1`;
        }).join("\n").replace(
          /^/,
          "book_id,title,author,publisher,total_copies,available_copies\n"
        ),
        "utf8"
      );

      const importRes = await importCsv(csv, "bulk.csv");

      expect(importRes.status).toBe(201);
      expect(importRes.body.batch).toEqual(
        expect.objectContaining({
          successRows: 1005,
          failedRows: 0,
          status: "completed",
        })
      );
      expect(findUniqueSpy).not.toHaveBeenCalled();
      await expect(prisma.book.count()).resolves.toBe(1005);
    } finally {
      findUniqueSpy.mockRestore();
    }
  });

  test("create_only import records duplicate book ids in the uploaded file as row failures", async () => {
    const csv = Buffer.from(
      "book_id,title,author,publisher,total_copies,available_copies\nsame-1,第一本,作者甲,出版社甲,2,1\nsame-1,第二本,作者乙,出版社乙,3,2\nsame-1,第三本,作者丙,出版社丙,4,3\n",
      "utf8"
    );

    const importRes = await importCsv(csv, "duplicate-file.csv");

    expect(importRes.status).toBe(201);
    expect(importRes.body.batch).toEqual(
      expect.objectContaining({
        successRows: 1,
        failedRows: 2,
        status: "partial",
      })
    );

    const detailRes = await request(app)
      .get(`/api/admin/imports/${importRes.body.batch.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.batch.failures).toEqual([
      expect.objectContaining({
        rowNumber: 3,
        bookId: "same-1",
        message: expect.stringContaining("文件内重复"),
      }),
      expect.objectContaining({
        rowNumber: 4,
        bookId: "same-1",
        message: expect.stringContaining("文件内重复"),
      }),
    ]);
  });

  test("upsert import keeps the last valid duplicate row from the uploaded file", async () => {
    const csv = Buffer.from(
      "book_id,title,author,publisher,total_copies,available_copies\nupsert-repeat,旧标题,作者甲,出版社甲,2,1\nupsert-repeat,最终标题,作者乙,出版社乙,5,4\n",
      "utf8"
    );

    const importRes = await importCsv(csv, "upsert-repeat.csv", { importMode: "upsert" });

    expect(importRes.status).toBe(201);
    expect(importRes.body.batch).toEqual(
      expect.objectContaining({
        successRows: 2,
        failedRows: 0,
        status: "completed",
      })
    );
    await expect(prisma.book.findUnique({ where: { bookId: "upsert-repeat" } })).resolves.toEqual(
      expect.objectContaining({
        title: "最终标题",
        author: "作者乙",
        publisher: "出版社乙",
        totalCopies: 5,
        availableCopies: 4,
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

  test("lists admin reviews with pagination metadata and combined query filter", async () => {
    const csv = Buffer.from(
      [
        "book_id,title,author,publisher,total_copies,available_copies",
        "301,分页留言图书一,作者甲,出版社甲,1,1",
        "302,综合检索图书二,作者乙,出版社乙,1,1",
        "303,分页留言图书三,作者丙,出版社丙,1,1",
      ].join("\n"),
      "utf8"
    );

    const importRes = await importCsv(csv, "review-paged.csv");
    expect(importRes.status).toBe(201);

    const books = await prisma.book.findMany({ orderBy: { bookId: "asc" } });
    await prisma.bookReview.createMany({
      data: [
        {
          bookId: books[0].id,
          displayName: "2025届 王小明",
          originalContent: "第一条分页留言",
          finalContent: "第一条分页留言",
          status: "pending",
          studentSystemId: "320250001",
          studentName: "王小明",
          studentClassName: "高一（1）班",
        },
        {
          bookId: books[1].id,
          displayName: "教师 李老师",
          originalContent: "这条命中综合检索",
          finalContent: "这条命中综合检索",
          status: "approved",
          identityType: "teacher",
          teacherName: "李老师",
        },
        {
          bookId: books[2].id,
          displayName: "2025届 张同学",
          originalContent: "第三条分页留言",
          finalContent: "第三条分页留言",
          status: "hidden",
          studentSystemId: "320250003",
          studentName: "张同学",
          studentClassName: "高一（3）班",
        },
      ],
    });

    const pageRes = await request(app)
      .get("/api/admin/reviews")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ page: 1, pageSize: 2 });
    expect(pageRes.status).toBe(200);
    expect(pageRes.body.reviews).toHaveLength(2);
    expect(pageRes.body.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      })
    );

    const filteredRes = await request(app)
      .get("/api/admin/reviews")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ q: "李老师", page: 1, pageSize: 30 });
    expect(filteredRes.status).toBe(200);
    expect(filteredRes.body.reviews).toEqual([
      expect.objectContaining({
        displayName: "教师 李老师",
        originalContent: "这条命中综合检索",
      }),
    ]);
    expect(filteredRes.body.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 30,
        total: 1,
        totalPages: 1,
      })
    );

    const bookFilteredRes = await request(app)
      .get("/api/admin/reviews")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ q: "图书三", status: "hidden", page: 1, pageSize: 30 });
    expect(bookFilteredRes.status).toBe(200);
    expect(bookFilteredRes.body.reviews).toEqual([
      expect.objectContaining({
        displayName: "2025届 张同学",
        status: "hidden",
      }),
    ]);
  });

  test("keeps unpaginated admin review requests complete for featured management", async () => {
    const csv = Buffer.from(
      "book_id,title,author,publisher,total_copies,available_copies\n401,精选管理图书,作者甲,出版社甲,1,1\n",
      "utf8"
    );

    const importRes = await importCsv(csv, "featured-review-source.csv");
    expect(importRes.status).toBe(201);

    const book = await prisma.book.findFirst({ where: { bookId: "401" } });
    await prisma.bookReview.createMany({
      data: Array.from({ length: 25 }, (_, index) => ({
        bookId: book.id,
        displayName: `2025届 学生${index + 1}`,
        originalContent: `精选候选留言${index + 1}`,
        finalContent: `精选候选留言${index + 1}`,
        status: "approved",
      })),
    });

    const response = await request(app)
      .get("/api/admin/reviews")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ status: "approved" });
    expect(response.status).toBe(200);
    expect(response.body.reviews).toHaveLength(25);
    expect(response.body.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 25,
        total: 25,
        totalPages: 1,
      })
    );
  });

  test("lists sensitive words with pagination metadata and query filter", async () => {
    await prisma.sensitiveWord.createMany({
      data: [
        { word: "兼职", normalizedWord: "兼职" },
        { word: "兼职刷单", normalizedWord: "兼职刷单" },
        { word: "贪污", normalizedWord: "贪污" },
      ],
    });

    const pageRes = await request(app)
      .get("/api/admin/sensitive-words")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ page: 1, pageSize: 2 });
    expect(pageRes.status).toBe(200);
    expect(pageRes.body.words).toHaveLength(2);
    expect(pageRes.body.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      })
    );

    const filteredRes = await request(app)
      .get("/api/admin/sensitive-words")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ q: "兼职", page: 1, pageSize: 10 });
    expect(filteredRes.status).toBe(200);
    expect(filteredRes.body.words.map((word) => word.word)).toEqual(["兼职", "兼职刷单"]);
    expect(filteredRes.body.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 10,
        total: 2,
        totalPages: 1,
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

  test("imports legacy xls catalog rows", async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([
      {
        控制号: "xls-legacy-1",
        书名: "旧版 XLS 图书",
        作者: "作者乙",
        出版社: "出版社乙",
        复本数: 3,
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    const xlsBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xls" });

    const importRes = await importCsv(xlsBuffer, "7floor.xls");
    expect(importRes.status).toBe(201);
    expect(importRes.body.batch.successRows).toBe(1);

    const adminBooksRes = await request(app)
      .get("/api/admin/books")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminBooksRes.status).toBe(200);
    expect(adminBooksRes.body.books[0]).toEqual(
      expect.objectContaining({
        title: "旧版 XLS 图书",
        author: "作者乙",
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
