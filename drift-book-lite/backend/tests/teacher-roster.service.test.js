const { prisma } = require("../src/lib/prisma");

describe("teacher roster service", () => {
  afterEach(async () => {
    await prisma.bookReview.deleteMany();
    await prisma.teacherRoster.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("loads the cleaned built-in teacher roster with normalized unique names", () => {
    const { loadTeacherRosterRows } = require("../src/services/teacherRoster");

    const rows = loadTeacherRosterRows();
    const normalizedNames = rows.map((row) => row.normalizedName);

    expect(rows).toEqual(
      expect.arrayContaining([
        { teacherName: "马伟", normalizedName: "马伟" },
        { teacherName: "徐华", normalizedName: "徐华" },
        { teacherName: "黄浒", normalizedName: "黄浒" },
        { teacherName: "张艳君", normalizedName: "张艳君" },
        { teacherName: "孙丽", normalizedName: "孙丽" },
        { teacherName: "洪娟娟", normalizedName: "洪娟娟" },
      ])
    );
    expect(normalizedNames).not.toContain("---------");
    expect(normalizedNames).not.toContain("在编107人");
    expect(new Set(normalizedNames).size).toBe(normalizedNames.length);
  });

  test("upserts built-in teacher roster rows and removes stale names", async () => {
    await prisma.teacherRoster.create({
      data: {
        teacherName: "旧教师",
        normalizedName: "旧教师",
      },
    });

    const { ensureTeacherRoster } = require("../src/services/teacherRoster");
    await ensureTeacherRoster();

    const stale = await prisma.teacherRoster.findUnique({
      where: { normalizedName: "旧教师" },
    });
    const teacher = await prisma.teacherRoster.findUnique({
      where: { normalizedName: "马伟" },
    });

    expect(stale).toBeNull();
    expect(teacher).toEqual(
      expect.objectContaining({
        teacherName: "马伟",
        normalizedName: "马伟",
      })
    );
  });
});
