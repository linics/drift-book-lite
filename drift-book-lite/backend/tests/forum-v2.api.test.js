const request = require("supertest");
const { prisma } = require("../src/lib/prisma");
const { createApp } = require("../src/app");

let app;
let nextCatalogBookId = 1000;

const studentIdentity = {
  systemId: "320250002",
  studentName: "王沁愉",
  idCardSuffix: "3225",
  className: "高一(01)班",
  cohort: "2025届",
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
  nextCatalogBookId += 1;
  const response = await request(app)
    .post("/api/admin/imports")
    .set("Authorization", `Bearer ${adminToken}`)
    .field("catalogName", "论坛目录")
    .field("importMode", "create_only")
    .attach(
      "file",
      Buffer.from(
        `book_id,title,author,publisher,total_copies,available_copies\n${nextCatalogBookId},${title},作者甲,出版社甲,5,3\n`,
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
    nextCatalogBookId = 1000;
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

  test("queues verified student messages and exposes approved public chain with cohort identity", async () => {
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
          cohort: studentIdentity.cohort,
        }),
        displayName: `${studentIdentity.cohort} ${studentIdentity.studentName}`,
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
        displayName: `${studentIdentity.cohort} ${studentIdentity.studentName}`,
        content: "修改后的第一条接龙留言",
      }),
    ]);
  });

  test("allows submission with only system id and name when the roster entry has no id card suffix", async () => {
    const adminToken = await loginAs("admin1");
    const book = await importSingleBook(adminToken, "无证件图书");

    await prisma.studentRoster.create({
      data: {
        systemId: "320260001",
        studentName: "赵同学",
        className: "高二(01)班",
        seatNumber: null,
        gender: null,
        idCardSuffix: null,
      },
    });

    const submitResponse = await request(app).post(`/api/books/${book.id}/reviews`).send({
      systemId: "320260001",
      studentName: "赵同学",
      content: "不填身份证也可以提交",
    });

    expect(submitResponse.status).toBe(201);

    const adminPendingResponse = await request(app)
      .get("/api/admin/reviews")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminPendingResponse.status).toBe(200);
    expect(adminPendingResponse.body.reviews[0]).toEqual(
      expect.objectContaining({
        displayName: "2026届 赵同学",
        studentIdentity: expect.objectContaining({
          systemId: "320260001",
          studentName: "赵同学",
          cohort: "2026届",
          idCardSuffix: null,
        }),
      })
    );
  });

  test("treats lowercase x in id card suffix as matching uppercase X in the roster", async () => {
    const book = await importSingleBook(await loginAs("admin1"), "尾号X图书");

    await prisma.studentRoster.create({
      data: {
        systemId: "320270001",
        studentName: "钱同学",
        className: "高二(02)班",
        seatNumber: null,
        gender: null,
        idCardSuffix: "12X4",
      },
    });

    const submitResponse = await request(app).post(`/api/books/${book.id}/reviews`).send({
      systemId: "320270001",
      studentName: "钱同学",
      idCardSuffix: "12x4",
      content: "尾号 x 也应当校验通过",
    });

    expect(submitResponse.status).toBe(201);
  });

  test("requires id card suffix when the roster entry has one", async () => {
    const book = await importSingleBook(await loginAs("admin1"), "证件必填图书");

    await prisma.studentRoster.create({
      data: {
        systemId: "320280001",
        studentName: "孙同学",
        className: "高二(03)班",
        seatNumber: null,
        gender: null,
        idCardSuffix: "5678",
      },
    });

    const submitResponse = await request(app).post(`/api/books/${book.id}/reviews`).send({
      systemId: "320280001",
      studentName: "孙同学",
      content: "有身份证记录时仍需校验",
    });

    expect(submitResponse.status).toBe(400);
    expect(submitResponse.body.message).toContain("学生身份校验失败");
  });

  test("exports all reviews as csv for admins", async () => {
    const adminToken = await loginAs("admin1");
    const book = await importSingleBook(adminToken, "导出图书");

    const submitResponse = await request(app).post(`/api/books/${book.id}/reviews`).send({
      ...studentIdentity,
      content: "导出测试留言",
    });
    expect(submitResponse.status).toBe(201);

    const pendingResponse = await request(app)
      .get("/api/admin/reviews")
      .set("Authorization", `Bearer ${adminToken}`);
    const reviewId = pendingResponse.body.reviews[0].id;

    const approveResponse = await request(app)
      .patch(`/api/admin/reviews/${reviewId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        action: "approve",
        finalContent: "导出测试留言",
      });
    expect(approveResponse.status).toBe(200);

    const exportResponse = await request(app)
      .get("/api/admin/reviews/export")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers["content-type"]).toContain("text/csv");
    expect(exportResponse.text.startsWith("\uFEFF")).toBe(true);
    expect(exportResponse.text).toContain("评论ID,状态,图书标题,公开显示名");
    expect(exportResponse.text).toContain("2025届 王沁愉");
    expect(exportResponse.text).toContain("导出测试留言");
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

    const secondBook = await importSingleBook(adminToken, "敏感词图书2");
    const thirdBook = await importSingleBook(adminToken, "敏感词图书3");
    const extraIds = [];

    for (const [targetBook, content] of [
      [secondBook, "管理员精选留言 2"],
      [thirdBook, "管理员精选留言 3"],
    ]) {
      const submitExtraResponse = await request(app).post(`/api/books/${targetBook.id}/reviews`).send({
        ...studentIdentity,
        content,
      });
      expect(submitExtraResponse.status).toBe(201);

      const pendingExtraResponse = await request(app)
        .get("/api/admin/reviews")
        .set("Authorization", `Bearer ${adminToken}`);
      const pendingExtraId = pendingExtraResponse.body.reviews.find(
        (review) => review.originalContent === content
      ).id;

      const approveExtraResponse = await request(app)
        .patch(`/api/admin/reviews/${pendingExtraId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          action: "approve",
          finalContent: content,
        });
      expect(approveExtraResponse.status).toBe(200);
      extraIds.push(pendingExtraId);
    }

    const featureTooFewResponse = await request(app)
      .put("/api/admin/featured-reviews")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reviewIds: [pendingReviewId, extraIds[0]],
      });
    expect(featureTooFewResponse.status).toBe(400);

    const featureSuccessResponse = await request(app)
      .put("/api/admin/featured-reviews")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reviewIds: [pendingReviewId, ...extraIds],
      });
    expect(featureSuccessResponse.status).toBe(200);

    const leaderboardResponse = await request(app).get("/api/homepage");
    expect(leaderboardResponse.status).toBe(200);
    expect(leaderboardResponse.body.activityBooks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: book.id,
          title: "敏感词图书",
          messageCount: 1,
        }),
      ])
    );
    expect(leaderboardResponse.body.featuredReviews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: pendingReviewId,
          bookId: book.id,
          bookTitle: "敏感词图书",
          content: "管理员精选留言",
        }),
      ])
    );
  });
});
