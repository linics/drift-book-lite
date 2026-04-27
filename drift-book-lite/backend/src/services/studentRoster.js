const fs = require("fs");
const path = require("path");
const { parse: csvParse } = require("csv-parse/sync");
const XLSX = require("@e965/xlsx");
const { prisma } = require("../lib/prisma");
const { studentRosterPath } = require("../lib/env");

function decodeRosterBuffer(buffer) {
  const utf8 = buffer.toString("utf8");
  const replacements = [...utf8].filter((c) => c === "\uFFFD").length;
  if (replacements === 0) return utf8;
  return new TextDecoder("gb18030").decode(buffer);
}

function parseRosterBuffer(buffer, filename) {
  const ext = path.extname(String(filename || "")).toLowerCase();
  if (ext === ".xls" || ext === ".xlsx") {
    const workbook = XLSX.read(buffer, { cellDates: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error("导入文件为空");
    return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: "" });
  }
  const content = decodeRosterBuffer(buffer);
  const records = csvParse(content, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  if (records.length === 0) throw new Error("导入文件为空");
  return records;
}

function normalizeCell(value) {
  return String(value ?? "").trim();
}

function normalizeSystemId(value) {
  return normalizeCell(value).replace(/^[Ss]/, "");
}

function normalizeIdCardSuffix(value) {
  const normalized = normalizeCell(value).toUpperCase();
  return normalized ? normalized.slice(-4) : null;
}

function parseStudentCohort(systemId) {
  const normalized = normalizeCell(systemId);
  const matched = normalized.match(/^3(\d{4})/);
  return matched ? `${matched[1]}级` : "";
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
    return [];
  }
  if (!fs.statSync(studentRosterPath).isFile()) {
    return [];
  }

  const workbook = XLSX.readFile(studentRosterPath, { cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Student roster workbook is empty");
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: "" });
  return rows
    .map((row) => ({
      systemId: normalizeSystemId(row["系统号"]),
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

  await prisma.$transaction(async (tx) => {
    await tx.studentRoster.deleteMany({
      where: {
        systemId: { notIn: rows.map((row) => row.systemId) },
      },
    });

    for (const row of rows) {
      await tx.studentRoster.upsert({
        where: { systemId: row.systemId },
        update: {
          studentName: row.studentName,
          className: row.className,
          seatNumber: row.seatNumber,
          gender: row.gender,
          idCardSuffix: row.idCardSuffix,
        },
        create: row,
      });
    }
  });
}

async function seedStudentRosterIfEmpty() {
  const existingCount = await prisma.studentRoster.count();
  if (existingCount > 0) return;
  await ensureStudentRoster();
}

async function importStudentRoster(buffer, filename, { mode }) {
  const rawRows = parseRosterBuffer(buffer, filename);

  const totalRows = rawRows.length;
  let successRows = 0;
  const failures = [];

  const seenIds = new Map();
  const parsed = rawRows.map((row, i) => {
    const rowNumber = i + 2;
    const systemId = normalizeSystemId(row["系统号"]);
    const studentName = normalizeCell(row["姓名"]);
    const className = normalizeCell(row["所在班级"]);

    if (!systemId || !studentName || !className) {
      return { rowNumber, systemId, error: "缺少必填字段（系统号、姓名、所在班级）" };
    }

    const entry = {
      rowNumber,
      systemId,
      error: null,
      data: {
        systemId,
        studentName,
        className,
        seatNumber: normalizeCell(row["座号"]) || null,
        gender: normalizeCell(row["性别"]) || null,
        idCardSuffix: normalizeIdCardSuffix(row["身份证号"]),
      },
    };

    if (seenIds.has(systemId)) {
      const prev = seenIds.get(systemId);
      prev.error = `文件内系统号重复（第 ${rowNumber} 行覆盖）`;
      seenIds.set(systemId, entry);
      return entry;
    }

    seenIds.set(systemId, entry);
    return entry;
  });

  for (const entry of parsed) {
    if (entry.error) {
      failures.push({ rowNumber: entry.rowNumber, systemId: entry.systemId, message: entry.error });
      continue;
    }

    const { data } = entry;
    try {
      if (mode === "create_only") {
        const existing = await prisma.studentRoster.findUnique({ where: { systemId: data.systemId } });
        if (existing) {
          failures.push({ rowNumber: entry.rowNumber, systemId: data.systemId, message: "系统号已存在" });
          continue;
        }
        await prisma.studentRoster.create({ data });
      } else {
        await prisma.studentRoster.upsert({
          where: { systemId: data.systemId },
          update: {
            studentName: data.studentName,
            className: data.className,
            seatNumber: data.seatNumber,
            gender: data.gender,
            idCardSuffix: data.idCardSuffix,
          },
          create: data,
        });
      }
      successRows++;
    } catch (err) {
      failures.push({ rowNumber: entry.rowNumber, systemId: data.systemId, message: err.message });
    }
  }

  return { totalRows, successRows, failedRows: failures.length, failures };
}

module.exports = {
  ensureStudentRoster,
  seedStudentRosterIfEmpty,
  loadStudentRosterRows,
  normalizeIdCardSuffix,
  normalizeSystemId,
  buildStudentDisplayName,
  parseStudentCohort,
  importStudentRoster,
};
