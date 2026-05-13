const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const Module = require("module");

const DB_MODE = String(process.env.INNER_DB || "").toLowerCase();
const MONGODB_URI = process.env.MONGODB_URI || "";
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = process.env.INNER_DATA_DIR ? path.resolve(process.env.INNER_DATA_DIR) : path.join(ROOT, "data");
const DATABASE_NAME = process.env.MONGODB_DB || "inner";
const COLLECTION_NAME = process.env.MONGODB_COLLECTION || "inner_state";

const jsonFileNames = new Set([
  "users.json",
  "rooms.json",
  "messages.json",
  "dms.json",
  "files.json",
  "store.json",
  "ai-requests.json",
  "ai.json",
  "settings.json",
  "vpn.json",
]);

function isJsonDataFile(filePath) {
  const absolutePath = path.resolve(String(filePath));
  return absolutePath.startsWith(DATA_DIR + path.sep) && jsonFileNames.has(path.basename(absolutePath));
}

function documentId(filePath) {
  return path.basename(String(filePath), ".json");
}

function fallbackFor(filePath) {
  switch (documentId(filePath)) {
    case "rooms":
    case "messages":
    case "dms":
    case "files":
    case "ai-requests":
    case "users":
      return [];
    case "store":
      return { items: [], orders: [] };
    case "ai":
      return { apiKey: "", updatedAt: "", updatedBy: "" };
    case "settings":
      return { serverEnabled: true, roomName: "Inner", featureLocks: {}, updatedAt: new Date().toISOString() };
    case "vpn":
      return { enabled: false, username: "", passwordHash: "", location: "United States", updatedAt: new Date().toISOString(), updatedBy: "system" };
    default:
      return null;
  }
}

if (DB_MODE === "mongodb" && MONGODB_URI) {
  const { MongoClient } = require("mongodb");
  const client = new MongoClient(MONGODB_URI);
  const ready = client.connect().then(() => {
    console.log(`[database] Connected to MongoDB database "${DATABASE_NAME}"`);
    return client.db(DATABASE_NAME).collection(COLLECTION_NAME);
  }).catch((error) => {
    console.error("[database] MongoDB connection failed. Falling back to JSON files.", error);
    return null;
  });

  const originalExistsSync = fs.existsSync.bind(fs);
  const originalReadFile = fsp.readFile.bind(fsp);
  const originalWriteFile = fsp.writeFile.bind(fsp);
  const originalMkdir = fsp.mkdir.bind(fsp);

  fs.existsSync = function patchedExistsSync(filePath) {
    if (isJsonDataFile(filePath)) return true;
    return originalExistsSync(filePath);
  };

  fsp.mkdir = async function patchedMkdir(dirPath, options) {
    return originalMkdir(dirPath, options);
  };

  fsp.readFile = async function patchedReadFile(filePath, options) {
    if (!isJsonDataFile(filePath)) return originalReadFile(filePath, options);
    const collection = await ready;
    if (!collection) return originalReadFile(filePath, options);
    const doc = await collection.findOne({ _id: documentId(filePath) });
    const data = doc && Object.prototype.hasOwnProperty.call(doc, "data") ? doc.data : fallbackFor(filePath);
    return Buffer.from(JSON.stringify(data ?? null, null, 2));
  };

  fsp.writeFile = async function patchedWriteFile(filePath, content, options) {
    if (!isJsonDataFile(filePath)) return originalWriteFile(filePath, content, options);
    const collection = await ready;
    if (!collection) return originalWriteFile(filePath, content, options);
    const text = Buffer.isBuffer(content) ? content.toString("utf8") : String(content);
    const data = JSON.parse(text || "null");
    await collection.updateOne(
      { _id: documentId(filePath) },
      { $set: { data, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  };
} else if (DB_MODE === "mongodb") {
  console.warn("[database] INNER_DB is mongodb, but MONGODB_URI is missing. Using JSON files instead.");
}

module.exports = {};
