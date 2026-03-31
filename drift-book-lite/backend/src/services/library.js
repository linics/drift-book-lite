const { TextDecoder } = require("util");
const { parse: csvParse } = require("csv-parse/sync");
const path = require("path");
const XLSX = require("xlsx");
const { prisma } = require("../lib/prisma");
const { HttpError } = require("../utils/httpError");

const SEARCH_CANDIDATE_LIMIT = 80;

const requiredCatalogColumns = [
  "book_id",
  "title",
  "author",
  "publisher",
  "total_copies",
  "available_copies",
];

const xlsxHeaderAliases = {
  bookId: ["控制号", "book_id", "编号", "控制编号"],
  callNumber: ["索取号", "索书号", "分类号", "call_number"],
  title: ["正题名", "书名", "题名", "title"],
  author: ["责任者", "作者", "著者", "author"],
  publishPlace: ["出版地", "publish_place"],
  publisher: ["出版者", "出版社", "publisher"],
  publishDate: ["出版日期", "出版年", "出版时间", "publish_date"],
  isbn: ["isbn", "ISBN"],
  copyCount: ["复本数", "馆藏册数", "总册数", "copy_count", "total_copies"],
  barcode: ["条形码", "barcode"],
  subtitle: ["其他题名", "分册名", "subtitle"],
  otherTitle: ["其他题名", "other_title"],
  volumeTitle: ["分册名", "volume_title"],
};

const categoryLabels = {
  A: "马克思主义、列宁主义、毛泽东思想、邓小平理论",
  B: "哲学、宗教",
  C: "社会科学总论",
  D: "政治、法律",
  E: "军事",
  F: "经济",
  G: "文化、科学、教育、体育",
  H: "语言、文字",
  I: "文学",
  J: "艺术",
  K: "历史、地理",
  N: "自然科学总论",
  O: "数理科学和化学",
  P: "天文学、地球科学",
  Q: "生物科学",
  R: "医药、卫生",
  S: "农业科学",
  T: "工业技术",
  TB: "一般工业技术",
  TK: "能源与动力工程",
  TL: "原子能技术",
  TM: "电工技术",
  TN: "无线电电子、电信技术",
  TP: "自动化技术、计算机技术",
  TQ: "化学工业",
  TS: "轻工业、手工业",
  TU: "建筑科学",
  U: "交通运输",
  V: "航空、航天",
  X: "环境科学、安全科学",
  Z: "综合性图书",
};

function normalizeTitle(input) {
  return String(input || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{White_Space}\p{P}\p{S}]+/gu, "");
}

function countReplacementCharacters(text) {
  return [...text].filter((char) => char === "\uFFFD").length;
}

function decodeCatalogBuffer(buffer) {
  const utf8 = buffer.toString("utf8");
  if (countReplacementCharacters(utf8) === 0) {
    return utf8;
  }
  return new TextDecoder("gb18030").decode(buffer);
}

function parseInteger(value, fieldName, rowNumber) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new HttpError(400, `第 ${rowNumber} 行字段 ${fieldName} 不是有效整数`);
  }
  return parsed;
}

function parseCatalogCsv(buffer) {
  const content = decodeCatalogBuffer(buffer);
  const records = csvParse(content, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (records.length === 0) {
    throw new HttpError(400, "CSV 文件为空");
  }

  const columns = Object.keys(records[0] || {});
  const missingColumns = requiredCatalogColumns.filter((column) => !columns.includes(column));
  if (missingColumns.length > 0) {
    throw new HttpError(400, `CSV 缺少必填列: ${missingColumns.join(", ")}`);
  }

  return records.map((record, index) => ({
    rowNumber: index + 2,
    record: normalizeCsvCatalogRecord(record),
  }));
}

function pickField(record, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(record, alias)) {
      return record[alias];
    }
  }
  return undefined;
}

function buildStableBookId({ title, author, publisher, callNumber }) {
  return [
    normalizeTitle(title),
    normalizeTitle(author),
    normalizeTitle(publisher),
    normalizeTitle(callNumber),
  ].join(":");
}

function parsePublishYear(value) {
  const match = String(value || "").match(/(19\d{2}|20\d{2})/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function mergeSubtitleParts(...values) {
  const parts = [];
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized || parts.includes(normalized)) continue;
    parts.push(normalized);
  }
  return parts.length > 0 ? parts.join(" / ") : null;
}

function toPublishDecade(year) {
  if (!year) return null;
  return `${Math.floor(year / 10) * 10}年代`;
}

function deriveCategory(callNumber) {
  const match = String(callNumber || "")
    .trim()
    .toUpperCase()
    .match(/^([A-Z]+)/);

  if (!match) {
    return { categoryCode: null, categoryLabel: null };
  }

  const rawCode = match[1];
  const categoryCode =
    categoryLabels[rawCode] || categoryLabels[rawCode.slice(0, 1)] ? rawCode : rawCode.slice(0, 1);
  const categoryLabel =
    categoryLabels[rawCode] || categoryLabels[rawCode.slice(0, 1)] || null;

  return { categoryCode, categoryLabel };
}

function normalizeCsvCatalogRecord(record) {
  const title = String(record.title || "").trim();
  const author = String(record.author || "").trim() || "佚名";
  const publishPlace = String(record.publish_place || "").trim() || null;
  const publisher = String(record.publisher || "").trim() || "未知出版社";
  const publishDateText = String(record.publish_date || record.publish_year || "").trim() || null;
  const publishYear = parsePublishYear(publishDateText || "");
  const callNumber = String(record.call_number || "").trim() || null;
  const { categoryCode, categoryLabel } = deriveCategory(callNumber);
  const subtitle = mergeSubtitleParts(record.subtitle, record.other_title, record.volume_title);

  return {
    bookId: String(record.book_id || "").trim(),
    title,
    author,
    publishPlace,
    publisher,
    publishDateText,
    barcode: String(record.barcode || "").trim() || null,
    isbn: String(record.isbn || "").trim() || null,
    callNumber,
    subtitle,
    publishYear,
    publishDecade: toPublishDecade(publishYear),
    categoryCode,
    categoryLabel,
    totalCopies: record.total_copies,
    availableCopies: record.available_copies,
  };
}

function parseXlsxCatalog(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new HttpError(400, "XLSX 文件为空");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    throw new HttpError(400, "XLSX 文件为空");
  }

  const grouped = new Map();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const title = String(pickField(row, xlsxHeaderAliases.title) || "").trim();
    const author = String(pickField(row, xlsxHeaderAliases.author) || "").trim() || "佚名";
    const publishPlace =
      String(pickField(row, xlsxHeaderAliases.publishPlace) || "").trim() || null;
    const publisher =
      String(pickField(row, xlsxHeaderAliases.publisher) || "").trim() || "未知出版社";
    const sourceBookId = String(pickField(row, xlsxHeaderAliases.bookId) || "").trim();
    const callNumber = String(pickField(row, xlsxHeaderAliases.callNumber) || "").trim();
    const bookId = sourceBookId || buildStableBookId({ title, author, publisher, callNumber });
    const publishDateText =
      String(pickField(row, xlsxHeaderAliases.publishDate) || "").trim() || null;

    const entry = {
      rowNumber,
      bookId,
      title,
      author,
      publishPlace,
      publisher,
      publishDateText,
      isbn: String(pickField(row, xlsxHeaderAliases.isbn) || "").trim() || null,
      callNumber: callNumber || null,
      subtitle: mergeSubtitleParts(
        pickField(row, xlsxHeaderAliases.otherTitle),
        pickField(row, xlsxHeaderAliases.volumeTitle),
        pickField(row, xlsxHeaderAliases.subtitle)
      ),
      publishYear: parsePublishYear(publishDateText || ""),
      rawCopyCount: String(pickField(row, xlsxHeaderAliases.copyCount) || "").trim(),
      barcode: String(pickField(row, xlsxHeaderAliases.barcode) || "").trim() || null,
    };

    if (!grouped.has(bookId)) {
      grouped.set(bookId, {
        rowNumber,
        record: entry,
        rowCount: 0,
      });
    }

    const current = grouped.get(bookId);
    current.rowCount += 1;
    if (!current.record.publishPlace && entry.publishPlace) current.record.publishPlace = entry.publishPlace;
    if (!current.record.publishDateText && entry.publishDateText) {
      current.record.publishDateText = entry.publishDateText;
    }
    current.record.subtitle = mergeSubtitleParts(current.record.subtitle, entry.subtitle);
    if (!current.record.isbn && entry.isbn) current.record.isbn = entry.isbn;
    if (!current.record.callNumber && entry.callNumber) current.record.callNumber = entry.callNumber;
    if (!current.record.publishYear && entry.publishYear) current.record.publishYear = entry.publishYear;
    if (!current.record.barcode && entry.barcode) current.record.barcode = entry.barcode;
  });

  return [...grouped.values()].map(({ rowNumber, record, rowCount }) => {
    const declaredCopyCount = record.rawCopyCount
      ? Number.parseInt(record.rawCopyCount, 10)
      : Number.NaN;
    const totalCopies = Number.isInteger(declaredCopyCount)
      ? Math.max(declaredCopyCount, rowCount)
      : rowCount;
    const { categoryCode, categoryLabel } = deriveCategory(record.callNumber);

    return {
      rowNumber,
      record: {
        bookId: record.bookId,
        title: record.title,
        author: record.author,
        publishPlace: record.publishPlace,
        publisher: record.publisher,
        publishDateText: record.publishDateText,
        barcode: record.barcode,
        isbn: record.isbn,
        callNumber: record.callNumber,
        subtitle: record.subtitle,
        publishYear: record.publishYear,
        publishDecade: toPublishDecade(record.publishYear),
        categoryCode,
        categoryLabel,
        totalCopies,
        availableCopies: totalCopies,
      },
    };
  });
}

function parseCatalogFile(buffer, fileName = "") {
  const extension = path.extname(String(fileName || "")).toLowerCase();
  if (extension === ".xlsx") {
    return parseXlsxCatalog(buffer);
  }
  return parseCatalogCsv(buffer);
}

function serializeBookSummary(book) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    publishPlace: book.publishPlace,
    publisher: book.publisher,
    publishDateText: book.publishDateText,
    barcode: book.barcode,
    subtitle: book.subtitle,
  };
}

function serializeReviewForAdmin(review) {
  return {
    id: review.id,
    bookId: review.bookId,
    displayName: review.displayName,
    originalContent: review.originalContent,
    finalContent: review.finalContent,
    status: review.status,
    rejectionReason: review.rejectionReason,
    reviewedAt: review.reviewedAt,
    editedAt: review.editedAt,
    createdAt: review.createdAt,
    book: review.book
      ? {
          id: review.book.id,
          title: review.book.title,
          author: review.book.author,
          publishPlace: review.book.publishPlace,
          publisher: review.book.publisher,
          publishDateText: review.book.publishDateText,
          barcode: review.book.barcode,
          subtitle: review.book.subtitle,
        }
      : null,
  };
}

function serializeReviewForPublic(review) {
  return {
    id: review.id,
    displayName: review.displayName,
    content: review.finalContent,
    createdAt: review.createdAt,
    reviewedAt: review.reviewedAt,
  };
}

function parsePositiveIntId(value, resourceName) {
  const normalized = String(value ?? "").trim();
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new HttpError(400, `${resourceName} ID 不合法`);
  }

  return Number.parseInt(normalized, 10);
}

function levenshtein(left, right) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const dp = Array.from({ length: left.length + 1 }, () =>
    new Array(right.length + 1).fill(0)
  );

  for (let i = 0; i <= left.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[left.length][right.length];
}

function scoreBook(normalizedQuery, normalizedTitle) {
  if (!normalizedQuery) return Number.NEGATIVE_INFINITY;
  if (normalizedTitle === normalizedQuery) return 10000;
  if (normalizedTitle.startsWith(normalizedQuery)) {
    return 8000 - Math.abs(normalizedTitle.length - normalizedQuery.length);
  }
  if (normalizedTitle.includes(normalizedQuery)) {
    return 6000 - normalizedTitle.indexOf(normalizedQuery);
  }

  const distance = levenshtein(normalizedTitle, normalizedQuery);
  const threshold = Math.max(1, Math.floor(normalizedQuery.length / 2));
  if (distance > threshold) return Number.NEGATIVE_INFINITY;

  return 4000 - distance * 100 - Math.abs(normalizedTitle.length - normalizedQuery.length);
}

async function searchBooks(query) {
  const trimmedQuery = String(query || "").trim();
  const normalizedQuery = normalizeTitle(query);
  if (!normalizedQuery) {
    throw new HttpError(400, "请输入书名关键词");
  }

  const primaryWhere = {
    OR: [
      { normalizedTitle: { contains: normalizedQuery } },
      { title: { contains: trimmedQuery } },
      { author: { contains: trimmedQuery } },
      { publisher: { contains: trimmedQuery } },
      { callNumber: { contains: trimmedQuery } },
      { bookId: { contains: trimmedQuery } },
    ],
  };

  let books = await prisma.book.findMany({
    where: primaryWhere,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: SEARCH_CANDIDATE_LIMIT,
  });

  if (books.length === 0) {
    const relaxedNeedle = normalizedQuery.slice(0, Math.max(1, Math.floor(normalizedQuery.length / 2)));
    books = await prisma.book.findMany({
      where: {
        normalizedTitle: {
          contains: relaxedNeedle,
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: SEARCH_CANDIDATE_LIMIT,
    });
  }

  return books
    .map((book) => ({
      book,
      score: scoreBook(normalizedQuery, book.normalizedTitle),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return Math.abs(left.book.normalizedTitle.length - normalizedQuery.length) -
        Math.abs(right.book.normalizedTitle.length - normalizedQuery.length);
    })
    .map((entry) => serializeBookSummary(entry.book));
}

async function getBookById(id) {
  const bookId = parsePositiveIntId(id, "图书");
  const book = await prisma.book.findUnique({
    where: { id: bookId },
  });
  if (!book) {
    throw new HttpError(404, "图书不存在");
  }
  return serializeBookSummary(book);
}

async function listApprovedReviews(bookId) {
  const normalizedBookId = parsePositiveIntId(bookId, "图书");
  const book = await prisma.book.findUnique({
    where: { id: normalizedBookId },
    select: { id: true },
  });
  if (!book) {
    throw new HttpError(404, "图书不存在");
  }

  const reviews = await prisma.bookReview.findMany({
    where: {
      bookId: normalizedBookId,
      status: "approved",
    },
    orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
  });

  return reviews.map(serializeReviewForPublic);
}

async function createReview(bookId, { displayName, content }) {
  const normalizedBookId = parsePositiveIntId(bookId, "图书");
  const book = await prisma.book.findUnique({
    where: { id: normalizedBookId },
  });
  if (!book) {
    throw new HttpError(404, "图书不存在");
  }

  const review = await prisma.bookReview.create({
    data: {
      bookId: book.id,
      displayName,
      originalContent: content,
      finalContent: content,
    },
  });

  return {
    id: review.id,
    status: review.status,
    createdAt: review.createdAt,
  };
}

async function importCatalogFromCsv(buffer, { fileName, catalogName, importMode, adminUserId }) {
  const rows = parseCatalogFile(buffer, fileName);

  const batch = await prisma.importBatch.create({
    data: {
      fileName,
      catalogName,
      importMode,
      status: "processing",
      totalRows: rows.length,
      successRows: 0,
      failedRows: 0,
      failures: [],
      createdById: adminUserId,
    },
  });

  const failures = [];
  let successRows = 0;

  for (const { rowNumber, record } of rows) {
    try {
      const bookId = String(record.bookId || "").trim();
      const title = String(record.title || "").trim();
      const author = String(record.author || "").trim();
      const publisher = String(record.publisher || "").trim();

      if (!bookId || !title) {
        throw new Error("缺少必填字段: bookId/title");
      }

      const totalCopies = parseInteger(record.totalCopies, "totalCopies", rowNumber);
      const availableCopies = parseInteger(
        record.availableCopies,
        "availableCopies",
        rowNumber
      );

      if (availableCopies > totalCopies) {
        throw new Error("available_copies 不能大于 total_copies");
      }

      const data = {
        bookId,
        title,
        normalizedTitle: normalizeTitle(title),
        author,
        publishPlace: record.publishPlace || null,
        publisher,
        publishDateText: record.publishDateText || null,
        barcode: record.barcode || null,
        isbn: record.isbn || null,
        callNumber: record.callNumber || null,
        subtitle: record.subtitle || null,
        categoryCode: record.categoryCode || null,
        categoryLabel: record.categoryLabel || null,
        publishYear: record.publishYear || null,
        publishDecade: record.publishDecade || null,
        totalCopies,
        availableCopies,
      };

      const existing = await prisma.book.findUnique({
        where: { bookId },
      });

      if (existing && importMode === "create_only") {
        throw new Error(`book_id ${bookId} 已存在`);
      }

      if (existing) {
        await prisma.book.update({
          where: { id: existing.id },
          data: {
            ...data,
            sourceImportBatchId: batch.id,
          },
        });
      } else {
        await prisma.book.create({
          data: {
            ...data,
            sourceImportBatchId: batch.id,
          },
        });
      }

      successRows += 1;
    } catch (error) {
      failures.push({
        rowNumber,
        bookId: record.bookId || null,
        message: error.message,
      });
    }
  }

  const failedRows = failures.length;
  const status = successRows === 0 ? "failed" : failedRows > 0 ? "partial" : "completed";

  return prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      status,
      successRows,
      failedRows,
      failures,
    },
  });
}

async function listImportBatches() {
  const batches = await prisma.importBatch.findMany({
    orderBy: [{ createdAt: "desc" }],
  });

  return batches.map((batch) => ({
    id: batch.id,
    fileName: batch.fileName,
    catalogName: batch.catalogName,
    importMode: batch.importMode,
    status: batch.status,
    totalRows: batch.totalRows,
    successRows: batch.successRows,
    failedRows: batch.failedRows,
    createdAt: batch.createdAt,
  }));
}

async function getImportBatchById(id) {
  const batch = await prisma.importBatch.findUnique({
    where: { id: Number(id) },
  });
  if (!batch) {
    throw new HttpError(404, "导入批次不存在");
  }

  return {
    id: batch.id,
    fileName: batch.fileName,
    catalogName: batch.catalogName,
    importMode: batch.importMode,
    status: batch.status,
    totalRows: batch.totalRows,
    successRows: batch.successRows,
    failedRows: batch.failedRows,
    failures: Array.isArray(batch.failures) ? batch.failures : [],
    createdAt: batch.createdAt,
  };
}

function serializeAdminBook(book) {
  return {
    ...serializeBookSummary(book),
    sourceImportBatch: book.sourceImportBatch
      ? {
          id: book.sourceImportBatch.id,
          catalogName: book.sourceImportBatch.catalogName,
        }
      : null,
  };
}

async function listAdminBooks({ query, page = 1, pageSize = 20 }) {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedPageSize = Math.min(100, Math.max(1, Number(pageSize) || 20));
  const trimmedQuery = String(query || "").trim();
  const where = trimmedQuery
    ? {
        OR: [
          { title: { contains: trimmedQuery } },
          { author: { contains: trimmedQuery } },
          { publisher: { contains: trimmedQuery } },
          { bookId: { contains: trimmedQuery } },
          { callNumber: { contains: trimmedQuery } },
        ],
      }
    : {};

  const [total, books] = await prisma.$transaction([
    prisma.book.count({ where }),
    prisma.book.findMany({
      where,
      include: { sourceImportBatch: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (normalizedPage - 1) * normalizedPageSize,
      take: normalizedPageSize,
    }),
  ]);

  return {
    books: books.map(serializeAdminBook),
    pagination: {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / normalizedPageSize)),
    },
  };
}

async function deleteImportBatch(id) {
  const batchId = Number(id);
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
  });
  if (!batch) {
    throw new HttpError(404, "导入批次不存在");
  }

  const books = await prisma.book.findMany({
    where: { sourceImportBatchId: batchId },
    select: { id: true },
  });
  const bookIds = books.map((book) => book.id);

  await prisma.$transaction(async (tx) => {
    if (bookIds.length > 0) {
      await tx.book.deleteMany({
        where: { id: { in: bookIds } },
      });
    }

    await tx.importBatch.delete({
      where: { id: batchId },
    });
  });

  return {
    id: batch.id,
    catalogName: batch.catalogName,
    deletedBookCount: bookIds.length,
  };
}

async function updateBook(id, data) {
  const book = await prisma.book.findUnique({
    where: { id: Number(id) },
  });
  if (!book) {
    throw new HttpError(404, "图书不存在");
  }

  const next = { ...data };
  if (typeof next.title === "string") {
    next.normalizedTitle = normalizeTitle(next.title);
  }

  const updated = await prisma.book.update({
    where: { id: book.id },
    data: next,
  });
  return serializeBookSummary(updated);
}

async function listAdminReviews({ status, bookId }) {
  const where = {};
  if (status) where.status = status;
  if (bookId) where.bookId = Number(bookId);

  const reviews = await prisma.bookReview.findMany({
    where,
    include: { book: true },
    orderBy: [{ createdAt: "desc" }],
  });

  return reviews.map(serializeReviewForAdmin);
}

async function updateReview(id, adminUserId, { action, finalContent, rejectionReason }) {
  const review = await prisma.bookReview.findUnique({
    where: { id: Number(id) },
    include: { book: true },
  });

  if (!review) {
    throw new HttpError(404, "评语不存在");
  }

  const nextFinalContent = String(finalContent || review.finalContent).trim();
  const edited = nextFinalContent !== review.finalContent;
  const reviewedAt = new Date();

  if (action === "approve" && !nextFinalContent) {
    throw new HttpError(400, "评语内容不能为空");
  }

  let data;
  if (action === "approve") {
    data = {
      status: "approved",
      finalContent: nextFinalContent,
      reviewedAt,
      reviewedById: adminUserId,
      rejectionReason: null,
      editedAt: edited ? reviewedAt : review.editedAt,
      editedById: edited ? adminUserId : review.editedById,
    };
  } else if (action === "hide") {
    data = {
      status: "hidden",
      finalContent: nextFinalContent,
      reviewedAt,
      reviewedById: adminUserId,
      rejectionReason: null,
      editedAt: edited ? reviewedAt : review.editedAt,
      editedById: edited ? adminUserId : review.editedById,
    };
  } else {
    data = {
      status: "rejected",
      finalContent: nextFinalContent,
      reviewedAt,
      reviewedById: adminUserId,
      rejectionReason: rejectionReason || null,
      editedAt: edited ? reviewedAt : review.editedAt,
      editedById: edited ? adminUserId : review.editedById,
    };
  }

  const updated = await prisma.bookReview.update({
    where: { id: review.id },
    data,
    include: { book: true },
  });

  return serializeReviewForAdmin(updated);
}

module.exports = {
  normalizeTitle,
  searchBooks,
  getBookById,
  listApprovedReviews,
  createReview,
  importCatalogFromCsv,
  listImportBatches,
  getImportBatchById,
  listAdminBooks,
  deleteImportBatch,
  updateBook,
  listAdminReviews,
  updateReview,
};
