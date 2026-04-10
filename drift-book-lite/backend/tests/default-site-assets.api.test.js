const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const { prisma } = require("../src/lib/prisma");

const APP_MODULES = [
  "../src/lib/env",
  "../src/services/assets",
  "../src/services/bootstrap",
  "../src/routes/admin",
  "../src/routes/public",
  "../src/app",
];

const defaultProcessContent = [
  {
    id: "step-1",
    title: "步骤一",
    description: "默认说明",
  },
];

function purgeAppModules() {
  for (const modulePath of APP_MODULES) {
    delete require.cache[require.resolve(modulePath)];
  }
}

async function createAppWithDefaultSiteAssetsDir(defaultSiteAssetsDir) {
  process.env.DEFAULT_SITE_ASSETS_DIR = defaultSiteAssetsDir;
  purgeAppModules();
  return require("../src/app").createApp();
}

function writeFixtureFile(dir, filename) {
  fs.writeFileSync(path.join(dir, filename), Buffer.from(filename));
}

async function clearTableIfExists(tableName) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    tableName
  );
  if (!rows.length) return;
  await prisma.$executeRawUnsafe(`DELETE FROM "${tableName}"`);
}

async function clearData() {
  const tables = [
    "SensitiveWord",
    "StudentRoster",
    "BookReview",
    "Book",
    "ImportBatch",
    "SiteAsset",
    "AdminUser",
  ];

  for (const table of tables) {
    await clearTableIfExists(table);
  }
}

describe("default site assets bootstrap", () => {
  afterEach(() => {
    delete process.env.DEFAULT_SITE_ASSETS_DIR;
    purgeAppModules();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("fills missing homepage images from the default asset directory and ignores unrelated files", async () => {
    await clearData();

    const defaultSiteAssetsDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "default-site-assets-")
    );

    try {
      writeFixtureFile(defaultSiteAssetsDir, "logo.png");
      writeFixtureFile(defaultSiteAssetsDir, "carousel-02.jpg");
      writeFixtureFile(defaultSiteAssetsDir, "carousel-01.jpg");
      writeFixtureFile(defaultSiteAssetsDir, "poster.jpg");
      writeFixtureFile(defaultSiteAssetsDir, ".hidden.jpg");

      const app = await createAppWithDefaultSiteAssetsDir(defaultSiteAssetsDir);
      const response = await request(app).get("/api/site-assets");

      expect(response.status).toBe(200);
      expect(response.body.schoolLogoPath).toContain("/uploads/site-assets/school-logo");
      expect(response.body.carouselImages).toHaveLength(2);
      expect(response.body.carouselImages.map((image) => image.label)).toEqual([
        "校园轮播 1",
        "校园轮播 2",
      ]);
    } finally {
      fs.rmSync(defaultSiteAssetsDir, { recursive: true, force: true });
    }
  });

  test("fills only missing logo during startup without replacing existing carousel images", async () => {
    await clearData();

    await prisma.siteAsset.create({
      data: {
        id: 1,
        schoolLogoPath: null,
        carouselImages: [
          {
            id: "manual-slide",
            path: "/uploads/site-assets/manual-slide.jpg",
            enabled: true,
            sortOrder: 0,
            label: "手动轮播",
          },
        ],
        processContent: defaultProcessContent,
      },
    });

    const defaultSiteAssetsDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "default-site-assets-")
    );

    try {
      writeFixtureFile(defaultSiteAssetsDir, "logo.png");
      writeFixtureFile(defaultSiteAssetsDir, "carousel-01.jpg");

      const app = await createAppWithDefaultSiteAssetsDir(defaultSiteAssetsDir);
      const response = await request(app).get("/api/site-assets");

      expect(response.status).toBe(200);
      expect(response.body.schoolLogoPath).toContain("/uploads/site-assets/school-logo");
      expect(response.body.carouselImages).toEqual([
        expect.objectContaining({
          id: "manual-slide",
          path: "/uploads/site-assets/manual-slide.jpg",
          label: "手动轮播",
        }),
      ]);
    } finally {
      fs.rmSync(defaultSiteAssetsDir, { recursive: true, force: true });
    }
  });

  test("reload-default-assets replaces homepage images from the default asset directory", async () => {
    await clearData();

    const defaultSiteAssetsDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "default-site-assets-")
    );

    try {
      writeFixtureFile(defaultSiteAssetsDir, "logo.png");
      writeFixtureFile(defaultSiteAssetsDir, "carousel-01.jpg");
      writeFixtureFile(defaultSiteAssetsDir, "carousel-02.jpg");

      const app = await createAppWithDefaultSiteAssetsDir(defaultSiteAssetsDir);
      const login = await request(app).post("/api/admin/login").send({
        username: "admin1",
        password: "change-this-password",
      });

      await prisma.siteAsset.update({
        where: { id: 1 },
        data: {
          schoolLogoPath: "/uploads/site-assets/manual-logo.png",
          carouselImages: [
            {
              id: "manual-slide",
              path: "/uploads/site-assets/manual-slide.jpg",
              enabled: true,
              sortOrder: 0,
              label: "手动轮播",
            },
          ],
        },
      });

      const response = await request(app)
        .post("/api/admin/assets/reload-default-assets")
        .set("Authorization", `Bearer ${login.body.token}`);

      expect(response.status).toBe(200);
      expect(response.body.schoolLogoPath).toContain("/uploads/site-assets/school-logo");
      expect(response.body.carouselImages).toHaveLength(2);
      expect(response.body.carouselImages.map((image) => image.label)).toEqual([
        "校园轮播 1",
        "校园轮播 2",
      ]);
    } finally {
      fs.rmSync(defaultSiteAssetsDir, { recursive: true, force: true });
    }
  });
});
