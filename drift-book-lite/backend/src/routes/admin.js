const express = require("express");
const path = require("path");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { adminUsername } = require("../lib/env");
const { signAdminToken, verifyPassword } = require("../utils/auth");
const { requireAdmin } = require("../middleware/adminAuth");
const { uploadImage, uploadMemory } = require("../middleware/uploads");
const {
  importPagesFromCsv,
  listAdminPages,
  getAdminPage,
  updatePage,
  listPendingMessages,
  approveMessage,
  rejectMessage,
  resetPage,
  generateQrBuffer,
} = require("../services/pages");
const {
  getSiteAsset,
  updateSiteAsset,
  bootstrapFromMaterials,
} = require("../services/assets");
const { normalizePublicPath } = require("../utils/paths");
const { HttpError } = require("../utils/httpError");

const router = express.Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const updatePageSchema = z.object({
  title: z.string().trim().min(1).optional(),
  author: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  status: z.enum(["open", "full", "inactive"]).optional(),
});

const rejectSchema = z.object({
  rejectionReason: z.string().trim().max(200).optional(),
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
    .default([]),
});

router.post("/login", async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);
  const adminUser = await prisma.adminUser.findUnique({ where: { username } });
  if (!adminUser || username !== adminUsername) {
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

router.get("/pages", async (_req, res) => {
  const pages = await listAdminPages();
  res.json({ pages });
});

router.get("/pages/:id", async (req, res) => {
  const page = await getAdminPage(req.params.id);
  res.json(page);
});

router.patch("/pages/:id", uploadImage.single("coverImage"), async (req, res) => {
  const parsed = updatePageSchema.parse(req.body);
  const data = { ...parsed };
  if (req.file) {
    data.coverImagePath = normalizePublicPath(req.file.path);
  }
  const page = await updatePage(req.params.id, data);
  res.json(page);
});

router.post("/pages/import", uploadMemory.single("file"), async (req, res) => {
  if (!req.file) {
    throw new HttpError(400, "缺少 CSV 文件");
  }
  const pages = await importPagesFromCsv(req.file.buffer);
  res.status(201).json({ count: pages.length, pages });
});

router.post("/pages/:id/qrcode", async (req, res) => {
  const buffer = await generateQrBuffer(req.params.id);
  res.setHeader("Content-Type", "image/png");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="page-${req.params.id}.png"`
  );
  res.send(buffer);
});

router.get("/messages/pending", async (_req, res) => {
  const messages = await listPendingMessages();
  res.json({ messages });
});

router.post("/messages/:id/approve", async (req, res) => {
  const message = await approveMessage(req.params.id, req.adminUser.sub);
  res.json({ message });
});

router.post("/messages/:id/reject", async (req, res) => {
  const payload = rejectSchema.parse(req.body);
  const message = await rejectMessage(
    req.params.id,
    req.adminUser.sub,
    payload.rejectionReason
  );
  res.json({ message });
});

router.post("/pages/:id/reset", async (req, res) => {
  const round = await resetPage(req.params.id);
  res.json({ round });
});

router.get("/assets", async (_req, res) => {
  const assets = await getSiteAsset();
  res.json(assets);
});

router.post("/assets/bootstrap-from-materials", async (_req, res) => {
  const assets = await bootstrapFromMaterials();
  res.json(assets);
});

router.patch("/assets", async (req, res) => {
  const payload = updateAssetSchema.parse(req.body);
  const assets = await updateSiteAsset(payload);
  res.json(assets);
});

module.exports = { adminRouter: router };
