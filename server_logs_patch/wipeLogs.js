const fs = require("fs");
const path = require("path");

const LOG_DIR = path.join(__dirname, "logs");

if (fs.existsSync(LOG_DIR)) {
  fs.rmSync(LOG_DIR, { recursive: true, force: true });
  console.log("Logs wiped.");
}
