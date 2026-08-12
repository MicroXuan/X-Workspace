const fs = require("node:fs/promises");
const path = require("node:path");

const rootDir = path.join(__dirname, "..");
const outputDir = path.join(rootDir, "public");
const staticFiles = ["index.html", "styles.css", "app.js"];

async function build() {
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  await Promise.all(
    staticFiles.map((fileName) =>
      fs.copyFile(path.join(rootDir, fileName), path.join(outputDir, fileName))
    )
  );
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
