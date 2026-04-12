const fs = require("fs");
const os = require("os");
const path = require("path");
const XLSX = require("xlsx");
const { prisma } = require("../src/lib/prisma");

function writeRoster(rows) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Roster");
  const filePath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "student-roster-")),
    "roster.xlsx"
  );
  XLSX.writeFile(workbook, filePath);
  return filePath;
}

function loadStudentRosterModule() {
  delete require.cache[require.resolve("../src/lib/env")];
  delete require.cache[require.resolve("../src/services/studentRoster")];
  return require("../src/services/studentRoster");
}

describe("student roster service", () => {
  const originalRosterPath = process.env.STUDENT_ROSTER_PATH;

  afterEach(async () => {
    process.env.STUDENT_ROSTER_PATH = originalRosterPath;
    await prisma.bookReview.deleteMany();
    await prisma.studentRoster.deleteMany();
  });

  afterAll(async () => {
    process.env.STUDENT_ROSTER_PATH = originalRosterPath;
  });

  test("parses cohort from system id", () => {
    const { parseStudentCohort } = loadStudentRosterModule();
    expect(parseStudentCohort("320250001")).toBe("2025届");
    expect(parseStudentCohort("ABC")).toBe("");
  });

  test("upserts roster rows even when student roster already has data and keeps rows without id cards", async () => {
    process.env.STUDENT_ROSTER_PATH = writeRoster([
      {
        系统号: "320250001",
        姓名: "王一",
        所在班级: "高一(01)班",
        座号: "01",
        性别: "女",
        身份证号: "",
      },
      {
        系统号: "320250002",
        姓名: "王二",
        所在班级: "高一(02)班",
        座号: "02",
        性别: "男",
        身份证号: "12345678901234X5",
      },
    ]);

    await prisma.studentRoster.create({
      data: {
        systemId: "320250001",
        studentName: "旧名字",
        className: "旧班级",
        seatNumber: null,
        gender: null,
        idCardSuffix: "9999",
      },
    });

    const { ensureStudentRoster } = loadStudentRosterModule();
    await ensureStudentRoster();

    const rows = await prisma.studentRoster.findMany({
      orderBy: [{ systemId: "asc" }],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        systemId: "320250001",
        studentName: "王一",
        className: "高一(01)班",
        idCardSuffix: null,
      })
    );
    expect(rows[1]).toEqual(
      expect.objectContaining({
        systemId: "320250002",
        studentName: "王二",
        idCardSuffix: "34X5",
      })
    );
  });

  test("removes roster rows that disappeared from the latest workbook", async () => {
    process.env.STUDENT_ROSTER_PATH = writeRoster([
      {
        系统号: "320250002",
        姓名: "王二",
        所在班级: "高一(02)班",
        座号: "02",
        性别: "男",
        身份证号: "12345678901234X5",
      },
    ]);

    await prisma.studentRoster.deleteMany();
    await prisma.studentRoster.createMany({
      data: [
        {
          systemId: "320250001",
          studentName: "王一",
          className: "高一(01)班",
          seatNumber: "01",
          gender: "女",
          idCardSuffix: null,
        },
        {
          systemId: "320250002",
          studentName: "旧王二",
          className: "旧班级",
          seatNumber: null,
          gender: null,
          idCardSuffix: "9999",
        },
      ],
    });

    const { ensureStudentRoster } = loadStudentRosterModule();
    await ensureStudentRoster();

    const rows = await prisma.studentRoster.findMany({
      orderBy: [{ systemId: "asc" }],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        systemId: "320250002",
        studentName: "王二",
        className: "高一(02)班",
        idCardSuffix: "34X5",
      }),
    ]);
  });
});
