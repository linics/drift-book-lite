const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../lib/env");
const { HttpError } = require("../utils/httpError");

function requireAdmin(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new HttpError(401, "未授权访问"));
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, jwtSecret);
    req.adminUser = payload;
    return next();
  } catch (_error) {
    return next(new HttpError(401, "登录已失效"));
  }
}

module.exports = { requireAdmin };
