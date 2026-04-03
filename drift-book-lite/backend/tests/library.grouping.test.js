const { prisma } = require("../src/lib/prisma");
const {
  normalizeTitle,
  searchBooks,
  getBookById,
  listApprovedReviews,
  listAdminReviews,
  createReview,
  deleteImportBatch,
  updateBook,
} = require("../src/services/library");

function normalizeSubtitleForLegacyId(input) {
  return normalizeTitle(input || "");
}

const legacyAuthorSuffixPattern = /(编著|译注|校注|校译|主编|著|编|译|注|等)$/u;

function stripLegacyAuthorSuffixes(input) {
  let normalized = String(input || "").trim();
  while (normalized) {
    const next = normalized.replace(legacyAuthorSuffixPattern, "").trim();
    if (next === normalized) break;
    normalized = next;
  }
  return normalized;
}

function normalizeFirstAuthorForLegacyId(input) {
  const tokens = String(input || "")
    .normalize("NFKC")
    .replace(/[，,、；;／/]+/g, "|")
    .replace(/[:：]/g, "|")
    .split("|")
    .map((item) => normalizeTitle(stripLegacyAuthorSuffixes(item)))
    .filter(Boolean);
  return tokens[0] || "";
}

function normalizePublisherForLegacyId(input) {
  return normalizeTitle(
    String(input || "")
      .replace(/股份有限公司$/u, "")
      .replace(/有限责任公司$/u, "")
      .replace(/有限公司$/u, "")
      .replace(/出版集团$/u, "出版社")
  );
}

function buildLegacyGroupedId({ title, author, publisher, subtitle }) {
  return Buffer.from(
    JSON.stringify({
      titleKey: normalizeTitle(title || ""),
      authorKey: normalizeFirstAuthorForLegacyId(author || ""),
      publisherKey: normalizePublisherForLegacyId(publisher || ""),
      subtitleKey: normalizeSubtitleForLegacyId(subtitle || ""),
    })
  ).toString("base64url");
}

async function clearData() {
  await prisma.bookReview.deleteMany();
  await prisma.book.deleteMany();
  await prisma.importBatch.deleteMany();
}

describe("library grouped book ids and aggregation", () => {
  beforeEach(async () => {
    await clearData();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("search aggregates all physical copies in a group beyond 80 rows", async () => {
    const books = [];
    for (let index = 1; index <= 85; index += 1) {
      books.push({
        bookId: `group-a-${index}`,
        title: "大合集",
        normalizedTitle: normalizeTitle("大合集"),
        author: "作者甲",
        publisher: "出版社甲",
        totalCopies: 1,
        availableCopies: 1,
      });
    }

    for (let index = 1; index <= books.length; index += 20) {
      await prisma.book.createMany({
        data: books.slice(index - 1, index + 19),
      });
    }

    const [result] = await searchBooks("大合集");
    expect(result).toEqual(
      expect.objectContaining({
        title: "大合集",
        totalCopies: 85,
        groupBookCount: 85,
      })
    );
  });

  test("search keeps collecting later groups when one group has many duplicate copies", async () => {
    const books = [];
    for (let index = 1; index <= 85; index += 1) {
      books.push({
        bookId: `group-b-${index}`,
        title: "大合集",
        normalizedTitle: normalizeTitle("大合集"),
        author: "作者甲",
        publisher: "出版社甲",
        totalCopies: 1,
        availableCopies: 1,
      });
    }

    books.push({
      bookId: "group-c-1",
      title: "大合集补编",
      normalizedTitle: normalizeTitle("大合集补编"),
      author: "作者乙",
      publisher: "出版社乙",
      totalCopies: 2,
      availableCopies: 2,
    });

    for (let index = 1; index <= books.length; index += 20) {
      await prisma.book.createMany({
        data: books.slice(index - 1, index + 19),
      });
    }

    const results = await searchBooks("大合集");
    expect(results).toHaveLength(2);
    expect(results.map((book) => book.title)).toEqual(["大合集", "大合集补编"]);
    expect(results[0]).toEqual(expect.objectContaining({ groupBookCount: 85 }));
    expect(results[1]).toEqual(expect.objectContaining({ groupBookCount: 1, totalCopies: 2 }));
  });

  test("new grouped ids stay valid after metadata edits on the anchor book", async () => {
    const [book] = await prisma.$transaction([
      prisma.book.create({
        data: {
          bookId: "stable-1",
          title: "旧标题",
          normalizedTitle: normalizeTitle("旧标题"),
          author: "作者甲",
          publisher: "出版社甲",
          totalCopies: 1,
          availableCopies: 1,
        },
      }),
      prisma.book.create({
        data: {
          bookId: "stable-2",
          title: "旧标题",
          normalizedTitle: normalizeTitle("旧标题"),
          author: "作者甲",
          publisher: "出版社甲",
          totalCopies: 1,
          availableCopies: 1,
        },
      }),
    ]);

    const [grouped] = await searchBooks("旧标题");
    expect(grouped.id).not.toMatch(/^\d+$/);

    await updateBook(book.id, {
      title: "新标题",
      author: "作者乙",
      publisher: "出版社乙",
    });

    const detail = await getBookById(grouped.id);
    expect(detail).toEqual(
      expect.objectContaining({
        title: "旧标题",
        author: "作者甲",
        publishers: ["出版社甲"],
        groupBookCount: 1,
      })
    );

    const review = await createReview(grouped.id, {
      displayName: "读者甲",
      content: "修改后链接仍应可提交评语",
    });
    expect(review.status).toBe("pending");

    const storedReview = await prisma.bookReview.findUnique({
      where: { id: review.id },
    });
    expect(storedReview).toEqual(
      expect.objectContaining({
        bookId: expect.any(Number),
      })
    );
    expect(storedReview.bookId).not.toBe(book.id);

    const reviews = await listApprovedReviews(grouped.id);
    expect(reviews).toEqual([]);
  });

  test("legacy metadata grouped ids remain readable for detail and reviews", async () => {
    await prisma.book.createMany({
      data: [
        {
          bookId: "legacy-1",
          title: "旧分组书",
          normalizedTitle: normalizeTitle("旧分组书"),
          author: "作者甲",
          publisher: "出版社甲",
          totalCopies: 1,
          availableCopies: 1,
        },
        {
          bookId: "legacy-2",
          title: "旧分组书",
          normalizedTitle: normalizeTitle("旧分组书"),
          author: "作者甲、作者乙",
          publisher: "出版社甲",
          totalCopies: 1,
          availableCopies: 0,
        },
      ],
    });

    const legacyId = buildLegacyGroupedId({
      title: "旧分组书",
      author: "作者甲",
      publisher: "出版社甲",
      subtitle: null,
    });

    const detail = await getBookById(legacyId);
    expect(detail).toEqual(
      expect.objectContaining({
        title: "旧分组书",
        groupBookCount: 2,
        totalCopies: 2,
      })
    );

    const review = await createReview(legacyId, {
      displayName: "旧链接读者",
      content: "旧格式分组链接仍可提交评语",
    });
    expect(review.status).toBe("pending");

    const storedReview = await prisma.bookReview.findUnique({
      where: { id: review.id },
    });
    expect(storedReview).toEqual(
      expect.objectContaining({
        displayName: "旧链接读者",
      })
    );
  });

  test("legacy grouped ids keep publisher-specific boundaries", async () => {
    await prisma.book.createMany({
      data: [
        {
          bookId: "legacy-publisher-1",
          title: "出版社边界书",
          normalizedTitle: normalizeTitle("出版社边界书"),
          author: "作者甲",
          publisher: "出版社甲",
          totalCopies: 1,
          availableCopies: 1,
        },
        {
          bookId: "legacy-publisher-2",
          title: "出版社边界书",
          normalizedTitle: normalizeTitle("出版社边界书"),
          author: "作者甲",
          publisher: "出版社乙",
          totalCopies: 1,
          availableCopies: 1,
        },
      ],
    });

    const legacyId = buildLegacyGroupedId({
      title: "出版社边界书",
      author: "作者甲",
      publisher: "出版社甲",
      subtitle: null,
    });

    const detail = await getBookById(legacyId);
    expect(detail).toEqual(
      expect.objectContaining({
        title: "出版社边界书",
        publishers: ["出版社甲"],
        groupBookCount: 1,
        totalCopies: 1,
      })
    );
  });

  test("stable grouped ids still resolve after deleting the anchor import batch when siblings survive", async () => {
    const batchOne = await prisma.importBatch.create({
      data: {
        fileName: "batch-one.csv",
        catalogName: "批次一",
        importMode: "create_only",
        status: "completed",
        totalRows: 1,
        successRows: 1,
        failedRows: 0,
        failures: [],
      },
    });
    const batchTwo = await prisma.importBatch.create({
      data: {
        fileName: "batch-two.csv",
        catalogName: "批次二",
        importMode: "create_only",
        status: "completed",
        totalRows: 1,
        successRows: 1,
        failedRows: 0,
        failures: [],
      },
    });

    await prisma.book.create({
      data: {
        bookId: "survive-1",
        title: "迁移评语书",
        normalizedTitle: normalizeTitle("迁移评语书"),
        author: "作者乙",
        publisher: "出版社乙",
        totalCopies: 1,
        availableCopies: 1,
        sourceImportBatchId: batchOne.id,
      },
    });
    await prisma.book.create({
      data: {
        bookId: "survive-2",
        title: "迁移评语书",
        normalizedTitle: normalizeTitle("迁移评语书"),
        author: "作者乙",
        publisher: "出版社乙",
        totalCopies: 1,
        availableCopies: 1,
        sourceImportBatchId: batchTwo.id,
      },
    });

    const [grouped] = await searchBooks("迁移评语书");
    await deleteImportBatch(batchOne.id);

    const detail = await getBookById(grouped.id);
    expect(detail).toEqual(
      expect.objectContaining({
        title: "迁移评语书",
        totalCopies: 1,
        groupBookCount: 1,
      })
    );
  });

  test("grouped primary author display strips role suffixes", async () => {
    await prisma.book.createMany({
      data: [
        {
          bookId: "suffix-1",
          title: "组合尾缀书",
          normalizedTitle: normalizeTitle("组合尾缀书"),
          author: "作者甲等著",
          publisher: "出版社甲",
          totalCopies: 1,
          availableCopies: 1,
        },
        {
          bookId: "suffix-2",
          title: "组合尾缀书",
          normalizedTitle: normalizeTitle("组合尾缀书"),
          author: "作者甲",
          publisher: "出版社甲",
          totalCopies: 1,
          availableCopies: 1,
        },
      ],
    });

    const [result] = await searchBooks("组合尾缀书");
    expect(result).toEqual(
      expect.objectContaining({
        title: "组合尾缀书",
        author: "作者甲",
      })
    );
  });

  test("authorless same-title books keep publisher boundaries in public grouping", async () => {
    await prisma.book.createMany({
      data: [
        {
          bookId: "authorless-1",
          title: "无作者同名书",
          normalizedTitle: normalizeTitle("无作者同名书"),
          author: "",
          publisher: "出版社甲",
          totalCopies: 1,
          availableCopies: 1,
        },
        {
          bookId: "authorless-2",
          title: "无作者同名书",
          normalizedTitle: normalizeTitle("无作者同名书"),
          author: "",
          publisher: "出版社乙",
          totalCopies: 2,
          availableCopies: 2,
        },
      ],
    });

    const results = await searchBooks("无作者同名书");
    expect(results).toHaveLength(2);
    expect(results.map((book) => book.publishers)).toEqual(
      expect.arrayContaining([["出版社甲"], ["出版社乙"]])
    );

    const detailPublishers = await Promise.all(results.map((book) => getBookById(book.id)));
    expect(detailPublishers.map((book) => book.publishers)).toEqual(
      expect.arrayContaining([["出版社甲"], ["出版社乙"]])
    );
  });

  test("authorless grouped ids remain readable after deleting the anchor batch", async () => {
    const batchOne = await prisma.importBatch.create({
      data: {
        fileName: "authorless-one.csv",
        catalogName: "无作者批次一",
        importMode: "create_only",
        status: "completed",
        totalRows: 1,
        successRows: 1,
        failedRows: 0,
        failures: [],
      },
    });
    const batchTwo = await prisma.importBatch.create({
      data: {
        fileName: "authorless-two.csv",
        catalogName: "无作者批次二",
        importMode: "create_only",
        status: "completed",
        totalRows: 1,
        successRows: 1,
        failedRows: 0,
        failures: [],
      },
    });
    const batchThree = await prisma.importBatch.create({
      data: {
        fileName: "authorless-three.csv",
        catalogName: "无作者批次三",
        importMode: "create_only",
        status: "completed",
        totalRows: 1,
        successRows: 1,
        failedRows: 0,
        failures: [],
      },
    });

    await prisma.book.create({
      data: {
        bookId: "authorless-stable-1",
        title: "无作者稳定书",
        normalizedTitle: normalizeTitle("无作者稳定书"),
        author: "",
        publisher: "出版社甲",
        totalCopies: 1,
        availableCopies: 1,
        sourceImportBatchId: batchOne.id,
      },
    });
    await prisma.book.create({
      data: {
        bookId: "authorless-stable-2",
        title: "无作者稳定书",
        normalizedTitle: normalizeTitle("无作者稳定书"),
        author: "",
        publisher: "出版社乙",
        totalCopies: 1,
        availableCopies: 1,
        sourceImportBatchId: batchTwo.id,
      },
    });
    await prisma.book.create({
      data: {
        bookId: "authorless-stable-3",
        title: "无作者稳定书",
        normalizedTitle: normalizeTitle("无作者稳定书"),
        author: "",
        publisher: "出版社甲",
        totalCopies: 2,
        availableCopies: 2,
        sourceImportBatchId: batchThree.id,
      },
    });

    const results = await searchBooks("无作者稳定书");
    const publisherOneGroup = results.find((book) => book.publishers?.[0] === "出版社甲");
    expect(publisherOneGroup).toBeTruthy();

    await deleteImportBatch(batchOne.id);

    const detail = await getBookById(publisherOneGroup.id);
    expect(detail).toEqual(
      expect.objectContaining({
        title: "无作者稳定书",
        publishers: ["出版社甲"],
        totalCopies: 2,
        groupBookCount: 1,
      })
    );
  });

  test("deleting a batch migrates grouped reviews across publishers for authored public groups", async () => {
    const batchOne = await prisma.importBatch.create({
      data: {
        fileName: "group-review-one.csv",
        catalogName: "跨社评语批次一",
        importMode: "create_only",
        status: "completed",
        totalRows: 1,
        successRows: 1,
        failedRows: 0,
        failures: [],
      },
    });
    const batchTwo = await prisma.importBatch.create({
      data: {
        fileName: "group-review-two.csv",
        catalogName: "跨社评语批次二",
        importMode: "create_only",
        status: "completed",
        totalRows: 1,
        successRows: 1,
        failedRows: 0,
        failures: [],
      },
    });

    const firstBook = await prisma.book.create({
      data: {
        bookId: "group-review-1",
        title: "跨社评语书",
        normalizedTitle: normalizeTitle("跨社评语书"),
        author: "作者甲",
        publisher: "出版社甲",
        totalCopies: 1,
        availableCopies: 1,
        sourceImportBatchId: batchOne.id,
      },
    });
    const secondBook = await prisma.book.create({
      data: {
        bookId: "group-review-2",
        title: "跨社评语书",
        normalizedTitle: normalizeTitle("跨社评语书"),
        author: "作者甲",
        publisher: "出版社乙",
        totalCopies: 1,
        availableCopies: 1,
        sourceImportBatchId: batchTwo.id,
      },
    });

    const [grouped] = await searchBooks("跨社评语书");
    const review = await createReview(grouped.id, {
      displayName: "跨社读者",
      content: "公开分组评语应迁移到存活副本",
    });

    await prisma.bookReview.update({
      where: { id: review.id },
      data: {
        status: "approved",
        reviewedAt: new Date(),
      },
    });

    await deleteImportBatch(batchOne.id);

    const storedReview = await prisma.bookReview.findUnique({
      where: { id: review.id },
    });
    expect(storedReview).toEqual(
      expect.objectContaining({
        id: review.id,
        bookId: secondBook.id,
      })
    );
    expect(storedReview.bookId).not.toBe(firstBook.id);

    const reviews = await listApprovedReviews(grouped.id);
    expect(reviews).toEqual([
      expect.objectContaining({
        displayName: "跨社读者",
        content: "公开分组评语应迁移到存活副本",
      }),
    ]);

    const detail = await getBookById(grouped.id);
    expect(detail).toEqual(
      expect.objectContaining({
        title: "跨社评语书",
        publishers: ["出版社乙"],
        totalCopies: 1,
        groupBookCount: 1,
      })
    );
  });

  test("deleting a batch does not migrate numeric-copy reviews across publishers", async () => {
    const batchOne = await prisma.importBatch.create({
      data: {
        fileName: "batch-one.csv",
        catalogName: "批次一",
        importMode: "create_only",
        status: "completed",
        totalRows: 1,
        successRows: 1,
        failedRows: 0,
        failures: [],
      },
    });
    const batchTwo = await prisma.importBatch.create({
      data: {
        fileName: "batch-two.csv",
        catalogName: "批次二",
        importMode: "create_only",
        status: "completed",
        totalRows: 1,
        successRows: 1,
        failedRows: 0,
        failures: [],
      },
    });

    const survivor = await prisma.book.create({
      data: {
        bookId: "review-survivor-1",
        title: "迁移边界书",
        normalizedTitle: normalizeTitle("迁移边界书"),
        author: "作者甲",
        publisher: "出版社甲",
        totalCopies: 1,
        availableCopies: 1,
        sourceImportBatchId: batchOne.id,
      },
    });
    const deleting = await prisma.book.create({
      data: {
        bookId: "review-delete-1",
        title: "迁移边界书",
        normalizedTitle: normalizeTitle("迁移边界书"),
        author: "作者甲",
        publisher: "出版社乙",
        totalCopies: 1,
        availableCopies: 1,
        sourceImportBatchId: batchTwo.id,
      },
    });

    const review = await createReview(String(deleting.id), {
      displayName: "定向副本读者",
      content: "这条评语只属于出版社乙",
    });

    await prisma.bookReview.update({
      where: { id: review.id },
      data: {
        status: "approved",
        reviewedAt: new Date(),
      },
    });

    await deleteImportBatch(batchTwo.id);

    const storedReview = await prisma.bookReview.findUnique({
      where: { id: review.id },
    });
    expect(storedReview).toEqual(
      expect.objectContaining({
        id: review.id,
        bookId: null,
      })
    );

    expect(await listApprovedReviews(String(survivor.id))).toEqual([]);

    const adminReviews = await listAdminReviews({ status: "approved" });
    expect(adminReviews).toEqual([
      expect.objectContaining({
        id: review.id,
        book: null,
        groupedBook: null,
      }),
    ]);
  });
});
