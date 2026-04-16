const jwt = require("jsonwebtoken");
const { jwtSecret, adminUsernames } = require("../lib/env");
const { prisma } = require("../lib/prisma");
const { HttpError } = require("../utils/httpError");

async function requireAdmin(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new HttpError(401, "未授权访问"));
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, jwtSecret);
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: Number(payload.sub) },
      select: { id: true, username: true, passwordVersion: true },
    });
    if (
      !adminUser ||
      adminUser.username !== payload.username ||
      !adminUsernames.includes(adminUser.username) ||
      adminUser.passwordVersion !== payload.passwordVersion
    ) {
      return next(new HttpError(401, "登录已失效，请重新登录"));
    }
    req.adminUser = payload;
    return next();
  } catch (_error) {
    return next(new HttpError(401, "登录已失效，请重新登录"));
  }
}

module.exports = { requireAdmin };
