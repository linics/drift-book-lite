const { TextDecoder } = require("util");
const { parse: csvParse } = require("csv-parse/sync");
const path = require("path");
const XLSX = require("@e965/xlsx");
const { prisma } = require("../lib/prisma");
const { HttpError } = require("../utils/httpError");
const {
  buildStudentDisplayName,
  normalizeIdCardSuffix,
  normalizeSystemId,
  parseStudentCohort,
} = require("./studentRoster");
const { normalizeTeacherName } = require("./teacherRoster");

const SEARCH_CANDIDATE_LIMIT = 80;
const SEARCH_BATCH_SIZE = 80;
const DATABASE_BATCH_SIZE = 500;
const PUBLIC_REVIEW_SEQUENCE_STATUSES = new Set(["approved"]);

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

function decodeUploadFilename(input) {
  const fileName = String(input || "").trim();
  if (!fileName) return fileName;

  try {
    const decoded = Buffer.from(fileName, "latin1").toString("utf8");
    if (decoded.includes("�")) return fileName;
    return decoded;
  } catch (_error) {
    return fileName;
  }
}

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

function chunkArray(items, size = DATABASE_BATCH_SIZE) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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

function buildCatalogBookData(record, rowNumber) {
  const bookId = String(record.bookId || "").trim();
  const title = String(record.title || "").trim();
  const author = String(record.author || "").trim();
  const publisher = String(record.publisher || "").trim();

  if (!bookId || !title) {
    throw new Error("缺少必填字段: bookId/title");
  }

  const totalCopies = parseInteger(record.totalCopies, "totalCopies", rowNumber);
  const availableCopies = parseInteger(record.availableCopies, "availableCopies", rowNumber);

  if (availableCopies > totalCopies) {
    throw new Error("available_copies 不能大于 total_copies");
  }

  return {
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
  if (extension === ".xls" || extension === ".xlsx") {
    return parseXlsxCatalog(buffer);
  }
  return parseCatalogCsv(buffer);
}

function normalizeSubtitleForGrouping(input) {
  return normalizeTitle(input || "");
}

const groupingAuthorSuffixPattern = /(编著|译注|校注|校译|主编|著|编|译|注|等)$/u;

function stripGroupingAuthorSuffixes(input) {
  let normalized = String(input || "").trim();

  while (normalized) {
    const next = normalized.replace(groupingAuthorSuffixPattern, "").trim();
    if (next === normalized) break;
    normalized = next;
  }

  return normalized;
}

function tokenizeAuthorForGrouping(input) {
  return String(input || "")
    .normalize("NFKC")
    .replace(/[，,、；;／/]+/g, "|")
    .replace(/[:：]/g, "|")
    .split("|")
    .map((item) =>
      normalizeTitle(stripGroupingAuthorSuffixes(item))
    )
    .filter(Boolean);
}

function normalizeFirstAuthorForGrouping(input) {
  const tokens = tokenizeAuthorForGrouping(input);
  if (tokens.length === 0) return "";
  return tokens[0];
}

function getFirstAuthorDisplay(input) {
  return (
    String(input || "")
      .normalize("NFKC")
      .replace(/[，,、；;／/]+/g, "|")
      .split("|")
      .map((item) => stripGroupingAuthorSuffixes(String(item || "").trim()))
      .filter(Boolean)[0] || ""
  );
}

function normalizePublisherForGrouping(input) {
  return normalizeTitle(
    String(input || "")
      .replace(/股份有限公司$/u, "")
      .replace(/有限责任公司$/u, "")
      .replace(/有限公司$/u, "")
      .replace(/出版集团$/u, "出版社")
  );
}

function buildGroupIdentity({ title, author, publisher, subtitle }) {
  return {
    titleKey: normalizeTitle(title || ""),
    authorKey: normalizeFirstAuthorForGrouping(author || ""),
    publisherKey: normalizePublisherForGrouping(publisher || ""),
    subtitleKey: normalizeSubtitleForGrouping(subtitle || ""),
  };
}

function normalizeStoredGroupIdentity(identity) {
  if (!identity || typeof identity !== "object") return null;
  const normalized = {
    titleKey: String(identity.titleKey || "").trim(),
    authorKey: String(identity.authorKey || "").trim(),
    publisherKey: String(identity.publisherKey || "").trim(),
    subtitleKey: String(identity.subtitleKey || "").trim(),
  };
  if (
    !normalized.titleKey ||
    (!normalized.authorKey && !normalized.publisherKey)
  ) {
    return null;
  }
  return normalized;
}

function shouldRespectPublisherForPublicGrouping(identity) {
  return !identity.authorKey && Boolean(identity.publisherKey);
}

function matchesGroupIdentity(book, identity, { respectPublisher = false } = {}) {
  const bookIdentity = getBookGroupIdentity(book);
  if (
    bookIdentity.titleKey !== identity.titleKey ||
    bookIdentity.authorKey !== identity.authorKey ||
    bookIdentity.subtitleKey !== identity.subtitleKey
  ) {
    return false;
  }

  if (respectPublisher && identity.publisherKey) {
    return bookIdentity.publisherKey === identity.publisherKey;
  }

  return true;
}

function encodePublicGroupId(anchorBookId, identity) {
  return Buffer.from(
    JSON.stringify({
      v: 2,
      anchorBookId,
      identity,
    })
  ).toString("base64url");
}

function decodeGroupId(groupId) {
  try {
    const parsed = JSON.parse(Buffer.from(String(groupId || ""), "base64url").toString("utf8"));
    if (
      parsed &&
      parsed.v === 2 &&
      Number.isInteger(parsed.anchorBookId) &&
      parsed.anchorBookId > 0
    ) {
      return {
        type: "public",
        anchorBookId: parsed.anchorBookId,
        identity: normalizeStoredGroupIdentity(parsed.identity),
      };
    }

    const identity = normalizeStoredGroupIdentity(parsed) || buildGroupIdentity(parsed || {});
    if (!identity.titleKey || !identity.authorKey) {
      throw new Error("invalid");
    }
    return {
      type: "legacy",
      identity,
    };
  } catch (_error) {
    throw new HttpError(400, "图书 ID 不合法");
  }
}

function isNumericPublicId(publicId) {
  return /^[1-9]\d*$/.test(String(publicId || "").trim());
}

async function getBookByNumericPublicId(publicId, client = prisma) {
  const normalized = String(publicId || "").trim();
  const book = await client.book.findUnique({
    where: { id: Number.parseInt(normalized, 10) },
  });
  if (!book) {
    throw new HttpError(404, "图书不存在");
  }
  return book;
}

async function loadGroupedBooksByIdentity(
  identity,
  client = prisma,
  { respectPublisher = false } = {}
) {
  const books = await client.book.findMany({
    where: {
      normalizedTitle: identity.titleKey,
    },
    orderBy: [{ id: "asc" }],
  });
  const matchedBooks = books.filter((book) =>
    matchesGroupIdentity(book, identity, { respectPublisher })
  );
  if (matchedBooks.length === 0) {
    throw new HttpError(404, "图书不存在");
  }

  return matchedBooks;
}

async function resolveGroupedBooksByPublicId(publicId, client = prisma) {
  const normalized = String(publicId || "").trim();
  const decoded = decodeGroupId(normalized);
  if (decoded.type === "public") {
    if (decoded.identity) {
      return loadGroupedBooksByIdentity(decoded.identity, client, {
        respectPublisher: shouldRespectPublisherForPublicGrouping(decoded.identity),
      });
    }

    const anchorBook = await client.book.findUnique({
      where: { id: decoded.anchorBookId },
    });
    if (anchorBook) {
      const identity = getBookGroupIdentity(anchorBook);
      return loadGroupedBooksByIdentity(identity, client, {
        respectPublisher: shouldRespectPublisherForPublicGrouping(identity),
      });
    }
    throw new HttpError(404, "图书不存在");
  }

  return loadGroupedBooksByIdentity(decoded.identity, client, {
    respectPublisher: Boolean(decoded.identity?.publisherKey),
  });
}

async function resolveReviewTargetByPublicId(publicId, client = prisma) {
  const normalized = String(publicId || "").trim();
  if (isNumericPublicId(normalized)) {
    const book = await getBookByNumericPublicId(normalized, client);
    const books = await loadGroupedBooksByIdentity(getBookGroupIdentity(book), client);
    return { targetBook: book, books };
  }

  const books = await resolveGroupedBooksByPublicId(normalized, client);
  return {
    targetBook: books[0],
    books,
  };
}

function getBookGroupIdentity(book) {
  return buildGroupIdentity(book);
}

function getBookPublicGroupCacheKey(book) {
  const identity = getBookGroupIdentity(book);
  const publisherKey = shouldRespectPublisherForPublicGrouping(identity)
    ? identity.publisherKey
    : "";
  return `${identity.titleKey}\u0000${identity.authorKey}\u0000${identity.subtitleKey}\u0000${publisherKey}`;
}

function aggregateBookGroup(books) {
  if (!Array.isArray(books) || books.length === 0) {
    throw new HttpError(404, "图书不存在");
  }

  const sortedBooks = [...books].sort((left, right) => left.id - right.id);
  const representative = sortedBooks[0];
  const identity = getBookGroupIdentity(representative);
  const barcodes = [...new Set(sortedBooks.map((book) => book.barcode).filter(Boolean))];
  const authors = [...new Set(sortedBooks.map((book) => book.author).filter(Boolean))];
  const publishers = [...new Set(sortedBooks.map((book) => book.publisher).filter(Boolean))];
  const publishDateTexts = [
    ...new Set(sortedBooks.map((book) => book.publishDateText).filter(Boolean)),
  ];

  return {
    id: encodePublicGroupId(representative.id, identity),
    title: representative.title,
    author: getFirstAuthorDisplay(representative.author) || representative.author,
    publishPlace:
      sortedBooks.find((book) => book.publishPlace)?.publishPlace || representative.publishPlace,
    publisher: publishers[0] || representative.publisher,
    publishDateText:
      publishDateTexts[0] || representative.publishDateText,
    subtitle:
      mergeSubtitleParts(...sortedBooks.map((book) => book.subtitle).filter(Boolean)) ||
      representative.subtitle,
    barcode: representative.barcode,
    barcodes,
    authors,
    publishers,
    publishDateTexts,
    totalCopies: sortedBooks.reduce((sum, book) => sum + (book.totalCopies || 0), 0),
    availableCopies: sortedBooks.reduce((sum, book) => sum + (book.availableCopies || 0), 0),
    groupBookIds: sortedBooks.map((book) => book.id),
    groupBookCount: sortedBooks.length,
  };
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

function serializeAggregatedBook(group) {
  return {
    id: group.id,
    title: group.title,
    author: group.author,
    publishPlace: group.publishPlace,
    publisher: group.publisher,
    publishDateText: group.publishDateText,
    authors: group.authors,
    publishers: group.publishers,
    publishDateTexts: group.publishDateTexts,
    subtitle: group.subtitle,
    barcode: group.barcode,
    barcodes: group.barcodes,
    totalCopies: group.totalCopies,
    groupBookCount: group.groupBookCount,
  };
}

function serializeSinglePublicBook(book) {
  return {
    ...serializeBookSummary(book),
    authors: book.author ? [book.author] : [],
    publishers: book.publisher ? [book.publisher] : [],
    publishDateTexts: book.publishDateText ? [book.publishDateText] : [],
    barcodes: book.barcode ? [book.barcode] : [],
    totalCopies: book.totalCopies,
    groupBookCount: 1,
  };
}

function normalizeReviewContent(input) {
  return String(input || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function serializeStudentIdentity(review) {
  if (review.identityType !== "student") return null;

  return {
    systemId: review.studentSystemId,
    studentName: review.studentName,
    cohort: parseStudentCohort(review.studentSystemId),
    className: review.studentClassName,
    idCardSuffix: review.studentIdCardSuffix,
  };
}

function serializeTeacherIdentity(review) {
  if (review.identityType !== "teacher") return null;

  return {
    teacherName: review.teacherName,
  };
}

function getReviewDisplayName(review) {
  if (review.identityType === "student") {
    return buildStudentDisplayName(review.studentSystemId, review.studentName) || review.displayName;
  }
  if (review.identityType === "teacher") {
    const teacherName = normalizeTeacherName(review.teacherName || review.displayName);
    return teacherName ? `教师 ${teacherName}` : review.displayName;
  }
  return review.displayName;
}

function serializeReviewForAdmin(review) {
  return {
    id: review.id,
    bookId: review.bookId,
    publicBookId: review.groupedBook?.id || review.bookId,
    displayName: getReviewDisplayName(review),
    originalContent: review.originalContent,
    finalContent: review.finalContent,
    status: review.status,
    identityType: review.identityType,
    studentIdentity: serializeStudentIdentity(review),
    teacherIdentity: serializeTeacherIdentity(review),
    sensitiveHit: Boolean(review.sensitiveHit),
    matchedSensitiveWords: Array.isArray(review.matchedSensitiveWords)
      ? review.matchedSensitiveWords
      : [],
    isFeatured: Boolean(review.isFeatured),
    featuredOrder: review.featuredOrder ?? null,
    sequenceNumber: review.sequenceNumber ?? null,
    reviewedAt: review.reviewedAt,
    editedAt: review.editedAt,
    hiddenAt: review.hiddenAt,
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
    groupedBook: review.groupedBook || null,
  };
}

function serializeReviewForPublic(review) {
  return {
    id: review.id,
    sequenceNumber: review.sequenceNumber ?? null,
    displayName: getReviewDisplayName(review),
    content: review.finalContent,
    createdAt: review.createdAt,
    reviewedAt: review.reviewedAt,
  };
}

function serializeFeaturedReview(review) {
  return {
    id: review.id,
    bookId: review.groupedBook?.id || review.bookId,
    bookTitle: review.groupedBook?.title || review.book?.title || "",
    displayName: getReviewDisplayName(review),
    content: review.finalContent,
    sequenceNumber: review.sequenceNumber ?? null,
    featuredOrder: review.featuredOrder ?? null,
  };
}

function buildSequenceMap(reviews, { sequenceStatuses } = {}) {
  const activeReviews = [...reviews]
    .filter((review) =>
      sequenceStatuses ? sequenceStatuses.has(review.status) : review.status !== "hidden"
    )
    .sort((left, right) => {
      const diff = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      if (diff !== 0) return diff;
      return left.id - right.id;
    });

  return new Map(activeReviews.map((review, index) => [review.id, index + 1]));
}

async function getGroupedBookMeta(book, cache = new Map()) {
  if (!book) return null;

  const cacheKey = getBookPublicGroupCacheKey(book);
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const groupedBooks = await prisma.book.findMany({
    where: {
      normalizedTitle: book.normalizedTitle,
    },
    orderBy: [{ id: "asc" }],
  });
  const aggregated = aggregateBookGroup(
    groupedBooks.filter((candidate) => getBookPublicGroupCacheKey(candidate) === cacheKey)
  );

  const meta = {
    id: aggregated.id,
    title: aggregated.title,
    author: aggregated.author,
    publisher: aggregated.publisher,
    barcodes: aggregated.barcodes,
    groupBookCount: aggregated.groupBookCount,
    totalCopies: aggregated.totalCopies,
  };
  cache.set(cacheKey, meta);
  return meta;
}

async function annotateReviews(reviews, options = {}) {
  const groupedBookCache = new Map();
  const sequenceCache = new Map();

  for (const review of reviews) {
    if (!review.book) {
      review.sequenceNumber = null;
      review.groupedBook = null;
      continue;
    }

    const cacheKey = getBookPublicGroupCacheKey(review.book);
    review.groupedBook = await getGroupedBookMeta(review.book, groupedBookCache);

    if (!sequenceCache.has(cacheKey)) {
      const groupedBooks = await loadGroupedBooksByIdentity(
        getBookGroupIdentity(review.book),
        prisma,
        {
          respectPublisher: shouldRespectPublisherForPublicGrouping(
            getBookGroupIdentity(review.book)
          ),
        }
      );
      const groupedReviews = await prisma.bookReview.findMany({
        where: {
          bookId: { in: groupedBooks.map((book) => book.id) },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      sequenceCache.set(cacheKey, buildSequenceMap(groupedReviews, options));
    }

    review.sequenceNumber = sequenceCache.get(cacheKey).get(review.id) || null;
  }

  return reviews;
}

function buildStudentSystemIdVariants(value) {
  const raw = String(value || "").trim();
  const normalized = normalizeSystemId(raw);
  return [
    raw,
    normalized,
    normalized ? `S${normalized}` : "",
    normalized ? `s${normalized}` : "",
  ].filter((item, index, items) => item && items.indexOf(item) === index);
}

async function resolveStudentIdentity({ systemId, studentName, idCardSuffix }) {
  let roster = null;
  for (const candidateSystemId of buildStudentSystemIdVariants(systemId)) {
    roster = await prisma.studentRoster.findUnique({
      where: { systemId: candidateSystemId },
    });
    if (roster) break;
  }

  if (!roster || roster.studentName !== String(studentName || "").trim()) {
    throw new HttpError(400, "学生身份校验失败");
  }

  if (roster.idCardSuffix && roster.idCardSuffix !== normalizeIdCardSuffix(idCardSuffix)) {
    throw new HttpError(400, "学生身份校验失败");
  }

  return roster;
}

async function resolveTeacherIdentity({ teacherName }) {
  const normalizedName = normalizeTeacherName(teacherName);
  if (!normalizedName) {
    throw new HttpError(400, "教师身份校验失败");
  }

  const roster = await prisma.teacherRoster.findUnique({
    where: { normalizedName },
  });

  if (!roster) {
    throw new HttpError(400, "教师身份校验失败");
  }

  return roster;
}

let _sensitiveWordsCache = null;
let _sensitiveWordsCacheAt = 0;
const SENSITIVE_WORDS_TTL = 60_000;

async function loadSensitiveWords() {
  if (_sensitiveWordsCache && Date.now() - _sensitiveWordsCacheAt < SENSITIVE_WORDS_TTL) {
    return _sensitiveWordsCache;
  }
  _sensitiveWordsCache = await prisma.sensitiveWord.findMany({ orderBy: [{ word: "asc" }] });
  _sensitiveWordsCacheAt = Date.now();
  return _sensitiveWordsCache;
}

function invalidateSensitiveWordsCache() {
  _sensitiveWordsCache = null;
}

async function detectSensitiveWords(content) {
  const sensitiveWords = await loadSensitiveWords();
  const normalizedContent = normalizeReviewContent(content);
  const matchedSensitiveWords = [
    ...new Set(
      sensitiveWords
        .filter((item) => normalizedContent.includes(item.normalizedWord))
        .map((item) => item.word)
    ),
  ];

  return {
    sensitiveHit: matchedSensitiveWords.length > 0,
    matchedSensitiveWords,
  };
}

async function ensureNoDuplicateReview({ studentSystemId, teacherName, bookIds, content }) {
  if (!studentSystemId && !teacherName) return;

  const identityWhere = studentSystemId
    ? { studentSystemId: { in: buildStudentSystemIdVariants(studentSystemId) } }
    : { identityType: "teacher", teacherName };

  const reviews = await prisma.bookReview.findMany({
    where: {
      ...identityWhere,
      bookId: { in: bookIds },
    },
    select: {
      id: true,
      originalContent: true,
    },
  });

  const target = normalizeReviewContent(content);
  const duplicated = reviews.some((review) => normalizeReviewContent(review.originalContent) === target);
  if (duplicated) {
    throw new HttpError(409, "同一本书下不能重复提交相同留言");
  }
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

function compareSearchEntries(left, right, normalizedQuery) {
  if (right.score !== left.score) return right.score - left.score;
  return Math.abs(left.book.normalizedTitle.length - normalizedQuery.length) -
    Math.abs(right.book.normalizedTitle.length - normalizedQuery.length);
}

async function collectMatchedSearchGroups(where, normalizedQuery) {
  const grouped = new Map();
  let skip = 0;

  while (grouped.size < SEARCH_CANDIDATE_LIMIT) {
    const books = await prisma.book.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip,
      take: SEARCH_BATCH_SIZE,
    });

    if (books.length === 0) break;
    skip += books.length;

    books
      .map((book) => ({
        book,
        score: scoreBook(normalizedQuery, book.normalizedTitle),
      }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((left, right) => compareSearchEntries(left, right, normalizedQuery))
      .forEach((entry) => {
        const cacheKey = getBookPublicGroupCacheKey(entry.book);
        const current = grouped.get(cacheKey);
        if (!current) {
          grouped.set(cacheKey, {
            cacheKey,
            identity: getBookGroupIdentity(entry.book),
            book: entry.book,
            score: entry.score,
          });
          return;
        }

        if (entry.score > current.score) {
          current.score = entry.score;
          current.book = entry.book;
          current.identity = getBookGroupIdentity(entry.book);
        }
      });
  }

  return [...grouped.values()];
}

async function loadCompleteGroups(groupEntries) {
  if (!Array.isArray(groupEntries) || groupEntries.length === 0) {
    return [];
  }

  const titleKeys = [...new Set(groupEntries.map((entry) => entry.identity.titleKey).filter(Boolean))];
  const candidateKeys = new Set(groupEntries.map((entry) => entry.cacheKey));
  const books = await prisma.book.findMany({
    where: {
      normalizedTitle: { in: titleKeys },
    },
    orderBy: [{ id: "asc" }],
  });

  const groupedBooks = new Map();
  for (const book of books) {
    const cacheKey = getBookPublicGroupCacheKey(book);
    if (!candidateKeys.has(cacheKey)) continue;
    const current = groupedBooks.get(cacheKey) || [];
    current.push(book);
    groupedBooks.set(cacheKey, current);
  }

  return groupEntries
    .map((entry) => ({
      score: entry.score,
      group: aggregateBookGroup(groupedBooks.get(entry.cacheKey) || [entry.book]),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.group.totalCopies !== left.group.totalCopies) {
        return right.group.totalCopies - left.group.totalCopies;
      }
      return left.group.publisher.localeCompare(right.group.publisher, "zh-CN");
    });
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

  let matchedGroups = await collectMatchedSearchGroups(primaryWhere, normalizedQuery);

  if (matchedGroups.length === 0) {
    const relaxedNeedle = normalizedQuery.slice(0, Math.max(1, Math.floor(normalizedQuery.length / 2)));
    matchedGroups = await collectMatchedSearchGroups(
      {
        normalizedTitle: {
          contains: relaxedNeedle,
        },
      },
      normalizedQuery
    );
  }

  return (await loadCompleteGroups(matchedGroups)).map((entry) => serializeAggregatedBook(entry.group));
}

async function getBookById(id) {
  if (isNumericPublicId(id)) {
    return serializeSinglePublicBook(await getBookByNumericPublicId(id));
  }

  const books = await resolveGroupedBooksByPublicId(id);
  return serializeAggregatedBook(aggregateBookGroup(books));
}

async function listApprovedReviews(bookId) {
  const { books } = await resolveReviewTargetByPublicId(bookId);
  const reviews = await prisma.bookReview.findMany({
    where: {
      bookId: { in: books.map((book) => book.id) },
      status: "approved",
    },
    include: { book: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  await annotateReviews(reviews, {
    sequenceStatuses: PUBLIC_REVIEW_SEQUENCE_STATUSES,
  });
  return reviews.map(serializeReviewForPublic);
}

async function createReview(bookId, payload) {
  const content = String(payload.content || "").trim();
  const { targetBook, books } = await resolveReviewTargetByPublicId(bookId);
  const isLegacyPayload = Boolean(payload.displayName) && !payload.systemId;

  let identityData;
  if (isLegacyPayload) {
    identityData = {
      displayName: String(payload.displayName || "").trim(),
      identityType: "legacy",
      studentRosterId: null,
      teacherRosterId: null,
      studentSystemId: null,
      studentName: null,
      studentClassName: null,
      studentIdCardSuffix: null,
      teacherName: null,
    };
  } else if (payload.identityType === "teacher") {
    const roster = await resolveTeacherIdentity(payload);
    await ensureNoDuplicateReview({
      teacherName: roster.teacherName,
      bookIds: books.map((book) => book.id),
      content,
    });
    identityData = {
      displayName: `教师 ${roster.teacherName}`,
      identityType: "teacher",
      studentRosterId: null,
      teacherRosterId: roster.id,
      studentSystemId: null,
      studentName: null,
      studentClassName: null,
      studentIdCardSuffix: null,
      teacherName: roster.teacherName,
    };
  } else {
    const roster = await resolveStudentIdentity(payload);
    await ensureNoDuplicateReview({
      studentSystemId: roster.systemId,
      bookIds: books.map((book) => book.id),
      content,
    });
    identityData = {
      displayName: buildStudentDisplayName(roster.systemId, roster.studentName),
      identityType: "student",
      studentRosterId: roster.id,
      teacherRosterId: null,
      studentSystemId: roster.systemId,
      studentName: roster.studentName,
      studentClassName: roster.className,
      studentIdCardSuffix: roster.idCardSuffix,
      teacherName: null,
    };
  }

  const moderation = await detectSensitiveWords(content);

  const review = await prisma.bookReview.create({
    data: {
      bookId: targetBook.id,
      ...identityData,
      originalContent: content,
      finalContent: content,
      sensitiveHit: moderation.sensitiveHit,
      matchedSensitiveWords: moderation.matchedSensitiveWords,
    },
  });

  return {
    id: review.id,
    status: review.status,
    createdAt: review.createdAt,
  };
}

async function importCatalogFromCsv(buffer, { fileName, catalogName, importMode, adminUserId }) {
  const normalizedFileName = decodeUploadFilename(fileName);
  const rows = parseCatalogFile(buffer, fileName);

  const batch = await prisma.importBatch.create({
    data: {
      fileName: normalizedFileName,
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
  const validRows = [];

  for (const { rowNumber, record } of rows) {
    try {
      const data = buildCatalogBookData(record, rowNumber);
      validRows.push({ rowNumber, bookId: data.bookId, data });
    } catch (error) {
      failures.push({
        rowNumber,
        bookId: record.bookId || null,
        message: error.message,
      });
    }
  }

  const existingBooksByBookId = await findExistingBooksByBookId(
    [...new Set(validRows.map((row) => row.bookId))]
  );
  let successRows = 0;

  if (importMode === "create_only") {
    const seenBookIds = new Set();
    const newRows = [];

    for (const row of validRows) {
      if (seenBookIds.has(row.bookId)) {
        failures.push({
          rowNumber: row.rowNumber,
          bookId: row.bookId,
          message: `book_id ${row.bookId} 文件内重复`,
        });
        continue;
      }
      seenBookIds.add(row.bookId);

      if (existingBooksByBookId.has(row.bookId)) {
        failures.push({
          rowNumber: row.rowNumber,
          bookId: row.bookId,
          message: `book_id ${row.bookId} 已存在`,
        });
        continue;
      }

      newRows.push(row);
    }

    await createCatalogBooksInChunks(newRows, batch.id);
    successRows = newRows.length;
  } else {
    const latestRowsByBookId = new Map();
    for (const row of validRows) {
      latestRowsByBookId.set(row.bookId, row);
    }
    const latestRows = [...latestRowsByBookId.values()];
    const newRows = latestRows.filter((row) => !existingBooksByBookId.has(row.bookId));
    const updateRows = latestRows.filter((row) => existingBooksByBookId.has(row.bookId));

    await createCatalogBooksInChunks(newRows, batch.id);
    await updateCatalogBooksInChunks(updateRows, existingBooksByBookId, batch.id);
    successRows = validRows.length;
  }

  failures.sort((left, right) => left.rowNumber - right.rowNumber);
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

async function findExistingBooksByBookId(bookIds) {
  const existingBooksByBookId = new Map();
  for (const bookIdChunk of chunkArray(bookIds)) {
    if (bookIdChunk.length === 0) continue;
    const existingBooks = await prisma.book.findMany({
      where: {
        bookId: { in: bookIdChunk },
      },
      select: {
        id: true,
        bookId: true,
      },
    });
    for (const book of existingBooks) {
      existingBooksByBookId.set(book.bookId, book);
    }
  }
  return existingBooksByBookId;
}

async function createCatalogBooksInChunks(rows, batchId) {
  for (const rowChunk of chunkArray(rows)) {
    if (rowChunk.length === 0) continue;
    await prisma.book.createMany({
      data: rowChunk.map((row) => ({
        ...row.data,
        sourceImportBatchId: batchId,
      })),
    });
  }
}

async function updateCatalogBooksInChunks(rows, existingBooksByBookId, batchId) {
  for (const rowChunk of chunkArray(rows)) {
    if (rowChunk.length === 0) continue;
    await prisma.$transaction(
      rowChunk.map((row) =>
        prisma.book.update({
          where: { id: existingBooksByBookId.get(row.bookId).id },
          data: {
            ...row.data,
            sourceImportBatchId: batchId,
          },
        })
      )
    );
  }
}

async function listImportBatches() {
  const batches = await prisma.importBatch.findMany({
    orderBy: [{ createdAt: "desc" }],
  });

  return batches.map((batch) => ({
    id: batch.id,
    fileName: decodeUploadFilename(batch.fileName),
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
    fileName: decodeUploadFilename(batch.fileName),
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
  });
  const bookIds = books.map((book) => book.id);

  if (bookIds.length === 0 || !(await hasReviewsForBookIds(bookIds))) {
    await prisma.$transaction([
      ...buildDeleteBookOperations(bookIds),
      prisma.importBatch.delete({
        where: { id: batchId },
      }),
    ]);
  } else {
    const reviewSourceIdsByTargetId = await buildReviewMigrationPlanForDeletedBooks(
      books,
      bookIds
    );
    await prisma.$transaction([
      ...buildReviewMigrationOperations(reviewSourceIdsByTargetId),
      ...buildDeleteBookOperations(bookIds),
      prisma.importBatch.delete({
        where: { id: batchId },
      }),
    ]);
  }

  return {
    id: batch.id,
    catalogName: batch.catalogName,
    deletedBookCount: bookIds.length,
  };
}

async function hasReviewsForBookIds(bookIds) {
  for (const bookIdChunk of chunkArray(bookIds)) {
    if (bookIdChunk.length === 0) continue;
    const reviewCount = await prisma.bookReview.count({
      where: {
        bookId: { in: bookIdChunk },
      },
    });
    if (reviewCount > 0) return true;
  }
  return false;
}

function buildDeleteBookOperations(bookIds) {
  return chunkArray(bookIds).map((bookIdChunk) =>
    prisma.book.deleteMany({
      where: {
        id: { in: bookIdChunk },
      },
    })
  );
}

async function buildReviewMigrationPlanForDeletedBooks(books, bookIds) {
  const deletingBookIds = new Set(bookIds);
  const targetIdsByPublicGroupCacheKey = new Map();
  const groupedBooksByPublicGroupCacheKey = new Map();
  const reviewSourceIdsByTargetId = new Map();

  for (const book of books) {
    const publicGroupCacheKey = getBookPublicGroupCacheKey(book);
    let groupedBooks = groupedBooksByPublicGroupCacheKey.get(publicGroupCacheKey);

    if (!groupedBooks) {
      const identity = getBookGroupIdentity(book);
      groupedBooks = await loadGroupedBooksByIdentity(identity, prisma, {
        respectPublisher: shouldRespectPublisherForPublicGrouping(identity),
      });
      groupedBooksByPublicGroupCacheKey.set(publicGroupCacheKey, groupedBooks);
    }

    let targetBookId = targetIdsByPublicGroupCacheKey.get(publicGroupCacheKey);
    if (!targetIdsByPublicGroupCacheKey.has(publicGroupCacheKey)) {
      targetBookId =
        groupedBooks.find((candidate) => !deletingBookIds.has(candidate.id))?.id || null;
      targetIdsByPublicGroupCacheKey.set(publicGroupCacheKey, targetBookId);
    }

    const representativeBookId = groupedBooks[0]?.id;
    if (book.id !== representativeBookId) continue;
    if (!targetBookId) continue;

    const sourceIds = reviewSourceIdsByTargetId.get(targetBookId) || [];
    sourceIds.push(book.id);
    reviewSourceIdsByTargetId.set(targetBookId, sourceIds);
  }

  return reviewSourceIdsByTargetId;
}

function buildReviewMigrationOperations(reviewSourceIdsByTargetId) {
  const operations = [];
  for (const [targetBookId, sourceBookIds] of reviewSourceIdsByTargetId.entries()) {
    for (const sourceBookIdChunk of chunkArray(sourceBookIds)) {
      operations.push(
        prisma.bookReview.updateMany({
          where: {
            bookId: { in: sourceBookIdChunk },
          },
          data: {
            bookId: targetBookId,
          },
        })
      );
    }
  }
  return operations;
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

async function listAdminReviews({ status, bookId, query, page, pageSize }) {
  const paginationRequested = page !== undefined || pageSize !== undefined;
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedPageSize = Math.min(100, Math.max(1, Number(pageSize) || 20));
  const trimmedQuery = String(query || "").trim();
  const where = {};
  if (status) where.status = status;
  if (bookId) {
    const normalizedBookId = String(bookId).trim();
    if (isNumericPublicId(normalizedBookId)) {
      where.bookId = Number(normalizedBookId);
    } else {
      const { books } = await resolveReviewTargetByPublicId(normalizedBookId);
      where.bookId = { in: books.map((book) => book.id) };
    }
  }
  if (trimmedQuery) {
    where.OR = [
      { originalContent: { contains: trimmedQuery } },
      { finalContent: { contains: trimmedQuery } },
      { displayName: { contains: trimmedQuery } },
      { studentSystemId: { contains: trimmedQuery } },
      { studentName: { contains: trimmedQuery } },
      { studentClassName: { contains: trimmedQuery } },
      { teacherName: { contains: trimmedQuery } },
      {
        book: {
          is: {
            OR: [
              { title: { contains: trimmedQuery } },
              { author: { contains: trimmedQuery } },
              { publisher: { contains: trimmedQuery } },
              { bookId: { contains: trimmedQuery } },
              { barcode: { contains: trimmedQuery } },
              { callNumber: { contains: trimmedQuery } },
            ],
          },
        },
      },
    ];
  }

  const reviewQuery = {
    where,
    include: { book: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(paginationRequested
      ? {
          skip: (normalizedPage - 1) * normalizedPageSize,
          take: normalizedPageSize,
        }
      : {}),
  };

  const [total, reviews] = await prisma.$transaction([
    prisma.bookReview.count({ where }),
    prisma.bookReview.findMany(reviewQuery),
  ]);

  const effectivePageSize = paginationRequested ? normalizedPageSize : total;
  await annotateReviews(reviews);
  return {
    reviews: reviews.map(serializeReviewForAdmin),
    pagination: {
      page: paginationRequested ? normalizedPage : 1,
      pageSize: effectivePageSize,
      total,
      totalPages: paginationRequested ? Math.max(1, Math.ceil(total / normalizedPageSize)) : 1,
    },
  };
}

async function updateReview(id, adminUserId, { action, finalContent }) {
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

  const data = {
    status: action === "approve" ? "approved" : "hidden",
    finalContent: nextFinalContent,
    reviewedAt,
    reviewedById: adminUserId,
    editedAt: edited ? reviewedAt : review.editedAt,
    editedById: edited ? adminUserId : review.editedById,
    hiddenAt: action === "hide" ? reviewedAt : null,
    isFeatured: action === "hide" ? false : review.isFeatured,
    featuredOrder: action === "hide" ? null : review.featuredOrder,
  };

  const updated = await prisma.bookReview.update({
    where: { id: review.id },
    data,
    include: { book: true },
  });

  await annotateReviews([updated]);
  return serializeReviewForAdmin(updated);
}

function normalizeSensitiveWord(word) {
  return String(word || "").normalize("NFKC").trim().toLowerCase();
}

function serializeSensitiveWord(word) {
  return {
    id: word.id,
    word: word.word,
    createdAt: word.createdAt,
    updatedAt: word.updatedAt,
  };
}

async function listSensitiveWords({ query, page = 1, pageSize = 20 } = {}) {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedPageSize = Math.min(100, Math.max(1, Number(pageSize) || 20));
  const trimmedQuery = String(query || "").trim();
  const where = trimmedQuery
    ? {
        OR: [
          { word: { contains: trimmedQuery } },
          { normalizedWord: { contains: normalizeSensitiveWord(trimmedQuery) } },
        ],
      }
    : {};

  const [total, words] = await prisma.$transaction([
    prisma.sensitiveWord.count({ where }),
    prisma.sensitiveWord.findMany({
      where,
      orderBy: [{ word: "asc" }],
      skip: (normalizedPage - 1) * normalizedPageSize,
      take: normalizedPageSize,
    }),
  ]);

  return {
    words: words.map(serializeSensitiveWord),
    pagination: {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / normalizedPageSize)),
    },
  };
}

async function createSensitiveWord(word) {
  const created = await prisma.sensitiveWord.create({
    data: {
      word: String(word || "").trim(),
      normalizedWord: normalizeSensitiveWord(word),
    },
  });
  return serializeSensitiveWord(created);
}

async function updateSensitiveWord(id, word) {
  const updated = await prisma.sensitiveWord.update({
    where: { id: Number(id) },
    data: {
      word: String(word || "").trim(),
      normalizedWord: normalizeSensitiveWord(word),
    },
  });
  return serializeSensitiveWord(updated);
}

async function deleteSensitiveWord(id) {
  const removed = await prisma.sensitiveWord.delete({
    where: { id: Number(id) },
  });
  return serializeSensitiveWord(removed);
}

async function getFeaturedReviews() {
  const reviews = await prisma.bookReview.findMany({
    where: {
      status: "approved",
      isFeatured: true,
    },
    include: { book: true },
    orderBy: [{ featuredOrder: "asc" }, { reviewedAt: "desc" }, { id: "asc" }],
    take: 10,
  });

  await annotateReviews(reviews, {
    sequenceStatuses: PUBLIC_REVIEW_SEQUENCE_STATUSES,
  });
  return reviews.map(serializeFeaturedReview);
}

async function updateFeaturedReviews(reviewIds) {
  const normalizedIds = reviewIds.map((id) => Number(id));
  const reviews = await prisma.bookReview.findMany({
    where: {
      id: { in: normalizedIds },
      status: "approved",
    },
  });

  if (reviews.length !== normalizedIds.length) {
    throw new HttpError(400, "精选留言必须来自已公开内容");
  }

  const approvedReviewCount = await prisma.bookReview.count({
    where: { status: "approved" },
  });
  if (approvedReviewCount >= 3 && normalizedIds.length < 3) {
    throw new HttpError(400, "至少保留 3 条精选留言");
  }

  await prisma.$transaction(async (tx) => {
    await tx.bookReview.updateMany({
      where: { isFeatured: true },
      data: {
        isFeatured: false,
        featuredOrder: null,
      },
    });

    for (const [index, reviewId] of normalizedIds.entries()) {
      await tx.bookReview.update({
        where: { id: reviewId },
        data: {
          isFeatured: true,
          featuredOrder: index,
        },
      });
    }
  });

  return getFeaturedReviews();
}

function escapeCsvCell(value) {
  const normalized = String(value ?? "");
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, "\"\"")}"`;
  }
  return normalized;
}

function formatCsvDate(value) {
  if (!value) return "";
  return new Date(value).toISOString();
}

async function exportAdminReviewsCsv() {
  const reviews = await prisma.bookReview.findMany({
    include: { book: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  await annotateReviews(reviews);
  const serialized = reviews.map(serializeReviewForAdmin);
  const headers = [
    "评论ID",
    "状态",
    "图书标题",
    "公开显示名",
    "学号",
    "姓名",
    "届别",
    "班级",
    "身份证后四位",
    "教师姓名",
    "原文",
    "最终展示文本",
    "是否精选",
    "敏感词命中",
    "命中词",
    "创建时间",
    "审核时间",
    "隐藏时间",
  ];

  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...serialized.map((review) =>
      [
        review.id,
        review.status,
        review.groupedBook?.title || review.book?.title || "",
        review.displayName,
        review.studentIdentity?.systemId || "",
        review.studentIdentity?.studentName || "",
        review.studentIdentity?.cohort || "",
        review.studentIdentity?.className || "",
        review.studentIdentity?.idCardSuffix || "",
        review.teacherIdentity?.teacherName || "",
        review.originalContent,
        review.finalContent,
        review.isFeatured ? "是" : "否",
        review.sensitiveHit ? "是" : "否",
        review.matchedSensitiveWords.join("、"),
        formatCsvDate(review.createdAt),
        formatCsvDate(review.reviewedAt),
        formatCsvDate(review.hiddenAt),
      ]
        .map(escapeCsvCell)
        .join(",")
    ),
  ];

  return `\uFEFF${lines.join("\n")}`;
}

let _homepageCache = null;
let _homepageCacheAt = 0;
const HOMEPAGE_TTL = 30_000;

function invalidateHomepageCache() {
  _homepageCache = null;
}

async function getHomepageData() {
  if (_homepageCache && Date.now() - _homepageCacheAt < HOMEPAGE_TTL) {
    return _homepageCache;
  }
  const result = await _buildHomepageData();
  _homepageCache = result;
  _homepageCacheAt = Date.now();
  return result;
}

async function _buildHomepageData() {
  const approvedReviews = await prisma.bookReview.findMany({
    where: { status: "approved" },
    include: { book: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const groupCache = new Map();
  const activityMap = new Map();

  for (const review of approvedReviews) {
    if (!review.book) continue;
    const groupedBook = await getGroupedBookMeta(review.book, groupCache);
    const current = activityMap.get(groupedBook.id) || {
      id: groupedBook.id,
      title: groupedBook.title,
      messageCount: 0,
    };
    current.messageCount += 1;
    activityMap.set(groupedBook.id, current);
  }

  const activityBooks = [...activityMap.values()]
    .sort((left, right) => {
      if (right.messageCount !== left.messageCount) {
        return right.messageCount - left.messageCount;
      }
      return left.title.localeCompare(right.title, "zh-CN");
    })
    .slice(0, 10);

  return {
    activityBooks,
    featuredReviews: await getFeaturedReviews(),
    totalReviewCount: approvedReviews.length,
  };
}

module.exports = {
  normalizeTitle,
  normalizeSensitiveWord,
  searchBooks,
  getBookById,
  getHomepageData,
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
  getFeaturedReviews,
  updateFeaturedReviews,
  exportAdminReviewsCsv,
  listSensitiveWords,
  createSensitiveWord,
  updateSensitiveWord,
  deleteSensitiveWord,
  decodeUploadFilename,
  invalidateSensitiveWordsCache,
  invalidateHomepageCache,
};
