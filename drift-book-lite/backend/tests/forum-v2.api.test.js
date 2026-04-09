const request = require("supertest");
const { prisma } = require("../src/lib/prisma");
const { createApp } = require("../src/app");

let app;

const studentIdentity = {
  systemId: "320250002",
  studentName: "王沁愉",
  idCardSuffix: "3225",
  className: "高一(01)班",
  maskedName: "王*",
};

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
    "FeaturedReview",
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

async function loginAs(username, password = "change-this-password") {
  const response = await request(app).post("/api/admin/login").send({
    username,
    password,
  });
  expect(response.status).toBe(200);
  return response.body.token;
}

async function importSingleBook(adminToken, title = "测试图书") {
  const response = await request(app)
    .post("/api/admin/imports")
    .set("Authorization", `Bearer ${adminToken}`)
    .field("catalogName", "论坛目录")
    .field("importMode", "create_only")
    .attach(
      "file",
      Buffer.from(
        `book_id,title,author,publisher,total_copies,available_copies\n1001,${title},作者甲,出版社甲,5,3\n`,
        "utf8"
      ),
      "forum.csv"
    );

  expect(response.status).toBe(201);

  const searchResponse = await request(app).get("/api/books/search").query({ q: title });
  expect(searchResponse.status).toBe(200);
  expect(searchResponse.body.books).toHaveLength(1);
  return searchResponse.body.books[0];
}

describe("forum v2 api", () => {
  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(async () => {
    await clearData();
    app = await createApp();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("bootstraps three admin accounts", async () => {
    await loginAs("admin1");
    await loginAs("admin2");
    await loginAs("admin3");
  });

  test("queues verified student messages and exposes approved public chain with masked identity", async () => {
    const adminToken = await loginAs("admin1");
    const book = await importSingleBook(adminToken, "接龙图书");

    const submitResponse = await request(app).post(`/api/books/${book.id}/reviews`).send({
      ...studentIdentity,
      content: "第一条接龙留言",
    });
    expect(submitResponse.status).toBe(201);
    expect(submitResponse.body.message).toContain("待审核");

    const publicPendingResponse = await request(app).get(`/api/books/${book.id}/reviews`);
    expect(publicPendingResponse.status).toBe(200);
    expect(publicPendingResponse.body.reviews).toEqual([]);

    const adminPendingResponse = await request(app)
      .get("/api/admin/reviews")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminPendingResponse.status).toBe(200);
    expect(adminPendingResponse.body.reviews).toEqual([
      expect.objectContaining({
        studentIdentity: expect.objectContaining({
          systemId: studentIdentity.systemId,
          studentName: studentIdentity.studentName,
          className: studentIdentity.className,
          idCardSuffix: studentIdentity.idCardSuffix,
        }),
        displayName: `${studentIdentity.className} ${studentIdentity.maskedName}`,
        sequenceNumber: 1,
        status: "pending",
      }),
    ]);

    const pendingReviewId = adminPendingResponse.body.reviews[0].id;

    const approveResponse = await request(app)
      .patch(`/api/admin/reviews/${pendingReviewId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        action: "approve",
        finalContent: "修改后的第一条接龙留言",
      });
    expect(approveResponse.status).toBe(200);

    const publicApprovedResponse = await request(app).get(`/api/books/${book.id}/reviews`);
    expect(publicApprovedResponse.status).toBe(200);
    expect(publicApprovedResponse.body.reviews).toEqual([
      expect.objectContaining({
        id: pendingReviewId,
        sequenceNumber: 1,
        displayName: `${studentIdentity.className} ${studentIdentity.maskedName}`,
        content: "修改后的第一条接龙留言",
      }),
    ]);
  });

  test("supports sensitive words and public leaderboards with featured reviews", async () => {
    const adminToken = await loginAs("admin1");
    const book = await importSingleBook(adminToken, "敏感词图书");

    const createWordResponse = await request(app)
      .post("/api/admin/sensitive-words")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ word: "禁词" });
    expect(createWordResponse.status).toBe(201);

    const submitResponse = await request(app).post(`/api/books/${book.id}/reviews`).send({
      ...studentIdentity,
      content: "这是一条包含禁词的留言",
    });
    expect(submitResponse.status).toBe(201);

    const adminPendingResponse = await request(app)
      .get("/api/admin/reviews")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminPendingResponse.status).toBe(200);
    expect(adminPendingResponse.body.reviews[0]).toEqual(
      expect.objectContaining({
        sensitiveHit: true,
        matchedSensitiveWords: ["禁词"],
      })
    );

    const pendingReviewId = adminPendingResponse.body.reviews[0].id;

    const approveResponse = await request(app)
      .patch(`/api/admin/reviews/${pendingReviewId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        action: "approve",
        finalContent: "管理员精选留言",
      });
    expect(approveResponse.status).toBe(200);

    const featureResponse = await request(app)
      .put("/api/admin/featured-reviews")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reviewIds: [pendingReviewId],
      });
    expect(featureResponse.status).toBe(200);

    const leaderboardResponse = await request(app).get("/api/homepage");
    expect(leaderboardResponse.status).toBe(200);
    expect(leaderboardResponse.body.activityBooks).toEqual([
      expect.objectContaining({
        id: book.id,
        title: "敏感词图书",
        messageCount: 1,
      }),
    ]);
    expect(leaderboardResponse.body.featuredReviews).toEqual([
      expect.objectContaining({
        id: pendingReviewId,
        bookId: book.id,
        bookTitle: "敏感词图书",
        content: "管理员精选留言",
      }),
    ]);
  });
});
