const express = require("express");
const cors = require("cors");
const { z } = require("zod");
const multer = require("multer");
const { Prisma } = require("@prisma/client");
const { publicRouter } = require("./routes/public");
const { adminRouter } = require("./routes/admin");
const { bootstrapSystem } = require("./services/bootstrap");
const { uploadsDir, projectRoot, appBaseUrl, adminAppBaseUrl } = require("./lib/env");
const { HttpError } = require("./utils/httpError");

async function createApp() {
  await bootstrapSystem();

  const app = express();
  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : [appBaseUrl, adminAppBaseUrl]
  )
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(cors({ origin: [...new Set(allowedOrigins)], credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/uploads", express.static(uploadsDir));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, projectRoot });
  });

  app.use("/api", publicRouter);
  app.use("/api/admin", adminRouter);

  app.use((error, req, res, _next) => {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "请求参数不合法",
        issues: error.issues,
      });
    }

    if (error instanceof HttpError) {
      return res.status(error.status).json({ message: error.message });
    }

    if (error instanceof multer.MulterError) {
      return res.status(400).json({ message: `文件上传失败：${error.message}` });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const message =
        error.code === "P2002"
          ? "数据已存在，无法重复保存"
          : error.code === "P2003"
            ? "关联数据不存在或仍被引用，无法完成当前操作"
            : error.code === "P2000"
              ? "提交的数据过长，无法写入数据库"
              : error.code === "P2011"
                ? "存在必填字段为空，无法写入数据库"
          : error.code === "P2025"
            ? "目标记录不存在或已被删除"
            : `数据库操作失败（${error.code}）`;
      return res.status(error.code === "P2002" ? 409 : 400).json({ message });
    }

    console.error("Unhandled request error", {
      method: req.method,
      path: req.originalUrl,
      adminUserId: req.adminUser?.sub || null,
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ message: "服务器内部错误" });
  });

  return app;
}

module.exports = { createApp };
