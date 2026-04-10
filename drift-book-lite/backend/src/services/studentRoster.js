const fs = require("fs");
const XLSX = require("xlsx");
const { prisma } = require("../lib/prisma");
const { studentRosterPath } = require("../lib/env");

function normalizeCell(value) {
  return String(value ?? "").trim();
}

function normalizeIdCardSuffix(value) {
  const normalized = normalizeCell(value).toUpperCase();
  return normalized.slice(-4);
}

function maskStudentName(name) {
  const normalized = normalizeCell(name);
  if (!normalized) return "";
  if (normalized.length === 1) return `${normalized}*`;
  return `${normalized.slice(0, 1)}*`;
}

function buildStudentDisplayName(className, studentName) {
  return `${normalizeCell(className)} ${maskStudentName(studentName)}`.trim();
}

function loadStudentRosterRows() {
  if (!studentRosterPath) {
    throw new Error("STUDENT_ROSTER_PATH is not configured. Set this environment variable to the path of the student roster file.");
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
    .filter((row) => row.systemId && row.studentName && row.className && row.idCardSuffix);
}

async function ensureStudentRoster() {
  const currentCount = await prisma.studentRoster.count();
  if (currentCount > 0) return;

  const rows = loadStudentRosterRows();
  if (rows.length === 0) return;

  await prisma.studentRoster.createMany({
    data: rows,
  });
}

module.exports = {
  ensureStudentRoster,
  loadStudentRosterRows,
  normalizeIdCardSuffix,
  maskStudentName,
  buildStudentDisplayName,
};
