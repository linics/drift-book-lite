const fs = require("fs");
const { prisma } = require("../lib/prisma");
const { teacherRosterPath } = require("../lib/env");

function normalizeTeacherName(value) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, "").trim();
}

function loadTeacherRosterRows() {
  if (!teacherRosterPath) {
    return [];
  }
  if (!fs.existsSync(teacherRosterPath)) {
    return [];
  }
  if (!fs.statSync(teacherRosterPath).isFile()) {
    return [];
  }

  const names = fs
    .readFileSync(teacherRosterPath, "utf8")
    .split(/\r?\n/)
    .map(normalizeTeacherName)
    .filter(Boolean);
  const uniqueNames = [...new Set(names)];
  return uniqueNames.map((name) => ({
    teacherName: name,
    normalizedName: name,
  }));
}

async function ensureTeacherRoster() {
  const rows = loadTeacherRosterRows();
  if (rows.length === 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.teacherRoster.deleteMany({
      where: {
        normalizedName: { notIn: rows.map((row) => row.normalizedName) },
      },
    });

    for (const row of rows) {
      await tx.teacherRoster.upsert({
        where: { normalizedName: row.normalizedName },
        update: {
          teacherName: row.teacherName,
        },
        create: row,
      });
    }
  });
}

module.exports = {
  ensureTeacherRoster,
  loadTeacherRosterRows,
  normalizeTeacherName,
};
