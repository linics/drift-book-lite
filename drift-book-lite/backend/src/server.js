const { createApp } = require("./app");
const { port } = require("./lib/env");

createApp()
  .then((app) => {
    app.listen(port, () => {
      console.log(`Drift Book Lite backend running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start backend", error);
    process.exit(1);
  });
