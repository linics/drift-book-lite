const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { prisma } = require("../src/lib/prisma");
const { createApp } = require("../src/app");
const { bootstrapFromMaterials } = require("../src/services/assets");

let app;
let adminToken;
let importedPageId;

async function clearData() {
  await prisma.driftMessage.deleteMany();
  await prisma.driftRound.deleteMany();
  await prisma.bookPage.deleteMany();
  await prisma.siteAsset.deleteMany();
  await prisma.adminUser.deleteMany();
}

describe("drift book lite api", () => {
  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(async () => {
    await clearData();
    app = await createApp();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("bootstraps site assets from materials", async () => {
    const asset = await bootstrapFromMaterials();
    expect(asset.schoolLogoPath).toContain("/uploads/site-assets/");
    expect(asset.carouselImages.length).toBeGreaterThan(0);
  });

  test("imports pages and exposes next open level", async () => {
    const login = await request(app).post("/api/admin/login").send({
      username: "admin",
      password: "change-this-password",
    });
    adminToken = login.body.token;

    const csv = Buffer.from(
      "qr_code,title,author,description\nbook-001,测试书,作者甲,一本测试书\n",
      "utf8"
    );

    const importRes = await request(app)
      .post("/api/admin/pages/import")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", csv, "pages.csv");

    expect(importRes.status).toBe(201);
    importedPageId = importRes.body.pages[0].id;

    const publicPage = await request(app).get("/api/pages/book-001");
    expect(publicPage.status).toBe(200);
    expect(publicPage.body.nextOpenLevel).toBe(1);
  });

  test("requires approval before the next level opens", async () => {
    const login = await request(app).post("/api/admin/login").send({
      username: "admin",
      password: "change-this-password",
    });
    adminToken = login.body.token;

    const csv = Buffer.from(
      "qr_code,title,author,description\nbook-001,测试书,作者甲,一本测试书\n",
      "utf8"
    );

    await request(app)
      .post("/api/admin/pages/import")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", csv, "pages.csv");

    const firstMessage = await request(app).post("/api/pages/book-001/messages").send({
      personalId: "20260001",
      content: "第一层留言",
    });
    expect(firstMessage.status).toBe(201);

    const duplicate = await request(app).post("/api/pages/book-001/messages").send({
      personalId: "20260002",
      content: "重复提交",
    });
    expect(duplicate.status).toBe(409);

    const pending = await request(app)
      .get("/api/admin/messages/pending")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(pending.body.messages).toHaveLength(1);

    await request(app)
      .post(`/api/admin/messages/${pending.body.messages[0].id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});

    const secondMessage = await request(app).post("/api/pages/book-001/messages").send({
      personalId: "20260002",
      content: "第二层留言",
    });
    expect(secondMessage.status).toBe(201);
  });
});
