const express = require("express");
const { z } = require("zod");
const { getSiteAsset } = require("../services/assets");
const {
  searchBooks,
  getBookById,
  getHomepageData,
  listApprovedReviews,
  createReview,
} = require("../services/library");

const router = express.Router();

const createReviewSchema = z.object({
  systemId: z.string().trim().min(1).max(20),
  studentName: z.string().trim().min(1).max(50),
  idCardSuffix: z.string().trim().min(4).max(4).optional().or(z.literal("")),
  content: z.string().trim().min(1).max(500),
});

router.get("/site-assets", async (_req, res) => {
  const assets = await getSiteAsset();
  res.set("Cache-Control", "public, max-age=3600");
  res.json(assets);
});

router.get("/homepage", async (_req, res) => {
  const data = await getHomepageData();
  res.set("Cache-Control", "public, max-age=30");
  res.json(data);
});

router.get("/books/search", async (req, res) => {
  const books = await searchBooks(req.query.q);
  res.set("Cache-Control", "public, max-age=30");
  res.json({ books });
});

router.get("/books/:bookId", async (req, res) => {
  const book = await getBookById(req.params.bookId);
  res.set("Cache-Control", "public, max-age=60");
  res.json({ book });
});

router.get("/books/:bookId/reviews", async (req, res) => {
  const reviews = await listApprovedReviews(req.params.bookId);
  res.set("Cache-Control", "public, max-age=30");
  res.json({ reviews });
});

router.post("/books/:bookId/reviews", async (req, res) => {
  const payload = createReviewSchema.parse(req.body);
  const review = await createReview(req.params.bookId, payload);
  res.status(201).json({
    message: "留言已进入待审核队列",
    review,
  });
});

module.exports = { publicRouter: router };
