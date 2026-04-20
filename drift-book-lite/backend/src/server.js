const { createApp } = require("./app");
const { port } = require("./lib/env");
const { prisma } = require("./lib/prisma");

createApp()
  .then((app) => {
    const server = app.listen(port, () => {
      console.log(`Drift Book Lite backend running on http://localhost:${port}`);
    });

    async function shutdown(signal) {
      console.log(`\n${signal} received, shutting down...`);
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  })
  .catch((error) => {
    console.error("Failed to start backend", error);
    process.exit(1);
  });
