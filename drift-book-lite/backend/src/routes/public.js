const express = require("express");
const { z } = require("zod");
const { getSiteAsset } = require("../services/assets");
const { getPublicPageByQrCode, createMessage } = require("../services/pages");

const router = express.Router();

const createMessageSchema = z.object({
  personalId: z.string().trim().min(1).max(50),
  content: z.string().trim().min(1).max(500),
});

router.get("/site-assets", async (_req, res) => {
  const assets = await getSiteAsset();
  res.json(assets);
});

router.get("/pages/:qrCode", async (req, res) => {
  const page = await getPublicPageByQrCode(req.params.qrCode);
  res.json(page);
});

router.post("/pages/:qrCode/messages", async (req, res) => {
  const payload = createMessageSchema.parse(req.body);
  const message = await createMessage(req.params.qrCode, payload);
  res.status(201).json({
    message: "留言已提交，等待管理员审核",
    data: {
      id: message.id,
      level: message.level,
      status: message.status,
    },
  });
});

module.exports = { publicRouter: router };
