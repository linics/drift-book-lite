const fs = require("fs");
const XLSX = require("xlsx");
const { prisma } = require("../lib/prisma");
const { studentRosterPath } = require("../lib/env");

function normalizeCell(value) {
  return String(value ?? "").trim();
}

function normalizeIdCardSuffix(value) {
  const normalized = normalizeCell(value).toUpperCase();
  return normalized ? normalized.slice(-4) : null;
}

function parseStudentCohort(systemId) {
  const normalized = normalizeCell(systemId);
  const matched = normalized.match(/^3(\d{4})/);
  return matched ? `${matched[1]}届` : "";
}

function buildStudentDisplayName(systemId, studentName) {
  const cohort = parseStudentCohort(systemId);
  return [cohort, normalizeCell(studentName)].filter(Boolean).join(" ").trim();
}

function loadStudentRosterRows() {
  if (!studentRosterPath) {
    return [];
  }
  if (!fs.existsSync(studentRosterPath)) {
    throw new Error(`Student roster file not found: ${studentRosterPath}`);
  }

  const workbook = XLSX.readFile(studentRosterPath, { cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Student roster workbook is empty");
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: "" });
  return rows
    .map((row) => ({
      systemId: normalizeCell(row["系统号"]),
      studentName: normalizeCell(row["姓名"]),
      className: normalizeCell(row["所在班级"]),
      seatNumber: normalizeCell(row["座号"]) || null,
      gender: normalizeCell(row["性别"]) || null,
      idCardSuffix: normalizeIdCardSuffix(row["身份证号"]),
    }))
    .filter((row) => row.systemId && row.studentName && row.className);
}

async function ensureStudentRoster() {
  const rows = loadStudentRosterRows();
  if (rows.length === 0) return;

  await prisma.$transaction(
    rows.map((row) =>
      prisma.studentRoster.upsert({
        where: { systemId: row.systemId },
        update: {
          studentName: row.studentName,
          className: row.className,
          seatNumber: row.seatNumber,
          gender: row.gender,
          idCardSuffix: row.idCardSuffix,
        },
        create: row,
      })
    )
  );
}

module.exports = {
  ensureStudentRoster,
  loadStudentRosterRows,
  normalizeIdCardSuffix,
  buildStudentDisplayName,
  parseStudentCohort,
};
