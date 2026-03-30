const express = require("express");
const cors = require("cors");
const path = require("path");
const { z } = require("zod");
const { publicRouter } = require("./routes/public");
const { adminRouter } = require("./routes/admin");
const { bootstrapSystem } = require("./services/bootstrap");
const { uploadsDir, projectRoot } = require("./lib/env");
const { HttpError } = require("./utils/httpError");

async function createApp() {
  await bootstrapSystem();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/uploads", express.static(uploadsDir));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, projectRoot });
  });

  app.use("/api", publicRouter);
  app.use("/api/admin", adminRouter);

  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "请求参数不合法",
        issues: error.issues,
      });
    }

    if (error instanceof HttpError) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error(error);
    return res.status(500).json({ message: "服务器内部错误" });
  });

  return app;
}

module.exports = { createApp };
