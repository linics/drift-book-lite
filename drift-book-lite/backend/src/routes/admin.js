const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { adminUsernames, defaultSiteAssetsDir } = require("../lib/env");
const { signAdminToken, verifyPassword } = require("../utils/auth");
const { requireAdmin } = require("../middleware/adminAuth");
const { uploadMemory, uploadSiteAsset } = require("../middleware/uploads");
const {
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
} = require("../services/library");
const {
  getSiteAsset,
  updateSiteAsset,
  syncDefaultSiteAssets,
  uploadLogoAsset,
  uploadCarouselAsset,
} = require("../services/assets");
const { importDefaultSensitiveWords } = require("../services/defaultSensitiveWords");
const { HttpError } = require("../utils/httpError");

const router = express.Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const updateBookSchema = z.object({
  title: z.string().trim().min(1).optional(),
  author: z.string().trim().min(1).optional(),
  publishPlace: z.string().trim().optional().nullable(),
  publisher: z.string().trim().min(1).optional(),
  publishDateText: z.string().trim().optional().nullable(),
  barcode: z.string().trim().optional().nullable(),
  subtitle: z.string().trim().optional().nullable(),
});

const importSchema = z.object({
  catalogName: z.string().trim().min(1).default("未命名目录"),
  importMode: z.enum(["create_only", "upsert"]).default("create_only"),
});

const updateReviewSchema = z.object({
  action: z.enum(["approve", "hide"]),
  finalContent: z.string().trim().min(1).max(500).optional(),
});

const updateAssetSchema = z.object({
  schoolLogoPath: z.string().trim().optional().nullable(),
  carouselImages: z
    .array(
      z.object({
        id: z.string(),
        path: z.string(),
        enabled: z.boolean(),
        sortOrder: z.number(),
        label: z.string(),
      })
    )
    .optional(),
});

const sensitiveWordSchema = z.object({
  word: z.string().trim().min(1).max(50),
});

const featuredReviewsSchema = z.object({
  reviewIds: z.array(z.number().int().positive()).max(10),
});

function toAdminAssetResponse(assets) {
  return {
    ...assets,
    defaultSiteAssetsDir,
  };
}

router.post("/login", async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);
  const adminUser = await prisma.adminUser.findUnique({ where: { username } });
  if (!adminUser || !adminUsernames.includes(username)) {
    throw new HttpError(401, "账号或密码错误");
  }

  const isValid = await verifyPassword(password, adminUser.passwordHash);
  if (!isValid) {
    throw new HttpError(401, "账号或密码错误");
  }

  res.json({
    token: signAdminToken(adminUser),
    user: { id: adminUser.id, username: adminUser.username },
  });
});

router.use(requireAdmin);

router.patch("/me/password", async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const adminUser = await prisma.adminUser.findUnique({
    where: { id: Number(req.adminUser.sub) },
  });
  if (!adminUser || !adminUsernames.includes(adminUser.username)) {
    throw new HttpError(401, "登录已失效，请重新登录");
  }

  const currentPasswordValid = await verifyPassword(currentPassword, adminUser.passwordHash);
  if (!currentPasswordValid) {
    throw new HttpError(401, "当前密码错误");
  }

  const newPasswordMatchesCurrent = await verifyPassword(newPassword, adminUser.passwordHash);
  if (newPasswordMatchesCurrent) {
    throw new HttpError(400, "新密码不能与当前密码相同");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.adminUser.update({
    where: { id: adminUser.id },
    data: {
      passwordHash,
      passwordVersion: { increment: 1 },
    },
  });

  res.json({ message: "密码已更新，请重新登录" });
});

router.get("/books", async (req, res) => {
  const result = await listAdminBooks({
    query: req.query.q,
    page: req.query.page,
    pageSize: req.query.pageSize,
  });
  res.json(result);
});

router.patch("/books/:bookId", async (req, res) => {
  const payload = updateBookSchema.parse(req.body);
  const book = await updateBook(req.params.bookId, payload);
  res.json({ book });
});

router.post("/imports", uploadMemory.single("file"), async (req, res) => {
  if (!req.file) {
    throw new HttpError(400, "缺少导入文件");
  }
  const payload = importSchema.parse(req.body);
  const batch = await importCatalogFromCsv(req.file.buffer, {
    fileName: decodeUploadFilename(req.file.originalname),
    catalogName: payload.catalogName,
    importMode: payload.importMode,
    adminUserId: req.adminUser.sub,
  });
  res.status(201).json({
    batch: {
      id: batch.id,
      fileName: batch.fileName,
      catalogName: batch.catalogName,
      importMode: batch.importMode,
      status: batch.status,
      totalRows: batch.totalRows,
      successRows: batch.successRows,
      failedRows: batch.failedRows,
    },
  });
});

router.get("/imports", async (_req, res) => {
  const batches = await listImportBatches();
  res.json({ batches });
});

router.get("/imports/:batchId", async (req, res) => {
  const batch = await getImportBatchById(req.params.batchId);
  res.json({ batch });
});

router.delete("/imports/:batchId", async (req, res) => {
  const result = await deleteImportBatch(req.params.batchId);
  res.json(result);
});

router.get("/reviews", async (req, res) => {
  const reviews = await listAdminReviews({
    status: req.query.status,
    bookId: req.query.bookId,
  });
  res.json({ reviews });
});

router.get("/reviews/export", async (_req, res) => {
  const csv = await exportAdminReviewsCsv();
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="reviews-${stamp}.csv"`
  );
  res.send(csv);
});

router.patch("/reviews/:reviewId", async (req, res) => {
  const payload = updateReviewSchema.parse(req.body);
  const review = await updateReview(req.params.reviewId, req.adminUser.sub, payload);
  res.json({ review });
});

router.get("/featured-reviews", async (_req, res) => {
  const reviews = await getFeaturedReviews();
  res.json({ reviews });
});

router.put("/featured-reviews", async (req, res) => {
  const payload = featuredReviewsSchema.parse(req.body);
  const reviews = await updateFeaturedReviews(payload.reviewIds);
  res.json({ reviews });
});

router.get("/sensitive-words", async (_req, res) => {
  const result = await listSensitiveWords({
    query: _req.query.q,
    page: _req.query.page,
    pageSize: _req.query.pageSize,
  });
  res.json(result);
});

router.post("/sensitive-words/import-defaults", async (_req, res) => {
  const result = await importDefaultSensitiveWords();
  res.json(result);
});

router.post("/sensitive-words", async (req, res) => {
  const payload = sensitiveWordSchema.parse(req.body);
  const word = await createSensitiveWord(payload.word);
  res.status(201).json({ word });
});

router.patch("/sensitive-words/:wordId", async (req, res) => {
  const payload = sensitiveWordSchema.parse(req.body);
  const word = await updateSensitiveWord(req.params.wordId, payload.word);
  res.json({ word });
});

router.delete("/sensitive-words/:wordId", async (req, res) => {
  const word = await deleteSensitiveWord(req.params.wordId);
  res.json({ word });
});

router.get("/assets", async (_req, res) => {
  const assets = await getSiteAsset();
  res.json(toAdminAssetResponse(assets));
});

router.post("/assets/reload-default-assets", async (_req, res) => {
  const assets = await syncDefaultSiteAssets({ mode: "replace-homepage-images" });
  res.json(toAdminAssetResponse(assets));
});

router.post("/assets/logo", uploadSiteAsset.single("file"), async (req, res) => {
  const assets = await uploadLogoAsset(req.file);
  res.status(201).json({ asset: assets });
});

router.post("/assets/carousel", uploadSiteAsset.single("file"), async (req, res) => {
  const asset = await uploadCarouselAsset(req.file, req.body.label);
  res.status(201).json({ asset });
});

router.patch("/assets", async (req, res) => {
  const payload = updateAssetSchema.parse(req.body);
  const assets = await updateSiteAsset(payload);
  res.json(toAdminAssetResponse(assets));
});

module.exports = { adminRouter: router };
