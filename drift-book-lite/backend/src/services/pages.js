const fs = require("fs");
const path = require("path");
const { parse: csvParse } = require("csv-parse/sync");
const QRCode = require("qrcode");
const { Prisma } = require("@prisma/client");
const { prisma } = require("../lib/prisma");
const { appBaseUrl, uploadsDir, workspaceRoot } = require("../lib/env");
const { HttpError } = require("../utils/httpError");
const { ensureDir, normalizePublicPath } = require("../utils/paths");

function serializeMessage(message) {
  return {
    id: message.id,
    level: message.level,
    personalId: message.personalId,
    content: message.content,
    status: message.status,
    createdAt: message.createdAt,
    reviewedAt: message.reviewedAt,
  };
}

function getNextOpenLevel(approvedCount, status, hasPending) {
  if (status !== "open") return null;
  if (hasPending) return null;
  if (approvedCount >= 10) return null;
  return approvedCount + 1;
}

async function getPublicPageByQrCode(qrCode) {
  const page = await prisma.bookPage.findUnique({ where: { qrCode } });

  if (!page) {
    throw new HttpError(404, "页面不存在");
  }

  const approvedMessages = await prisma.driftMessage.findMany({
    where: {
      pageId: page.id,
      roundNumber: page.currentRoundNumber,
      status: "approved",
      isCurrent: true,
    },
    orderBy: { level: "asc" },
  });

  const pendingMessage = await prisma.driftMessage.findFirst({
    where: {
      pageId: page.id,
      roundNumber: page.currentRoundNumber,
      status: "pending",
      isCurrent: true,
    },
  });

  return {
    id: page.id,
    qrCode: page.qrCode,
    title: page.title,
    author: page.author,
    description: page.description,
    coverImagePath: page.coverImagePath,
    status: page.status,
    currentRoundNumber: page.currentRoundNumber,
    approvedMessages: approvedMessages.map(serializeMessage),
    pendingMessage: pendingMessage ? serializeMessage(pendingMessage) : null,
    nextOpenLevel: getNextOpenLevel(
      approvedMessages.length,
      page.status,
      Boolean(pendingMessage)
    ),
  };
}

async function createMessage(qrCode, { personalId, content }) {
  return prisma.$transaction(async (tx) => {
    const page = await tx.bookPage.findUnique({ where: { qrCode } });
    if (!page) {
      throw new HttpError(404, "页面不存在");
    }
    if (page.status !== "open") {
      throw new HttpError(409, "该页面当前不可留言");
    }

    const approvedMessages = await tx.driftMessage.findMany({
      where: {
        pageId: page.id,
        roundNumber: page.currentRoundNumber,
        status: "approved",
        isCurrent: true,
      },
      orderBy: { level: "asc" },
    });

    const pendingMessage = await tx.driftMessage.findFirst({
      where: {
        pageId: page.id,
        roundNumber: page.currentRoundNumber,
        status: "pending",
        isCurrent: true,
      },
    });

    if (pendingMessage) {
      throw new HttpError(409, "当前层级已有待审核留言");
    }

    const nextLevel = approvedMessages.length + 1;
    if (nextLevel > 10) {
      throw new HttpError(409, "当前轮次已满，无法继续留言");
    }

    const round = await tx.driftRound.findUnique({
      where: {
        pageId_roundNumber: {
          pageId: page.id,
          roundNumber: page.currentRoundNumber,
        },
      },
    });

    try {
      return await tx.driftMessage.create({
        data: {
          pageId: page.id,
          roundId: round.id,
          roundNumber: page.currentRoundNumber,
          level: nextLevel,
          personalId,
          content,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new HttpError(409, "当前层级已有有效留言记录");
      }
      throw error;
    }
  });
}

function resolveOptionalFile(rawPath) {
  if (!rawPath) return null;
  const candidate = path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(workspaceRoot, rawPath);
  return fs.existsSync(candidate) ? candidate : null;
}

function copyCoverFile(filePath, qrCode) {
  ensureDir(path.join(uploadsDir, "covers"));
  const extension = path.extname(filePath) || ".jpg";
  const destination = path.join(uploadsDir, "covers", `${qrCode}${extension}`);
  fs.copyFileSync(filePath, destination);
  return normalizePublicPath(destination);
}

async function importPagesFromCsv(buffer) {
  const records = csvParse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (records.length === 0) {
    throw new HttpError(400, "CSV 文件为空");
  }

  return prisma.$transaction(async (tx) => {
    const created = [];
    for (const record of records) {
      const qrCode = record.qr_code;
      const title = record.title;
      const author = record.author;
      const description = record.description;

      if (!qrCode || !title || !author || !description) {
        throw new HttpError(400, "CSV 缺少必填字段");
      }

      const existing = await tx.bookPage.findUnique({ where: { qrCode } });
      if (existing) {
        throw new HttpError(409, `二维码 ${qrCode} 已存在`);
      }

      let coverImagePath = null;
      const coverSource = resolveOptionalFile(record.cover_image_path);
      if (coverSource) {
        coverImagePath = copyCoverFile(coverSource, qrCode);
      }

      const page = await tx.bookPage.create({
        data: {
          qrCode,
          title,
          author,
          description,
          coverImagePath,
        },
      });

      await tx.driftRound.create({
        data: {
          pageId: page.id,
          roundNumber: 1,
        },
      });

      created.push(page);
    }

    return created;
  });
}

async function listAdminPages() {
  const pages = await prisma.bookPage.findMany({
    orderBy: { createdAt: "asc" },
  });

  const enriched = [];
  for (const page of pages) {
    const approvedCount = await prisma.driftMessage.count({
      where: {
        pageId: page.id,
        roundNumber: page.currentRoundNumber,
        status: "approved",
        isCurrent: true,
      },
    });
    const pendingCount = await prisma.driftMessage.count({
      where: {
        pageId: page.id,
        roundNumber: page.currentRoundNumber,
        status: "pending",
        isCurrent: true,
      },
    });

    enriched.push({
      ...page,
      approvedCount,
      pendingCount,
    });
  }

  return enriched;
}

async function getAdminPage(id) {
  const page = await prisma.bookPage.findUnique({
    where: { id: Number(id) },
  });
  if (!page) {
    throw new HttpError(404, "页面不存在");
  }

  const currentRound = await prisma.driftRound.findUnique({
    where: {
      pageId_roundNumber: {
        pageId: page.id,
        roundNumber: page.currentRoundNumber,
      },
    },
  });

  const messages = await prisma.driftMessage.findMany({
    where: {
      pageId: page.id,
      roundNumber: page.currentRoundNumber,
      isCurrent: true,
    },
    orderBy: { level: "asc" },
  });

  return { ...page, currentRound, messages };
}

async function updatePage(id, data) {
  const pageId = Number(id);
  const page = await prisma.bookPage.findUnique({ where: { id: pageId } });
  if (!page) throw new HttpError(404, "页面不存在");

  return prisma.bookPage.update({
    where: { id: pageId },
    data,
  });
}

async function listPendingMessages() {
  return prisma.driftMessage.findMany({
    where: { status: "pending", isCurrent: true },
    orderBy: [{ createdAt: "asc" }],
    include: {
      page: true,
    },
  });
}

async function approveMessage(id, adminUserId) {
  return prisma.$transaction(async (tx) => {
    const message = await tx.driftMessage.findUnique({
      where: { id: Number(id) },
      include: { page: true, round: true },
    });
    if (!message || message.status !== "pending" || !message.isCurrent) {
      throw new HttpError(404, "待审核留言不存在");
    }

    const updated = await tx.driftMessage.update({
      where: { id: message.id },
      data: {
        status: "approved",
        reviewedAt: new Date(),
        reviewedById: adminUserId,
      },
    });

    if (message.level === 10) {
      await tx.bookPage.update({
        where: { id: message.pageId },
        data: { status: "full" },
      });
      await tx.driftRound.update({
        where: { id: message.roundId },
        data: { isLocked: true },
      });
    }

    return updated;
  });
}

async function rejectMessage(id, adminUserId, rejectionReason) {
  const message = await prisma.driftMessage.findUnique({
    where: { id: Number(id) },
  });
  if (!message || message.status !== "pending" || !message.isCurrent) {
    throw new HttpError(404, "待审核留言不存在");
  }

  return prisma.driftMessage.update({
    where: { id: message.id },
    data: {
      status: "rejected",
      reviewedAt: new Date(),
      reviewedById: adminUserId,
      rejectionReason: rejectionReason || null,
      isCurrent: false,
    },
  });
}

async function resetPage(id) {
  const pageId = Number(id);
  return prisma.$transaction(async (tx) => {
    const page = await tx.bookPage.findUnique({ where: { id: pageId } });
    if (!page) {
      throw new HttpError(404, "页面不存在");
    }

    const currentRound = await tx.driftRound.findUnique({
      where: {
        pageId_roundNumber: {
          pageId: page.id,
          roundNumber: page.currentRoundNumber,
        },
      },
    });

    await tx.driftRound.update({
      where: { id: currentRound.id },
      data: {
        isLocked: true,
        resetAt: new Date(),
      },
    });

    const nextRoundNumber = page.currentRoundNumber + 1;
    await tx.bookPage.update({
      where: { id: page.id },
      data: {
        currentRoundNumber: nextRoundNumber,
        status: "open",
      },
    });

    return tx.driftRound.create({
      data: {
        pageId: page.id,
        roundNumber: nextRoundNumber,
      },
    });
  });
}

async function generateQrBuffer(pageId) {
  const page = await prisma.bookPage.findUnique({ where: { id: Number(pageId) } });
  if (!page) {
    throw new HttpError(404, "页面不存在");
  }
  return QRCode.toBuffer(`${appBaseUrl}/pages/${page.qrCode}`, {
    width: 800,
    margin: 2,
  });
}

module.exports = {
  getPublicPageByQrCode,
  createMessage,
  importPagesFromCsv,
  listAdminPages,
  getAdminPage,
  updatePage,
  listPendingMessages,
  approveMessage,
  rejectMessage,
  resetPage,
  generateQrBuffer,
};
