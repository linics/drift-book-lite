const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../lib/env");

function signAdminToken(adminUser) {
  return jwt.sign(
    {
      sub: adminUser.id,
      username: adminUser.username,
      passwordVersion: adminUser.passwordVersion,
      role: "admin",
    },
    jwtSecret,
    { expiresIn: "24h" }
  );
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = { signAdminToken, verifyPassword };
