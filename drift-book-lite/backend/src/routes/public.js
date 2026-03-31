const express = require("express");
const { z } = require("zod");
const { getSiteAsset } = require("../services/assets");
const {
  searchBooks,
  getBookById,
  listApprovedReviews,
  createReview,
} = require("../services/library");

const router = express.Router();

const createReviewSchema = z.object({
  displayName: z.string().trim().min(1).max(50),
  content: z.string().trim().min(1).max(500),
});

router.get("/site-assets", async (_req, res) => {
  const assets = await getSiteAsset();
  res.json(assets);
});

router.get("/books/search", async (req, res) => {
  const books = await searchBooks(req.query.q);
  res.json({ books });
});

router.get("/books/:bookId", async (req, res) => {
  const book = await getBookById(req.params.bookId);
  res.json({ book });
});

router.get("/books/:bookId/reviews", async (req, res) => {
  const reviews = await listApprovedReviews(req.params.bookId);
  res.json({ reviews });
});

router.post("/books/:bookId/reviews", async (req, res) => {
  const payload = createReviewSchema.parse(req.body);
  const review = await createReview(req.params.bookId, payload);
  res.status(201).json({
    message: "评语已提交，等待管理员审核",
    review,
  });
});

module.exports = { publicRouter: router };
