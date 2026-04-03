const path = require("path");
const request = require("supertest");
const XLSX = require("xlsx");
const { prisma } = require("../src/lib/prisma");
const { createApp } = require("../src/app");
const { bootstrapFromMaterials } = require("../src/services/assets");

const gb18030CatalogHex =
  "626f6f6b5f69642c7469746c652c617574686f722c7075626c69736865722c746f74616c5f636f706965732c617661696c61626c655f636f706965730a313030312cb9b2b2fab5b3d0fbd1d42cc2edbfcbcbbc2cc8cbc3f1b3f6b0e6c9e72c352c340a";
const invalidCatalogHex =
  "626f6f6b5f69642c7469746c652c617574686f722c7075626c69736865722c746f74616c5f636f706965732c617661696c61626c655f636f706965730a313030312cb9b2b2fab5b3d0fbd1d42cc2edbfcbcbbc2cc8cbc3f1b3f6b0e6c9e72c352c340a313030322c2cd7f7d5dfd2d22cb3f6b0e6c9e7d2d22c332c320a";

let app;
let adminToken;

async function clearData() {
  await prisma.bookReview.deleteMany();
  await prisma.book.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.siteAsset.deleteMany();
  await prisma.adminUser.deleteMany();
}

describe("drift book lite api", () => {
  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(async () => {
    await clearData();
    app = await createApp();

    const login = await request(app).post("/api/admin/login").send({
      username: "admin",
      password: "change-this-password",
    });
    adminToken = login.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("bootstraps site assets from materials", async () => {
    const asset = await bootstrapFromMaterials();
    expect(asset.schoolLogoPath).toContain("/uploads/site-assets/");
    expect(asset.carouselImages.length).toBeGreaterThan(0);
  });

  test("uploads logo and carousel assets through dedicated admin endpoints", async () => {
    const imagePath = path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "materials",
      "43bb6febd4d0326ac05c15b7dbde0fc6.png"
    );

    const logoRes = await request(app)
      .post("/api/admin/assets/logo")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", imagePath);
    expect(logoRes.status).toBe(201);
    expect(logoRes.body.asset.schoolLogoPath).toContain("/uploads/site-assets/");

    const carouselRes = await request(app)
      .post("/api/admin/assets/carousel")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", imagePath)
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
    const importRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "馆藏目录")
      .field("importMode", "create_only")
      .attach(
        "file",
        Buffer.from(
          "book_id,title,author,publish_place,publisher,publish_date,barcode,subtitle,total_copies,available_copies\n1001,共产党宣言,马克思/恩格斯,北京,人民出版社,1848,BC1001,经典著作,5,4\n",
          "utf8"
        ),
        "catalog.csv"
      );

    expect(importRes.status).toBe(201);
    expect(importRes.body.batch.successRows).toBe(1);

    const searchRes = await request(app).get("/api/books/search").query({ q: "共产党宣" });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.books).toHaveLength(1);
    expect(searchRes.body.books[0].title).toBe("共产党宣言");
    expect(searchRes.body.books[0]).toEqual(
      expect.objectContaining({
        title: "共产党宣言",
        author: "马克思",
        authors: ["马克思/恩格斯"],
        publishPlace: "北京",
        publisher: "人民出版社",
        publishers: ["人民出版社"],
        publishDateText: "1848",
        publishDateTexts: ["1848"],
        barcode: "BC1001",
        barcodes: ["BC1001"],
        subtitle: "经典著作",
        totalCopies: 5,
      })
    );
    expect(searchRes.body.books[0]).not.toHaveProperty("bookId");

    const detailRes = await request(app).get(`/api/books/${searchRes.body.books[0].id}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.book).toEqual(
      expect.objectContaining({
        title: "共产党宣言",
        author: "马克思",
        authors: ["马克思/恩格斯"],
        publishPlace: "北京",
        publisher: "人民出版社",
        publishers: ["人民出版社"],
        publishDateText: "1848",
        publishDateTexts: ["1848"],
        barcode: "BC1001",
        barcodes: ["BC1001"],
        subtitle: "经典著作",
        totalCopies: 5,
      })
    );
    expect(detailRes.body.book).not.toHaveProperty("bookId");
  });

  test("imports a utf8 bom catalog when book_id is the first column", async () => {
    const bomCsv = Buffer.from(
      "\uFEFFbook_id,title,author,publisher,total_copies,available_copies\n1001,测试书,作者甲,出版社甲,5,3\n",
      "utf8"
    );

    const importRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "BOM 目录")
      .field("importMode", "create_only")
      .attach("file", bomCsv, "catalog-bom.csv");

    expect(importRes.status).toBe(201);
    expect(importRes.body.batch.successRows).toBe(1);
    expect(importRes.body.batch.failedRows).toBe(0);
  });

  test("keeps chinese import filenames readable in batch history", async () => {
    const csv = Buffer.from(
      "book_id,title,author,publisher,total_copies,available_copies\n1001,测试书,作者甲,出版社甲,5,3\n",
      "utf8"
    );

    const importRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "中文文件名目录")
      .field("importMode", "create_only")
      .attach("file", csv, "图书信息.csv");

    expect(importRes.status).toBe(201);
    expect(importRes.body.batch.fileName).toBe("图书信息.csv");

    const listRes = await request(app)
      .get("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.batches[0].fileName).toBe("图书信息.csv");
  });

  test("tracks failed rows with line numbers during import", async () => {
    const importRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "错误目录")
      .field("importMode", "create_only")
      .attach("file", Buffer.from(invalidCatalogHex, "hex"), "invalid.csv");

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

    const listRes = await request(app)
      .get("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.batches[0]).not.toHaveProperty("failures");
    expect(listRes.body.batches[0].status).toBe("partial");
  });

  test("rejects stale admin token before touching protected write APIs", async () => {
    const firstLogin = await request(app).post("/api/admin/login").send({
      username: "admin",
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
    const initialCsv = Buffer.from(
      "book_id,title,author,publisher,total_copies,available_copies\n1001,测试书,作者甲,出版社甲,5,3\n",
      "utf8"
    );
    const updateCsv = Buffer.from(
      "book_id,title,author,publisher,total_copies,available_copies\n1001,测试书新版,作者甲,出版社乙,8,6\n",
      "utf8"
    );

    await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "初始目录")
      .field("importMode", "create_only")
      .attach("file", initialCsv, "initial.csv");

    const upsertRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "更新目录")
      .field("importMode", "upsert")
      .attach("file", updateCsv, "update.csv");

    expect(upsertRes.status).toBe(201);

    const searchRes = await request(app).get("/api/books/search").query({ q: "测试书新版" });
    expect(searchRes.body.books[0].publisher).toBe("出版社乙");
    expect(searchRes.body.books[0].title).toBe("测试书新版");
    expect(searchRes.body.books[0]).toHaveProperty("totalCopies", 8);
  });

  test("merges same title and first author books in public search and detail", async () => {
    const csv = Buffer.from(
      [
        "book_id,title,author,publisher,barcode,total_copies,available_copies",
        "1001,测试合集,作者甲,出版社甲,BC1001,2,1",
        "1002,测试合集,作者甲、作者乙,出版社甲,BC1002,3,2",
        "1003,测试合集,作者甲、作者丙,出版社乙,BC1003,4,4",
      ].join("\n"),
      "utf8"
    );

    const importRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "合并目录")
      .field("importMode", "create_only")
      .attach("file", csv, "grouped.csv");

    expect(importRes.status).toBe(201);
    expect(importRes.body.batch.successRows).toBe(3);

    const searchRes = await request(app).get("/api/books/search").query({ q: "测试合集" });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.books).toHaveLength(1);
    const [mergedBook] = searchRes.body.books;
    expect(mergedBook).toEqual(
      expect.objectContaining({
        title: "测试合集",
        author: "作者甲",
        totalCopies: 9,
        barcodes: ["BC1001", "BC1002", "BC1003"],
      })
    );
    expect(String(mergedBook.id)).not.toMatch(/^\d+$/);

    const detailRes = await request(app).get(`/api/books/${mergedBook.id}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.book).toEqual(
      expect.objectContaining({
        title: "测试合集",
        author: "作者甲",
        totalCopies: 9,
        barcodes: ["BC1001", "BC1002", "BC1003"],
        authors: ["作者甲", "作者甲、作者乙", "作者甲、作者丙"],
        publishers: ["出版社甲", "出版社乙"],
      })
    );
  });

  test("merges books when year isbn secondary author and publisher suffix differ", async () => {
    const csv = Buffer.from(
      [
        "book_id,title,author,publisher,publish_date,isbn,barcode,total_copies,available_copies",
        "3001,宣言研究,马克思、恩格斯,人民出版社,1978,ISBN-1,BC3001,2,2",
        "3002,宣言研究,马克思、恩格斯、李四,人民出版社有限公司,2009,ISBN-2,BC3002,1,1",
      ].join("\n"),
      "utf8"
    );

    const importRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "弱差异合并目录")
      .field("importMode", "create_only")
      .attach("file", csv, "merge-soft-diff.csv");

    expect(importRes.status).toBe(201);

    const searchRes = await request(app).get("/api/books/search").query({ q: "宣言研究" });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.books).toHaveLength(1);
    expect(searchRes.body.books[0]).toEqual(
      expect.objectContaining({
        title: "宣言研究",
        totalCopies: 3,
        barcodes: ["BC3001", "BC3002"],
      })
    );
  });

  test("does not merge books when subtitle differs", async () => {
    const csv = Buffer.from(
      [
        "book_id,title,author,publisher,subtitle,barcode,total_copies,available_copies",
        "4001,宣言导读,作者甲,出版社甲,导读本,BC4001,1,1",
        "4002,宣言导读,作者甲,出版社甲,注释本,BC4002,1,1",
      ].join("\n"),
      "utf8"
    );

    const importRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "副标题拆分目录")
      .field("importMode", "create_only")
      .attach("file", csv, "split-by-subtitle.csv");

    expect(importRes.status).toBe(201);

    const searchRes = await request(app).get("/api/books/search").query({ q: "宣言导读" });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.books).toHaveLength(2);
    expect(searchRes.body.books.map((book) => book.subtitle).sort()).toEqual(["导读本", "注释本"]);
  });

  test("shares reviews across grouped books and shows aggregate detail", async () => {
    const csv = Buffer.from(
      [
        "book_id,title,author,publisher,barcode,total_copies,available_copies",
        "2001,公共评语书,作者乙,出版社乙,BC2001,1,1",
        "2002,公共评语书,作者乙,出版社乙,BC2002,1,0",
      ].join("\n"),
      "utf8"
    );

    await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "评语目录")
      .field("importMode", "create_only")
      .attach("file", csv, "reviews.csv");

    const books = await prisma.book.findMany({
      where: { title: "公共评语书" },
      orderBy: { id: "asc" },
    });
    expect(books).toHaveLength(2);

    await prisma.bookReview.create({
      data: {
        bookId: books[1].id,
        displayName: "先来的同学",
        originalContent: "这本书值得一读",
        finalContent: "这本书值得一读",
        status: "approved",
        reviewedAt: new Date(),
      },
    });

    const searchRes = await request(app).get("/api/books/search").query({ q: "公共评语书" });
    const groupedId = searchRes.body.books[0].id;

    const createReviewRes = await request(app).post(`/api/books/${groupedId}/reviews`).send({
      displayName: "后来的同学",
      content: "我也很喜欢这本书",
    });
    expect(createReviewRes.status).toBe(201);

    const pendingRes = await request(app)
      .get("/api/admin/reviews")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ status: "pending" });
    const pendingReview = pendingRes.body.reviews.find(
      (review) => review.displayName === "后来的同学"
    );
    expect(pendingReview).toBeTruthy();

    const approveRes = await request(app)
      .patch(`/api/admin/reviews/${pendingReview.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        action: "approve",
        finalContent: "我也很喜欢这本书",
      });
    expect(approveRes.status).toBe(200);

    const reviewsRes = await request(app).get(`/api/books/${groupedId}/reviews`);
    expect(reviewsRes.status).toBe(200);
    expect(reviewsRes.body.reviews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ displayName: "先来的同学" }),
        expect.objectContaining({ displayName: "后来的同学" }),
      ])
    );

    const detailRes = await request(app).get(`/api/books/${groupedId}`);
    expect(detailRes.body.book.barcodes).toEqual(["BC2001", "BC2002"]);
    expect(detailRes.body.book.totalCopies).toBe(2);
    expect(detailRes.body.book).not.toHaveProperty("availableCopies");
  });

  test("keeps numeric review submissions bound to the requested physical copy", async () => {
    const csv = Buffer.from(
      [
        "book_id,title,author,publisher,barcode,total_copies,available_copies",
        "2101,定向评语书,作者甲,出版社甲,BC2101,1,1",
        "2102,定向评语书,作者甲,出版社乙,BC2102,1,1",
      ].join("\n"),
      "utf8"
    );

    await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "定向评语目录")
      .field("importMode", "create_only")
      .attach("file", csv, "review-target.csv");

    const books = await prisma.book.findMany({
      where: { title: "定向评语书" },
      orderBy: { id: "asc" },
    });
    expect(books).toHaveLength(2);

    const reviewRes = await request(app).post(`/api/books/${books[1].id}/reviews`).send({
      displayName: "指定副本读者",
      content: "这条评语必须留在第二本副本上",
    });
    expect(reviewRes.status).toBe(201);

    const review = await prisma.bookReview.findUnique({
      where: { id: reviewRes.body.review.id },
    });
    expect(review).toEqual(
      expect.objectContaining({
        bookId: books[1].id,
        displayName: "指定副本读者",
      })
    );

    await prisma.bookReview.create({
      data: {
        bookId: books[0].id,
        displayName: "第一本副本读者",
        originalContent: "这条评语只属于第一本副本",
        finalContent: "这条评语只属于第一本副本",
        status: "approved",
        reviewedAt: new Date(),
      },
    });

    await prisma.bookReview.update({
      where: { id: review.id },
      data: {
        status: "approved",
        reviewedAt: new Date(),
      },
    });

    const detailRes = await request(app).get(`/api/books/${books[1].id}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.book).toEqual(
      expect.objectContaining({
        id: books[1].id,
        title: "定向评语书",
        publisher: "出版社乙",
        publishers: ["出版社乙"],
        barcode: "BC2102",
        barcodes: ["BC2102"],
        totalCopies: 1,
        groupBookCount: 1,
      })
    );

    const reviewsRes = await request(app).get(`/api/books/${books[1].id}/reviews`);
    expect(reviewsRes.status).toBe(200);
    expect(reviewsRes.body.reviews).toEqual([
      expect.objectContaining({
        displayName: "指定副本读者",
        content: "这条评语必须留在第二本副本上",
      }),
    ]);
  });

  test("migrates grouped reviews to a surviving copy when deleting the representative batch", async () => {
    const batchOneCsv = Buffer.from(
      [
        "book_id,title,author,publisher,barcode,total_copies,available_copies",
        "2201,迁移评语书,作者乙,出版社乙,BC2201,1,1",
      ].join("\n"),
      "utf8"
    );
    const batchTwoCsv = Buffer.from(
      [
        "book_id,title,author,publisher,barcode,total_copies,available_copies",
        "2202,迁移评语书,作者乙,出版社乙,BC2202,1,1",
      ].join("\n"),
      "utf8"
    );

    const batchOneRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "迁移评语批次一")
      .field("importMode", "create_only")
      .attach("file", batchOneCsv, "review-migrate-1.csv");
    expect(batchOneRes.status).toBe(201);

    const batchTwoRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "迁移评语批次二")
      .field("importMode", "create_only")
      .attach("file", batchTwoCsv, "review-migrate-2.csv");
    expect(batchTwoRes.status).toBe(201);

    const books = await prisma.book.findMany({
      where: { title: "迁移评语书" },
      orderBy: { id: "asc" },
    });
    expect(books).toHaveLength(2);

    const searchRes = await request(app).get("/api/books/search").query({ q: "迁移评语书" });
    expect(searchRes.status).toBe(200);
    const groupedId = searchRes.body.books[0].id;

    const createReviewRes = await request(app).post(`/api/books/${groupedId}/reviews`).send({
      displayName: "迁移后的读者",
      content: "代表副本删除后也应继续可见",
    });
    expect(createReviewRes.status).toBe(201);

    const pendingRes = await request(app)
      .get("/api/admin/reviews")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ status: "pending" });
    const pendingReview = pendingRes.body.reviews.find(
      (review) => review.displayName === "迁移后的读者"
    );
    expect(pendingReview).toBeTruthy();

    const approveRes = await request(app)
      .patch(`/api/admin/reviews/${pendingReview.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        action: "approve",
        finalContent: "代表副本删除后也应继续可见",
      });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.review.bookId).toBe(books[0].id);

    const deleteRes = await request(app)
      .delete(`/api/admin/imports/${batchOneRes.body.batch.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);

    const migratedReview = await prisma.bookReview.findUnique({
      where: { id: pendingReview.id },
    });
    expect(migratedReview).toEqual(
      expect.objectContaining({
        bookId: books[1].id,
        status: "approved",
      })
    );

    const publicReviewRes = await request(app).get(`/api/books/${groupedId}/reviews`);
    expect(publicReviewRes.status).toBe(200);
    expect(publicReviewRes.body.reviews).toEqual([
      expect.objectContaining({
        displayName: "迁移后的读者",
        content: "代表副本删除后也应继续可见",
      }),
    ]);

    const approvedRes = await request(app)
      .get("/api/admin/reviews")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ status: "approved" });
    const approvedReview = approvedRes.body.reviews.find((review) => review.id === pendingReview.id);
    expect(approvedReview).toEqual(
      expect.objectContaining({
        bookId: books[1].id,
        displayName: "迁移后的读者",
      })
    );

    expect(batchTwoRes.status).toBe(201);
  });

  test("aggregated detail exposes multi publisher and multi publish date lists", async () => {
    const csv = Buffer.from(
      [
        "book_id,title,author,publisher,publish_date,barcode,total_copies,available_copies",
        "5001,跨版图书,作者甲、作者乙,出版社甲,1998,BC5001,1,1",
        "5002,跨版图书,作者甲、作者丙,出版社乙,2006,BC5002,1,1",
      ].join("\n"),
      "utf8"
    );

    await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "跨版目录")
      .field("importMode", "create_only")
      .attach("file", csv, "multi-meta.csv");

    const searchRes = await request(app).get("/api/books/search").query({ q: "跨版图书" });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.books).toHaveLength(1);

    const detailRes = await request(app).get(`/api/books/${searchRes.body.books[0].id}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.book).toEqual(
      expect.objectContaining({
        title: "跨版图书",
        authors: ["作者甲、作者乙", "作者甲、作者丙"],
        publishers: ["出版社甲", "出版社乙"],
        publishDateTexts: ["1998", "2006"],
      })
    );
  });

  test("merges books when author strings differ only by role suffixes and trailing 等", async () => {
    const csv = Buffer.from(
      [
        "book_id,title,author,publisher,publish_date,barcode,total_copies,available_copies",
        '6001,共产党宣言,"马克思,恩格斯著;陈望道译",湖南人民出版社有限责任公,2021,BC6001,1,1',
        "6002,共产党宣言,马克思等,中央编译出版社,1998/01,BC6002,1,1",
      ].join("\n"),
      "utf8"
    );

    const importRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "责任者归一目录")
      .field("importMode", "create_only")
      .attach("file", csv, "author-normalization.csv");

    expect(importRes.status).toBe(201);

    const searchRes = await request(app).get("/api/books/search").query({ q: "共产党宣言" });
    const merged = searchRes.body.books.find((book) => book.barcodes?.includes("BC6001"));
    expect(merged).toBeTruthy();
    expect(merged.barcodes).toEqual(expect.arrayContaining(["BC6001", "BC6002"]));
  });

  test("merges books when author strings use combined 等著 and 等编 suffixes", async () => {
    const csv = Buffer.from(
      [
        "book_id,title,author,publisher,barcode,total_copies,available_copies",
        "6101,组合尾缀书,作者甲等著,出版社甲,BC6101,1,1",
        "6102,组合尾缀书,作者甲等编,出版社甲,BC6102,1,1",
        "6103,组合尾缀书,作者甲,出版社甲,BC6103,1,1",
      ].join("\n"),
      "utf8"
    );

    const importRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "组合尾缀目录")
      .field("importMode", "create_only")
      .attach("file", csv, "combined-suffix.csv");
    expect(importRes.status).toBe(201);

    const searchRes = await request(app).get("/api/books/search").query({ q: "组合尾缀书" });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.books).toHaveLength(1);
    expect(searchRes.body.books[0]).toEqual(
      expect.objectContaining({
        title: "组合尾缀书",
        totalCopies: 3,
        barcodes: ["BC6101", "BC6102", "BC6103"],
      })
    );
  });

  test("deleting an old batch keeps books reassigned to a newer upsert batch", async () => {
    const initialCsv = Buffer.from(
      "book_id,title,author,publisher,total_copies,available_copies\n1001,保留图书,作者甲,出版社甲,5,3\n",
      "utf8"
    );
    const updateCsv = Buffer.from(
      "book_id,title,author,publisher,total_copies,available_copies\n1001,保留图书新版,作者甲,出版社乙,8,6\n",
      "utf8"
    );

    const initialRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "初始目录")
      .field("importMode", "create_only")
      .attach("file", initialCsv, "initial.csv");
    expect(initialRes.status).toBe(201);

    const upsertRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "修订目录")
      .field("importMode", "upsert")
      .attach("file", updateCsv, "update.csv");
    expect(upsertRes.status).toBe(201);

    const deleteRes = await request(app)
      .delete(`/api/admin/imports/${initialRes.body.batch.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.deletedBookCount).toBe(0);

    const booksRes = await request(app)
      .get("/api/admin/books")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ page: 1, pageSize: 10 });
    expect(booksRes.status).toBe(200);
    expect(booksRes.body.books).toEqual([
      expect.objectContaining({
        title: "保留图书新版",
        author: "作者甲",
        publisher: "出版社乙",
      }),
    ]);
  });

  test("deleting the latest upsert batch removes books currently owned by that batch", async () => {
    const initialCsv = Buffer.from(
      "book_id,title,author,publisher,total_copies,available_copies\n1001,旧图书,作者甲,出版社甲,5,3\n",
      "utf8"
    );
    const upsertCsv = Buffer.from(
      [
        "book_id,title,author,publisher,total_copies,available_copies",
        "1001,旧图书新版,作者甲,出版社乙,8,6",
        "2001,批次新增图书,作者乙,出版社丙,4,4",
      ].join("\n"),
      "utf8"
    );

    const initialRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "初始目录")
      .field("importMode", "create_only")
      .attach("file", initialCsv, "initial.csv");
    expect(initialRes.status).toBe(201);

    const upsertRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "修订目录")
      .field("importMode", "upsert")
      .attach("file", upsertCsv, "upsert.csv");
    expect(upsertRes.status).toBe(201);

    const deleteRes = await request(app)
      .delete(`/api/admin/imports/${upsertRes.body.batch.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.deletedBookCount).toBe(2);

    const booksRes = await request(app)
      .get("/api/admin/books")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ page: 1, pageSize: 10 });
    expect(booksRes.status).toBe(200);
    expect(booksRes.body.books).toEqual([]);
  });

  test("returns 400 for malformed public book ids", async () => {
    const detailRes = await request(app).get("/api/books/foo");
    expect(detailRes.status).toBe(400);
    expect(detailRes.body.message).toContain("图书");

    const reviewsRes = await request(app).get("/api/books/foo/reviews");
    expect(reviewsRes.status).toBe(400);
    expect(reviewsRes.body.message).toContain("图书");

    const createReviewRes = await request(app).post("/api/books/foo/reviews").send({
      displayName: "学生甲",
      content: "非法 id 不应进入数据库查询",
    });
    expect(createReviewRes.status).toBe(400);
    expect(createReviewRes.body.message).toContain("图书");
  });

  test("keeps 404 for valid but missing public book ids", async () => {
    const detailRes = await request(app).get("/api/books/999999");
    expect(detailRes.status).toBe(404);
    expect(detailRes.body.message).toContain("图书不存在");

    const reviewsRes = await request(app).get("/api/books/999999/reviews");
    expect(reviewsRes.status).toBe(404);
    expect(reviewsRes.body.message).toContain("图书不存在");

    const createReviewRes = await request(app).post("/api/books/999999/reviews").send({
      displayName: "学生甲",
      content: "图书不存在时仍应返回 404",
    });
    expect(createReviewRes.status).toBe(404);
    expect(createReviewRes.body.message).toContain("图书不存在");
  });

  test("lists admin books with pagination metadata", async () => {
    const csv = Buffer.from(
      [
        "book_id,title,author,publisher,total_copies,available_copies",
        "1001,测试书甲,作者甲,出版社甲,5,3",
        "1002,测试书乙,作者乙,出版社乙,5,3",
        "1003,测试书丙,作者丙,出版社丙,5,3",
      ].join("\n"),
      "utf8"
    );

    const importRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "分页目录")
      .field("importMode", "create_only")
      .attach("file", csv, "paged.csv");
    expect(importRes.status).toBe(201);

    const page1Res = await request(app)
      .get("/api/admin/books")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ page: 1, pageSize: 2 });
    expect(page1Res.status).toBe(200);
    expect(page1Res.body.books).toHaveLength(2);
    expect(page1Res.body.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      })
    );

    const page2Res = await request(app)
      .get("/api/admin/books")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ page: 2, pageSize: 2 });
    expect(page2Res.status).toBe(200);
    expect(page2Res.body.books).toHaveLength(1);
    expect(page2Res.body.pagination).toEqual(
      expect.objectContaining({
        page: 2,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      })
    );
  });

  test("deletes an import batch while keeping submitted reviews", async () => {
    const batchOneCsv = Buffer.from(
      [
        "book_id,title,author,publisher,total_copies,available_copies",
        "1001,批次一图书,作者甲,出版社甲,5,3",
        "1002,批次一图书乙,作者乙,出版社乙,5,3",
      ].join("\n"),
      "utf8"
    );
    const batchTwoCsv = Buffer.from(
      [
        "book_id,title,author,publisher,total_copies,available_copies",
        "2001,批次二图书,作者丙,出版社丙,5,3",
      ].join("\n"),
      "utf8"
    );

    const batchOneRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "批次一")
      .field("importMode", "create_only")
      .attach("file", batchOneCsv, "batch-one.csv");
    expect(batchOneRes.status).toBe(201);

    const batchTwoRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "批次二")
      .field("importMode", "create_only")
      .attach("file", batchTwoCsv, "batch-two.csv");
    expect(batchTwoRes.status).toBe(201);

    const booksBeforeDeleteRes = await request(app)
      .get("/api/admin/books")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ page: 1, pageSize: 10 });
    const reviewBook = booksBeforeDeleteRes.body.books.find((book) => book.title === "批次一图书");
    expect(reviewBook).toBeTruthy();

    const reviewCreateRes = await request(app)
      .post(`/api/books/${reviewBook.id}/reviews`)
      .send({
        displayName: "学生甲",
        content: "这本书值得保留评语。",
      });
    expect(reviewCreateRes.status).toBe(201);

    const deleteRes = await request(app)
      .delete(`/api/admin/imports/${batchOneRes.body.batch.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.deletedBookCount).toBe(2);

    const booksRes = await request(app)
      .get("/api/admin/books")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ page: 1, pageSize: 10 });
    expect(booksRes.status).toBe(200);
    expect(booksRes.body.books).toEqual([
      expect.objectContaining({
        title: "批次二图书",
        author: "作者丙",
        publisher: "出版社丙",
      }),
    ]);

    const reviewsRes = await request(app)
      .get("/api/admin/reviews")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ status: "pending" });
    expect(reviewsRes.status).toBe(200);
    expect(reviewsRes.body.reviews).toEqual([
      expect.objectContaining({
        displayName: "学生甲",
        originalContent: "这本书值得保留评语。",
        book: null,
      }),
    ]);

    const batchesRes = await request(app)
      .get("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(batchesRes.status).toBe(200);
    expect(batchesRes.body.batches.map((batch) => batch.id)).toEqual([batchTwoRes.body.batch.id]);
  });

  test("imports xlsx catalog rows and exposes configured display fields in admin books", async () => {
    const rows = [
      [
        "控制号",
        "索取号",
        "正题名",
        "责任者",
        "版本",
        "出版地",
        "出版者",
        "出版日期",
        "获得方式",
        "页卷数",
        "isbn",
        "文献类型",
        "复本数",
        "卷册号",
        "登录号",
        "条形码",
        "分配地址",
        "架位号",
        "装订",
        "单价",
        "采购价",
        "批号",
        "其他题名",
        "分册名",
        "入库日期",
      ],
      [
        "186898",
        "G632.15/2304",
        "奠基 从品行开始",
        "上海市教育委员会教学研究室编撰",
        "",
        "上海",
        "上海教育音像出版社",
        "2018",
        "馆配",
        "200页",
        "9787544499999",
        "中文图书",
        "4",
        "",
        "87882",
        "1010000022",
        "流通室",
        "",
        "精装",
        "48",
        "48",
        "0",
        "",
        "",
        "2007.02.06",
      ],
      [
        "186898",
        "G632.15/2304",
        "奠基 从品行开始",
        "上海市教育委员会教学研究室编撰",
        "",
        "上海",
        "上海教育音像出版社",
        "2018",
        "馆配",
        "200页",
        "9787544499999",
        "中文图书",
        "4",
        "",
        "87883",
        "1010000727",
        "流通室",
        "",
        "精装",
        "48",
        "48",
        "0",
        "",
        "",
        "2007.02.06",
      ],
      [
        "205164",
        "B82/7946",
        "何为良好生活",
        "陈嘉映",
        "",
        "上海",
        "上海文艺出版社",
        "2021",
        "馆配",
        "320页",
        "9787532188888",
        "中文图书",
        "5",
        "",
        "05993",
        "101105993",
        "流通室",
        "",
        "平装",
        "58",
        "58",
        "0",
        "",
        "",
        "2007.02.06",
      ],
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "5555");
    const xlsxBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    const importRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "7楼目录")
      .field("importMode", "create_only")
      .attach("file", xlsxBuffer, "7floor.xlsx");

    expect(importRes.status).toBe(201);
    expect(importRes.body.batch.successRows).toBe(2);
    expect(importRes.body.batch.failedRows).toBe(0);

    const booksRes = await request(app)
      .get("/api/admin/books")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ page: 1, pageSize: 10 });

    expect(booksRes.status).toBe(200);
    expect(booksRes.body.books).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "奠基 从品行开始",
          author: "上海市教育委员会教学研究室编撰",
          publishPlace: "上海",
          publisher: "上海教育音像出版社",
          publishDateText: "2018",
          barcode: "1010000022",
        }),
        expect.objectContaining({
          title: "何为良好生活",
          author: "陈嘉映",
          publishPlace: "上海",
          publisher: "上海文艺出版社",
          publishDateText: "2021",
          barcode: "101105993",
        }),
      ])
    );
    expect(booksRes.body.books[0]).not.toHaveProperty("bookId");
    expect(booksRes.body.books[0]).not.toHaveProperty("categoryLabel");
  });

  test("imports xlsx rows even when author or publisher is missing", async () => {
    const rows = [
      [
        "控制号",
        "索取号",
        "正题名",
        "责任者",
        "版本",
        "出版地",
        "出版者",
        "出版日期",
        "获得方式",
        "页卷数",
        "isbn",
        "文献类型",
        "复本数",
        "卷册号",
        "登录号",
        "条形码",
        "分配地址",
        "架位号",
        "装订",
        "单价",
        "采购价",
        "批号",
        "其他题名",
        "分册名",
        "入库日期",
      ],
      [
        "167117",
        "K265-64/0272",
        "武汉会战",
        "",
        "",
        "北京",
        "团结出版社",
        "2005.01",
        "馆配",
        "320页",
        "7-80130-962-6",
        "中文图书",
        "1",
        "",
        "",
        "1002200724472",
        "流通室",
        "",
        "平装",
        "32",
        "32",
        "0",
        "保卫大武汉",
        "",
        "2007.02.06",
      ],
      [
        "171561",
        "K294.5/7926",
        "新疆往事",
        "陈伍国,刘向晖",
        "",
        "乌鲁木齐",
        "",
        "2006.1",
        "馆配",
        "280页",
        "7-80170-463-0",
        "中文图书",
        "1",
        "",
        "",
        "1002210100493",
        "流通室",
        "",
        "平装",
        "28",
        "28",
        "0",
        "",
        "",
        "2007.02.06",
      ],
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "5555");
    const xlsxBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    const importRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "缺字段目录")
      .field("importMode", "create_only")
      .attach("file", xlsxBuffer, "missing-fields.xlsx");

    expect(importRes.status).toBe(201);
    expect(importRes.body.batch.successRows).toBe(2);
    expect(importRes.body.batch.failedRows).toBe(0);

    const booksRes = await request(app)
      .get("/api/admin/books")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ page: 1, pageSize: 10 });

    expect(booksRes.body.books).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "武汉会战",
          author: "佚名",
          publishPlace: "北京",
          publisher: "团结出版社",
          publishDateText: "2005.01",
          barcode: "1002200724472",
          subtitle: "保卫大武汉",
        }),
        expect.objectContaining({
          title: "新疆往事",
          author: "陈伍国,刘向晖",
          publishPlace: "乌鲁木齐",
          publisher: "未知出版社",
          publishDateText: "2006.1",
          barcode: "1002210100493",
        }),
      ])
    );
  });

  test("merges 其他题名 and 分册名 into subtitle when both exist", async () => {
    const rows = [
      ["控制号", "正题名", "责任者", "出版地", "出版者", "出版日期", "条形码", "其他题名", "分册名", "复本数"],
      ["300001", "测试图书", "作者甲", "上海", "出版社甲", "2022.05", "BC300001", "别名一", "第一册", "1"],
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "sheet1");
    const xlsxBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    const importRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "副标题目录")
      .field("importMode", "create_only")
      .attach("file", xlsxBuffer, "subtitle.xlsx");

    expect(importRes.status).toBe(201);

    const booksRes = await request(app)
      .get("/api/admin/books")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ page: 1, pageSize: 10 });

    expect(booksRes.status).toBe(200);
    expect(booksRes.body.books).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "测试图书",
          subtitle: "别名一 / 第一册",
        }),
      ])
    );
  });

  test("does not return unrelated short-title fuzzy matches", async () => {
    const csv = Buffer.from(
      [
        "book_id,title,author,publisher,total_copies,available_copies",
        "1001,活着,余华,作家出版社,5,3",
        "1002,论语,孔子,古籍出版社,5,3",
        "1003,老子,李耳,古籍出版社,5,3",
        "1004,活着再见,作者乙,出版社乙,5,3",
      ].join("\n"),
      "utf8"
    );

    const importRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "短标题目录")
      .field("importMode", "create_only")
      .attach("file", csv, "short-title.csv");
    expect(importRes.status).toBe(201);

    const searchRes = await request(app).get("/api/books/search").query({ q: "活着" });
    expect(searchRes.status).toBe(200);

    const titles = searchRes.body.books.map((book) => book.title);
    expect(titles).toContain("活着");
    expect(titles).toContain("活着再见");
    expect(titles).not.toContain("论语");
    expect(titles).not.toContain("老子");
  });

  test("allows admin to edit and approve a review while public sees only the final text", async () => {
    const csv = Buffer.from(
      "book_id,title,author,publisher,total_copies,available_copies\n1001,测试书,作者甲,出版社甲,5,3\n",
      "utf8"
    );

    const importRes = await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "馆藏目录")
      .field("importMode", "create_only")
      .attach("file", csv, "catalog.csv");
    expect(importRes.status).toBe(201);
    expect(importRes.body.batch.successRows).toBe(1);

    const booksRes = await request(app)
      .get("/api/admin/books")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ page: 1, pageSize: 10 });
    expect(booksRes.status).toBe(200);
    const book = booksRes.body.books.find((entry) => entry.title === "测试书");
    expect(book).toBeTruthy();
    const bookId = book.id;

    const reviewRes = await request(app).post(`/api/books/${bookId}/reviews`).send({
      displayName: "小林",
      content: "这本书真 棒",
    });
    expect(reviewRes.status).toBe(201);

    const pendingRes = await request(app)
      .get("/api/admin/reviews")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ status: "pending" });
    expect(pendingRes.status).toBe(200);
    expect(pendingRes.body.reviews).toHaveLength(1);

    const reviewId = pendingRes.body.reviews[0].id;
    const approveRes = await request(app)
      .patch(`/api/admin/reviews/${reviewId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        action: "approve",
        finalContent: "这本书真棒",
      });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.review.originalContent).toBe("这本书真 棒");
    expect(approveRes.body.review.finalContent).toBe("这本书真棒");

    const publicReviewRes = await request(app).get(`/api/books/${bookId}/reviews`);
    expect(publicReviewRes.status).toBe(200);
    expect(publicReviewRes.body.reviews).toEqual([
      expect.objectContaining({
        displayName: "小林",
        content: "这本书真棒",
      }),
    ]);
  });

  test("allows admin to hide an approved review while keeping it in admin history", async () => {
    const csv = Buffer.from(
      "book_id,title,author,publisher,total_copies,available_copies\n1001,测试书,作者甲,出版社甲,5,3\n",
      "utf8"
    );

    await request(app)
      .post("/api/admin/imports")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("catalogName", "馆藏目录")
      .field("importMode", "create_only")
      .attach("file", csv, "catalog.csv");

    const booksRes = await request(app).get("/api/books/search").query({ q: "测试书" });
    const bookId = booksRes.body.books[0].id;

    const reviewRes = await request(app).post(`/api/books/${bookId}/reviews`).send({
      displayName: "小林",
      content: "值得一读",
    });
    expect(reviewRes.status).toBe(201);

    const pendingRes = await request(app)
      .get("/api/admin/reviews")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ status: "pending" });
    const reviewId = pendingRes.body.reviews[0].id;

    const approveRes = await request(app)
      .patch(`/api/admin/reviews/${reviewId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        action: "approve",
        finalContent: "值得一读，推荐。",
      });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.review.status).toBe("approved");

    const hideRes = await request(app)
      .patch(`/api/admin/reviews/${reviewId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        action: "hide",
      });
    expect(hideRes.status).toBe(200);
    expect(hideRes.body.review.status).toBe("hidden");

    const publicReviewRes = await request(app).get(`/api/books/${bookId}/reviews`);
    expect(publicReviewRes.status).toBe(200);
    expect(publicReviewRes.body.reviews).toEqual([]);

    const hiddenRes = await request(app)
      .get("/api/admin/reviews")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ status: "hidden" });
    expect(hiddenRes.status).toBe(200);
    expect(hiddenRes.body.reviews).toEqual([
      expect.objectContaining({
        id: reviewId,
        status: "hidden",
        finalContent: "值得一读，推荐。",
      }),
    ]);
  });

  test("keeps default process content read-only during asset updates", async () => {
    const initialAssets = await request(app)
      .get("/api/admin/assets")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(initialAssets.status).toBe(200);

    const customProcessContent = [
      {
        id: "step-1",
        title: "自定义步骤",
        description: "这段文案不应该在恢复图片素材时被重置。",
      },
    ];

    const patchRes = await request(app)
      .patch("/api/admin/assets")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        carouselImages: initialAssets.body.carouselImages,
        processContent: customProcessContent,
      });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.processContent).toEqual(initialAssets.body.processContent);

    const bootstrapRes = await request(app)
      .post("/api/admin/assets/bootstrap-from-materials")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(bootstrapRes.status).toBe(200);
    expect(bootstrapRes.body.processContent).toEqual(initialAssets.body.processContent);
  });
});
