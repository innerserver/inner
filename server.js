// Local desktop mode stores data beside the app. Cloud deploys can still require Mongo/GridFS.
const http = require("http");
const https = require("https");
const net = require("net");
const tls = require("tls");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const { Readable } = require("stream");
const { URL } = require("url");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const HTTPS_KEY_PATH = process.env.INNER_HTTPS_KEY ? path.resolve(process.env.INNER_HTTPS_KEY) : "";
const HTTPS_CERT_PATH = process.env.INNER_HTTPS_CERT ? path.resolve(process.env.INNER_HTTPS_CERT) : "";
const FORCE_HTTPS = isTruthy(process.env.INNER_FORCE_HTTPS);
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = process.env.INNER_DATA_DIR ? path.resolve(process.env.INNER_DATA_DIR) : path.join(ROOT, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const INLINE_UPLOAD_BYTES = Math.max(0, Number(process.env.INNER_UPLOAD_INLINE_LIMIT || 15 * 1024 * 1024));
const MONGODB_URI = firstEnvValue("MONGODB_URI", "INNER_MONGODB_URI");
const MONGODB_DB = firstEnvValue("MONGODB_DB", "INNER_MONGODB_DB") || "inner";
const MONGODB_JSON_COLLECTION = firstEnvValue("INNER_MONGODB_JSON_COLLECTION") || "inner_json";
const MONGODB_UPLOAD_BUCKET = firstEnvValue("INNER_MONGODB_UPLOAD_BUCKET") || "inner_uploads";
const LOCALHOST_MODE = isTruthy(process.env.INNER_LOCALHOST_MODE);
const REQUIRE_CLOUD_STORAGE = !LOCALHOST_MODE && isTruthy(process.env.INNER_REQUIRE_CLOUD_STORAGE);
const CLOUDINARY_CLOUD_NAME = firstEnvValue("CLOUDINARY_CLOUD_NAME", "INNER_CLOUDINARY_CLOUD_NAME");
const CLOUDINARY_API_KEY = firstEnvValue("CLOUDINARY_API_KEY", "INNER_CLOUDINARY_API_KEY");
const CLOUDINARY_API_SECRET = firstEnvValue("CLOUDINARY_API_SECRET", "INNER_CLOUDINARY_API_SECRET");
const CLOUDINARY_FOLDER = firstEnvValue("CLOUDINARY_FOLDER", "INNER_CLOUDINARY_FOLDER") || "inner_uploads";
const UPLOAD_PROVIDER = String(firstEnvValue("INNER_UPLOAD_PROVIDER", "UPLOAD_PROVIDER") || "").toLowerCase();
const REPORT_EMAILS = splitEnvList(firstEnvValue("INNER_REPORT_EMAILS", "REPORT_EMAILS", "INNER_ADMIN_EMAILS", "ADMIN_EMAILS")).slice(0, 4);
const EMAIL_WEBHOOK_URL = firstEnvValue("INNER_EMAIL_WEBHOOK_URL", "REPORT_EMAIL_WEBHOOK_URL", "EMAIL_WEBHOOK_URL");
const EMAIL_FROM = firstEnvValue("INNER_EMAIL_FROM", "EMAIL_FROM", "RESEND_FROM", "SENDGRID_FROM", "BREVO_FROM") || "Inner <innerservers@gmail.com>";
const EMAIL_REPLY_TO = firstEnvValue("INNER_EMAIL_REPLY_TO", "EMAIL_REPLY_TO");
const RESEND_API_KEY = firstEnvValue("INNER_RESEND_API_KEY", "RESEND_API_KEY", "RESEND_KEY");
const BREVO_API_KEY = firstEnvValue("INNER_BREVO_API_KEY", "BREVO_API_KEY", "SENDINBLUE_API_KEY", "BREVO_KEY", "SIB_API_KEY");
const SENDGRID_API_KEY = firstEnvValue("INNER_SENDGRID_API_KEY", "SENDGRID_API_KEY", "SENDGRID_KEY");
const SMTP_HOST = firstEnvValue("INNER_SMTP_HOST", "SMTP_HOST");
const SMTP_PORT = Number(firstEnvValue("INNER_SMTP_PORT", "SMTP_PORT") || 0);
const SMTP_USER = firstEnvValue("INNER_SMTP_USER", "SMTP_USER");
const SMTP_PASS = firstEnvValue("INNER_SMTP_PASS", "SMTP_PASS", "SMTP_PASSWORD");
const SMTP_SECURE = firstEnvValue("INNER_SMTP_SECURE", "SMTP_SECURE");
const DEFAULT_SIGNUP_MODE = String(firstEnvValue("INNER_SIGNUP_MODE", "SIGNUP_MODE") || "open").toLowerCase() === "request" ? "request" : "open";
const DEFAULT_REQUIRE_CONTACT = firstEnvValue("INNER_REQUIRE_CONTACT", "REQUIRE_CONTACT") === "" ? false : !isFalsy(firstEnvValue("INNER_REQUIRE_CONTACT", "REQUIRE_CONTACT"));

const FILES = {
  users: path.join(DATA_DIR, "users.json"),
  rooms: path.join(DATA_DIR, "rooms.json"),
  messages: path.join(DATA_DIR, "messages.json"),
  dms: path.join(DATA_DIR, "dms.json"),
  dmGroups: path.join(DATA_DIR, "dm-groups.json"),
  uploads: path.join(DATA_DIR, "files.json"),
  accountRequests: path.join(DATA_DIR, "account-requests.json"),
  store: path.join(DATA_DIR, "store.json"),
  aiRequests: path.join(DATA_DIR, "ai-requests.json"),
  ai: path.join(DATA_DIR, "ai.json"),
  settings: path.join(DATA_DIR, "settings.json"),
  vpn: path.join(DATA_DIR, "vpn.json"),
  profiles: path.join(DATA_DIR, "profiles.json"),
  friends: path.join(DATA_DIR, "friends.json"),
  invites: path.join(DATA_DIR, "invites.json"),
  reports: path.join(DATA_DIR, "reports.json"),
  readReceipts: path.join(DATA_DIR, "read-receipts.json"),
  moderationLogs: path.join(DATA_DIR, "moderation-logs.json"),
  logs: path.join(DATA_DIR, "logs.json"),
  devConfig: path.join(DATA_DIR, "dev-config.json"),
  voiceRooms: path.join(DATA_DIR, "voice-rooms.json"),
  bots: path.join(DATA_DIR, "bots.json"),
  plugins: path.join(DATA_DIR, "plugins.json"),
  automod: path.join(DATA_DIR, "automod.json"),
  announcements: path.join(DATA_DIR, "announcements.json"),
};

const MAX_JSON_BYTES = 1024 * 1024;
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
const SESSION_COOKIE = "server_app_session";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const SESSION_PERSISTENT_MS = 180 * 24 * 60 * 60 * 1000;
const sessions = new Map();
const wsClients = new Map();
const messageRateLimits = new Map();
const serverStartedAt = new Date().toISOString();
const persistence = {
  mode: "local",
  ready: false,
  error: "",
  client: null,
  db: null,
  json: null,
  uploadBucket: null,
  uploadFiles: null,
  ObjectId: null,
};
const allowedFeatureLocks = new Set([
  "all",
  "messages",
  "files",
  "screen",
  "dms",
  "rooms",
  "vpn",
  "friends",
  "profiles",
  "voice",
  "invites",
  "moderation",
  "bots",
  "plugins",
  "store",
  "chess",
]);
const managerRoles = new Set(["admin", "hmd", "dev"]);
const developerRoles = new Set(["admin", "hmd", "dev"]);
const moderatorRoles = new Set(["moderator", "admin", "hmd", "dev"]);
const shutdownExemptUsernames = new Set(["admin", "admin2", "hmd", "dev"]);
const ownerUsernames = new Set(["admin"]);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".rtf": "application/rtf",
  ".zip": "application/zip",
  ".7z": "application/x-7z-compressed",
  ".rar": "application/vnd.rar",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".log": "text/plain; charset=utf-8",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".odp": "application/vnd.oasis.opendocument.presentation",
  ".pages": "application/octet-stream",
  ".numbers": "application/octet-stream",
  ".key": "application/octet-stream",
  ".psd": "image/vnd.adobe.photoshop",
  ".ai": "application/pdf",
};

const allowedExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".heic",
  ".heif",
  ".mp4",
  ".webm",
  ".mov",
  ".avi",
  ".mkv",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".txt",
  ".md",
  ".csv",
  ".rtf",
  ".odt",
  ".ods",
  ".odp",
  ".zip",
  ".7z",
  ".rar",
  ".tar",
  ".gz",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
  ".log",
  ".pages",
  ".numbers",
  ".key",
  ".psd",
  ".ai",
  ".mun",
]);
const dangerousUploadExtensions = new Set([".exe", ".bat", ".cmd", ".scr", ".ps1", ".msi", ".com", ".vbs", ".jar", ".sh", ".app", ".dll"]);

const vpnLocations = [
  "United States",
  "United Kingdom",
  "Canada",
  "Germany",
  "Singapore",
  "India",
  "Japan",
  "Australia",
];

async function main() {
  await initPersistence();
  await ensureStorage();

  const server = createInnerServer((req, res) => {
    route(req, res).catch((error) => {
      console.error(error);
      json(res, 500, { error: "Internal server error" });
    });
  });

  server.on("upgrade", handleUpgrade);

  server.listen(PORT, HOST, () => {
    const scheme = server.isInnerHttps ? "https" : "http";
    console.log(`Inner running at ${scheme}://${HOST}:${PORT}`);
    if (!server.isInnerHttps) {
      console.log("Cloud hosts like Render still provide HTTPS at the public app URL.");
    }
    console.log(
      persistence.ready
        ? `Persistence: MongoDB/GridFS (${MONGODB_DB})`
        : `Persistence: local disk (${DATA_DIR})${persistence.error ? `; cloud storage error: ${persistence.error}` : ""}`
    );
    console.log("Admin login: admin / Devshah@11");
    console.log("Secondary admin login: admin2 / Devshah@11");
    console.log("HMD login: hmd / Devshah@11");
    console.log("Developer login: dev / Devshah@11");
  });
}

function createInnerServer(handler) {
  if (HTTPS_KEY_PATH || HTTPS_CERT_PATH) {
    if (!HTTPS_KEY_PATH || !HTTPS_CERT_PATH) {
      throw new Error("Set both INNER_HTTPS_KEY and INNER_HTTPS_CERT to enable HTTPS.");
    }

    const server = https.createServer(
      {
        key: fs.readFileSync(HTTPS_KEY_PATH),
        cert: fs.readFileSync(HTTPS_CERT_PATH),
      },
      handler,
    );
    server.isInnerHttps = true;
    return server;
  }

  const server = http.createServer(handler);
  server.isInnerHttps = false;
  return server;
}

async function initPersistence() {
  if (!MONGODB_URI) {
    if (REQUIRE_CLOUD_STORAGE) {
      console.log("MongoDB optional mode active.");
    }
    return;
  }

  try {
    const mongodb = require("mongodb");
    const client = new mongodb.MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: Math.max(3000, Number(process.env.INNER_MONGODB_TIMEOUT_MS || 10000)),
    });
    await client.connect();
    const db = client.db(MONGODB_DB);
    const jsonCollection = db.collection(MONGODB_JSON_COLLECTION);
    const uploadBucket = new mongodb.GridFSBucket(db, { bucketName: MONGODB_UPLOAD_BUCKET });
    const uploadFiles = db.collection(`${MONGODB_UPLOAD_BUCKET}.files`);

    await Promise.all([
      jsonCollection.createIndex({ updatedAt: -1 }).catch(() => {}),
      uploadFiles.createIndex({ filename: 1, uploadDate: -1 }).catch(() => {}),
      uploadFiles.createIndex({ "metadata.id": 1 }).catch(() => {}),
    ]);

    persistence.mode = "mongodb";
    persistence.ready = true;
    persistence.client = client;
    persistence.db = db;
    persistence.json = jsonCollection;
    persistence.uploadBucket = uploadBucket;
    persistence.uploadFiles = uploadFiles;
    persistence.ObjectId = mongodb.ObjectId;
    console.log("[persistence] MongoDB/GridFS enabled");
  } catch (error) {
    persistence.mode = "local";
    persistence.ready = false;
    persistence.error = error.message || "MongoDB connection failed";
    console.error("[persistence] MongoDB/GridFS failed:", persistence.error);
    console.log("MongoDB failure bypassed.");
  }
}

async function ensureStorage() {
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
  await ensureJson(FILES.rooms, [
    {
      id: "main",
      name: "Main",
      createdAt: new Date().toISOString(),
      createdBy: "system",
    },
  ]);
  await ensureJson(FILES.messages, []);
  await ensureJson(FILES.dms, []);
  await ensureJson(FILES.dmGroups, []);
  await ensureJson(FILES.uploads, []);
  await ensureJson(FILES.accountRequests, []);
  await ensureJson(FILES.store, { items: [], orders: [] });
  await ensureJson(FILES.aiRequests, []);
  await ensureJson(FILES.ai, { apiKey: "", updatedAt: "", updatedBy: "" });
  await ensureJson(FILES.profiles, {});
  await ensureJson(FILES.friends, { requests: [], friendships: [] });
  await ensureJson(FILES.invites, []);
  await ensureJson(FILES.reports, []);
  await ensureJson(FILES.readReceipts, {});
  await ensureJson(FILES.moderationLogs, []);
  await ensureJson(FILES.logs, []);
  await ensureJson(FILES.devConfig, {
    emergencyMode: false,
    rollout: {},
    theme: "midnight",
    metricsEnabled: true,
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
  });
  await ensureJson(FILES.voiceRooms, [
    {
      id: "lobby",
      name: "Lobby Voice",
      createdAt: new Date().toISOString(),
      createdBy: "system",
    },
  ]);
  await ensureJson(FILES.bots, []);
  await ensureJson(FILES.plugins, []);
  await ensureJson(FILES.automod, {
    enabled: true,
    spamWindowSeconds: 8,
    maxMessagesPerWindow: 6,
    mutedWords: [],
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
  });
  await ensureJson(FILES.announcements, []);
  await ensureJson(FILES.settings, {
    serverEnabled: true,
    roomName: "Inner",
    signupMode: DEFAULT_SIGNUP_MODE,
    requireContact: DEFAULT_REQUIRE_CONTACT,
    reportEmails: REPORT_EMAILS,
    featureLocks: {},
    featureVisibility: {},
    paywalls: {},
    shutdownAt: "",
    shutdownBy: "",
    updatedAt: new Date().toISOString(),
  });
  await ensureJson(FILES.vpn, {
    enabled: false,
    username: "",
    passwordHash: "",
    location: "United States",
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
  });

  await ensureUsers();
  await ensureRooms();
  await ensureProfiles();
  await ensureSettings();
  await migrateExistingUploadsToCloud();
}

async function ensureUsers() {
  const now = new Date().toISOString();
  const settings = await readJson(FILES.settings, {});
  const deletedDefaults = Array.isArray(settings.deletedDefaultAdmins) ? settings.deletedDefaultAdmins : [];

  if (!(await jsonExists(FILES.users))) {
    await writeJson(FILES.users, [
      {
        username: "admin",
        role: "admin",
        passwordHash: hashPassword("Devshah@11"),
        passwordPreset: "admin-v1",
        allowPersistentLogin: false,
        locked: true,
        createdAt: now,
      },
      {
        username: "admin2",
        role: "admin",
        passwordHash: hashPassword("Devshah@11"),
        passwordPreset: "admin2-v1",
        allowPersistentLogin: false,
        locked: false,
        createdAt: now,
      },
      {
        username: "hmd",
        role: "hmd",
        passwordHash: hashPassword("Devshah@11"),
        passwordPreset: "hmd-v1",
        allowPersistentLogin: false,
        locked: false,
        createdAt: now,
        createdBy: "system",
      },
      {
        username: "dev",
        role: "dev",
        passwordHash: hashPassword("Devshah@11"),
        passwordPreset: "dev-v1",
        allowPersistentLogin: false,
        locked: false,
        createdAt: now,
        createdBy: "system",
      },
    ]);
    return;
  }

  const users = await readJson(FILES.users, []);
  let changed = false;
  const adminIndex = users.findIndex((entry) => entry.username.toLowerCase() === "admin");
  const admin2Index = users.findIndex((entry) => entry.username.toLowerCase() === "admin2");
  const ensureDefaultUser = (username, role, preset, locked = false) => {
    const index = users.findIndex((entry) => entry.username.toLowerCase() === username);
    if (index === -1 && !deletedDefaults.includes(username)) {
      users.push({
        username,
        role,
        passwordHash: hashPassword("Devshah@11"),
        passwordPreset: preset,
        allowPersistentLogin: false,
        locked,
        createdAt: now,
        createdBy: "system",
      });
      changed = true;
      return;
    }
    if (index !== -1) {
      const existing = users[index];
      const shouldSetPassword = !existing.passwordHash;
      users[index] = {
        ...existing,
        username,
        role: normalizeRole(existing.role) === "member" ? role : normalizeRole(existing.role),
        passwordHash: shouldSetPassword ? hashPassword("Devshah@11") : existing.passwordHash,
        passwordPreset: shouldSetPassword ? preset : existing.passwordPreset,
        allowPersistentLogin: Boolean(existing.allowPersistentLogin),
        locked: Boolean(existing.locked || locked),
        updatedAt: shouldSetPassword ? now : existing.updatedAt,
      };
      changed = changed || shouldSetPassword;
    }
  };

  if (adminIndex === -1) {
    users.push({
      username: "admin",
      role: "admin",
      passwordHash: hashPassword("Devshah@11"),
      passwordPreset: "admin-v1",
      allowPersistentLogin: false,
      locked: true,
      createdAt: now,
    });
    changed = true;
  } else {
    const admin = users[adminIndex];
    const shouldSetOwnerPassword = verifyPassword("server123", admin.passwordHash) || !admin.passwordHash;
    users[adminIndex] = {
      ...admin,
      username: "admin",
      role: "admin",
      passwordHash: shouldSetOwnerPassword ? hashPassword("Devshah@11") : admin.passwordHash,
      passwordPreset: shouldSetOwnerPassword ? "admin-v1" : admin.passwordPreset,
      allowPersistentLogin: Boolean(admin.allowPersistentLogin),
      locked: true,
      updatedAt: shouldSetOwnerPassword ? now : admin.updatedAt,
    };
    changed = changed || admin.role !== "admin" || shouldSetOwnerPassword;
  }

  if (admin2Index === -1 && !deletedDefaults.includes("admin2")) {
    users.push({
      username: "admin2",
      role: "admin",
      passwordHash: hashPassword("Devshah@11"),
      passwordPreset: "admin2-v1",
      allowPersistentLogin: false,
      locked: false,
      createdAt: now,
      createdBy: "system",
    });
    changed = true;
  } else if (admin2Index !== -1) {
    const admin2 = users[admin2Index];
    const shouldSetAdmin2Password = !admin2.passwordHash;
    users[admin2Index] = {
      ...admin2,
      username: "admin2",
      role: "admin",
      passwordHash: shouldSetAdmin2Password ? hashPassword("Devshah@11") : admin2.passwordHash,
      passwordPreset: shouldSetAdmin2Password ? "admin2-v1" : admin2.passwordPreset,
      allowPersistentLogin: Boolean(admin2.allowPersistentLogin),
      locked: false,
      updatedAt: shouldSetAdmin2Password ? now : admin2.updatedAt,
    };
    changed = changed || admin2.role !== "admin" || shouldSetAdmin2Password;
  }

  ensureDefaultUser("hmd", "hmd", "hmd-v1");
  ensureDefaultUser("dev", "dev", "dev-v1");

  const defaultMemberIndex = users.findIndex(
    (entry) =>
      entry.username.toLowerCase() === "member" &&
      !entry.createdBy
  );
  if (defaultMemberIndex !== -1) {
    users.splice(defaultMemberIndex, 1);
    changed = true;
  }

  if (changed) await writeJson(FILES.users, users);
}

async function ensureRooms() {
  const rooms = await readJson(FILES.rooms, []);
  let changed = false;
  if (!rooms.some((room) => room.id === "main")) {
    rooms.unshift({
      id: "main",
      name: "Main",
      createdAt: new Date().toISOString(),
      createdBy: "system",
    });
    changed = true;
  }

  for (const room of rooms) {
    if (!room.id) {
      room.id = crypto.randomUUID();
      changed = true;
    }
    if (!room.name) {
      room.name = "Room";
      changed = true;
    }
    const sanitized = sanitizeRoom(room);
    Object.assign(room, sanitized);
  }

  if (changed) await writeJson(FILES.rooms, rooms);
}

async function ensureProfiles() {
  const users = await readJson(FILES.users, []);
  const profiles = await readJson(FILES.profiles, {});
  let changed = false;

  for (const user of users) {
    if (!profiles[user.username]) {
      profiles[user.username] = defaultProfile(user.username);
      changed = true;
    } else {
      profiles[user.username] = sanitizeProfile({
        ...defaultProfile(user.username),
        ...profiles[user.username],
      });
      changed = true;
    }
  }

  if (changed) await writeJson(FILES.profiles, profiles);
}

async function ensureSettings() {
  const settings = await readJson(FILES.settings, {});
  const next = { ...settings };
  let changed = false;
  if (!next.featureLocks || typeof next.featureLocks !== "object" || Array.isArray(next.featureLocks)) {
    next.featureLocks = {};
    changed = true;
  }
  if (!["open", "request"].includes(String(next.signupMode || "").toLowerCase())) {
    next.signupMode = DEFAULT_SIGNUP_MODE;
    changed = true;
  }
  if (typeof next.requireContact !== "boolean") {
    next.requireContact = DEFAULT_REQUIRE_CONTACT;
    changed = true;
  }
  if (!Array.isArray(next.reportEmails)) {
    next.reportEmails = REPORT_EMAILS;
    changed = true;
  }
  if (typeof next.moderationSettings !== "object" || !next.moderationSettings || Array.isArray(next.moderationSettings)) {
    next.moderationSettings = {
      emailReports: true,
      trackIp: true,
      trackDevice: true,
      updatedAt: new Date().toISOString(),
      updatedBy: "system",
    };
    changed = true;
  }
  if (typeof next.customizations !== "object" || !next.customizations || Array.isArray(next.customizations)) {
    next.customizations = defaultCustomizations();
    changed = true;
  } else {
    next.customizations = sanitizeCustomizations(next.customizations);
    changed = true;
  }
  if (typeof next.serviceScale !== "object" || !next.serviceScale || Array.isArray(next.serviceScale)) {
    next.serviceScale = defaultServiceScale();
    changed = true;
  } else {
    next.serviceScale = sanitizeServiceScale(next.serviceScale);
    changed = true;
  }
  if (!sanitizeExternalUrl(next.chessUrl)) {
    next.chessUrl = "https://chessverse.co.in/";
    changed = true;
  }
  if (changed) {
    await writeJson(FILES.settings, {
      ...next,
      updatedAt: new Date().toISOString(),
      updatedBy: settings.updatedBy || "system",
    });
  }
}

async function ensureJson(file, fallback) {
  if (!(await jsonExists(file))) {
    await writeJson(file, fallback);
  }
}

async function route(req, res) {
  if (shouldRedirectToHttps(req)) {
    return redirectToHttps(req, res);
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (req.method === "GET" && pathname === "/") {
    return serveStatic(res, path.join(PUBLIC_DIR, "index.html"));
  }

  if (pathname.startsWith("/api/")) {
    return routeApi(req, res, requestUrl);
  }

  if (pathname.startsWith("/uploads/")) {
    const user = requireUser(req, res);
    if (!user) return;
    return serveUpload(req, res, pathname, user);
  }

  if (req.method === "GET") {
    const safePath = safeJoin(PUBLIC_DIR, pathname);
    if (!safePath) return text(res, 404, "Not found");
    try {
      const stat = await fsp.stat(safePath);
      if (stat.isFile()) return serveStatic(res, safePath);
    } catch (error) {
      // Fall through to the SPA shell for client-side routes.
    }

    if (!path.extname(pathname)) {
      return serveStatic(res, path.join(PUBLIC_DIR, "index.html"));
    }

    return text(res, 404, "Not found");
  }

  text(res, 404, "Not found");
}

async function routeApi(req, res, requestUrl) {
  const pathname = requestUrl.pathname;

  if (req.method === "POST" && pathname === "/api/login") {
    const body = await readJsonBody(req);
    const users = await readJson(FILES.users, []);
    const user = users.find((entry) => entry.username.toLowerCase() === String(body.username || "").toLowerCase());

    if (!user || !verifyPassword(String(body.password || ""), user.passwordHash)) {
      const requestLogin = await requestLoginStatus(String(body.username || ""), String(body.password || ""));
      if (requestLogin) {
        return json(res, 403, { error: requestLogin.message, requestStatus: requestLogin.status });
      }
      await addSystemLog("login.failed", String(body.username || "unknown").slice(0, 80), { reason: "Invalid username or password" }, req);
      await notifyAdminEmails("Inner failed login attempt", [
        `Username tried: ${String(body.username || "unknown").slice(0, 80)}`,
        `IP: ${getClientIp(req) || "unknown"}`,
        `Device: ${deviceSignature(req)}`,
        `Time: ${new Date().toISOString()}`,
      ].join("\n"));
      return json(res, 401, { error: "Invalid username or password" });
    }

    if (!canManage(user) && isUserBanned(user)) {
      await addSystemLog("login.blocked", user.username, { reason: "Banned account", bannedUntil: user.bannedUntil }, req);
      return json(res, 403, { error: `Account is temporarily banned until ${new Date(user.bannedUntil).toLocaleString()}` });
    }

    const settings = await readJson(FILES.settings, {});
    if (settings.serverEnabled === false && !canBypassShutdown(user)) {
      await addSystemLog("login.blocked", user.username, { reason: "Server shutdown mode" }, req);
      return json(res, 423, { error: "Server is shut down. Only admin, HMD, and dev access is open right now." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const persistent = Boolean(user.allowPersistentLogin);
    sessions.set(token, {
      username: user.username,
      role: normalizeRole(user.role),
      createdAt: Date.now(),
      persistent,
      expiresAt: Date.now() + (persistent ? SESSION_PERSISTENT_MS : SESSION_IDLE_MS),
    });

    const currentLoginIp = getClientIp(req);
    const currentLoginDevice = deviceSignature(req);
    const previousLoginIp = String(user.lastLoginIp || "");
    const previousLoginDevice = String(user.lastLoginDevice || "");
    const differentLogin =
      Boolean(previousLoginIp && previousLoginIp !== currentLoginIp) ||
      Boolean(previousLoginDevice && previousLoginDevice !== currentLoginDevice);
    const userIndex = users.findIndex((entry) => entry.username.toLowerCase() === user.username.toLowerCase());
    if (userIndex !== -1) {
      users[userIndex] = {
        ...users[userIndex],
        lastLoginAt: new Date().toISOString(),
        lastLoginIp: currentLoginIp,
        lastLoginDevice: currentLoginDevice,
        lastLoginApproximateLocation: approximateLocationFromIp(currentLoginIp),
      };
      await writeJson(FILES.users, users);
    }

    await addSystemLog("login.success", user.username, { role: normalizeRole(user.role), persistent }, req);
    await notifyAdminEmails(differentLogin ? "Inner different login alert" : "Inner login alert", [
      `${user.username} signed in.`,
      `Role: ${normalizeRole(user.role)}`,
      `IP: ${currentLoginIp || "unknown"}`,
      `Device: ${currentLoginDevice}`,
      `Previous IP: ${previousLoginIp || "none"}`,
      `Previous device: ${previousLoginDevice || "none"}`,
      `Different login: ${differentLogin ? "yes" : "no"}`,
      `Time: ${new Date().toISOString()}`,
    ].join("\n"));
    res.setHeader("Set-Cookie", sessionCookie(token, req, persistent ? Math.floor(SESSION_PERSISTENT_MS / 1000) : null));
    return json(res, 200, { user: safeUser(user) });
  }

  if (req.method === "POST" && pathname === "/api/logout") {
    const token = getCookie(req, SESSION_COOKIE);
    if (token) sessions.delete(token);
    res.setHeader("Set-Cookie", sessionCookie("", req, 0));
    return json(res, 200, { ok: true });
  }

  if (req.method === "GET" && pathname === "/api/health") {
    return json(res, 200, {
      ok: true,
      app: "Inner",
      startedAt: serverStartedAt,
      https: {
        requestSecure: isHttpsRequest(req),
        forceHttps: FORCE_HTTPS,
      },
      rtc: {
        turnConfigured: buildRtcConfig().iceServers.some((server) =>
          splitEnvList(Array.isArray(server.urls) ? server.urls.join(",") : server.urls).some((url) => /^turns?:/i.test(url))
        ),
        relayOnly: isTruthy(process.env.INNER_RTC_RELAY_ONLY),
      },
      persistence: {
        mode: storageModeLabel(),
        cloudStorageReady: cloudinaryConfigured() || persistence.ready,
        cloudStorageRequired: cloudStorageRequired(),
        localhostMode: LOCALHOST_MODE,
        cloudinaryConfigured: cloudinaryConfigured(),
        error: persistence.error,
      },
    });
  }

  if (req.method === "GET" && pathname === "/api/signup-status") {
    const settings = await readJson(FILES.settings, {});
    return json(res, 200, {
      signupMode: String(settings.signupMode || DEFAULT_SIGNUP_MODE) === "open" ? "open" : "request",
      requireContact: settings.requireContact !== false,
      serverEnabled: settings.serverEnabled !== false,
    });
  }

  if (req.method === "POST" && pathname === "/api/account-requests") {
    const body = await readJsonBody(req);
    const settings = await readJson(FILES.settings, {});
    const username = normalizeUsername(body.username);
    if (!username) return json(res, 400, { error: "Use 3-32 letters, numbers, dots, dashes, or underscores" });
    const email = String(body.email || "").trim().slice(0, 120);
    const phone = String(body.phone || "").trim().slice(0, 80);
    const password = String(body.password || "");
    const contact = String(body.contact || [email, phone].filter(Boolean).join(" / ")).trim().slice(0, 160);
    if (password.length < 4) return json(res, 400, { error: "Password must be at least 4 characters" });
    if (settings.requireContact !== false && !contact) {
      return json(res, 400, { error: "Add an email or phone number so admins can contact you after review." });
    }

    const location = sanitizeLocation(body.location);
    if (!location) {
      return json(res, 400, { error: "Turn on location so Inner can allocate the nearest server area for this account." });
    }

    const users = await readJson(FILES.users, []);
    if (users.some((entry) => entry.username.toLowerCase() === username.toLowerCase())) {
      return json(res, 409, { error: "That username already exists" });
    }

    const requests = await readJson(FILES.accountRequests, []);
    const existing = requests.find((entry) => entry.status === "pending" && entry.username.toLowerCase() === username.toLowerCase());
    if (existing) return json(res, 409, { error: "That username already has a pending request" });

    const request = sanitizeAccountRequest({
      id: crypto.randomUUID(),
      username,
      displayName: body.displayName,
      contact,
      email,
      phone,
      passwordHash: hashPassword(password),
      passwordSet: true,
      note: body.note,
      location,
      status: "pending",
      sourceIp: getClientIp(req),
      sourceHost: req.headers.host || "",
      sourceAgent: String(req.headers["user-agent"] || "").slice(0, 240),
      sourceDevice: deviceSignature(req),
      approximateLocation: approximateLocationFromIp(getClientIp(req)),
      createdAt: new Date().toISOString(),
    });
    requests.unshift(request);
    await writeJson(FILES.accountRequests, requests.slice(0, 500));
    await addSystemLog("account.requested", username, { displayName: request.displayName, location: request.location }, req);
    await notifyAdminEmails("Inner account request", [
      `${username} requested access.`,
      `Contact: ${contact || "not provided"}`,
      `IP: ${request.sourceIp || "unknown"}`,
      `Approx location: ${JSON.stringify(request.approximateLocation || {})}`,
      `Device: ${request.sourceDevice || "unknown"}`,
      `Browser: ${request.sourceAgent || "unknown"}`,
      `Time: ${request.createdAt}`,
    ].join("\n"));
    broadcastManagers({ type: "account-requests:update", accountRequests: safeAccountRequests(requests) });
    return json(res, 201, { request: safeAccountRequest(request) });
  }

  if (req.method === "POST" && pathname === "/api/signup") {
    const settings = await readJson(FILES.settings, {});
    if (String(settings.signupMode || DEFAULT_SIGNUP_MODE) !== "open") {
      return json(res, 403, { error: "Open signup is off. Request an account instead." });
    }
    const body = await readJsonBody(req);
    const username = normalizeUsername(body.username);
    const password = String(body.password || "");
    const contact = String(body.contact || "").trim().slice(0, 160);
    if (!username) return json(res, 400, { error: "Use 3-32 letters, numbers, dots, dashes, or underscores" });
    if (password.length < 4) return json(res, 400, { error: "Password must be at least 4 characters" });
    if (settings.requireContact !== false && !contact) {
      return json(res, 400, { error: "Add an email or phone number so admins can contact you." });
    }
    if (!sanitizeLocation(body.location)) {
      return json(res, 400, { error: "Turn on location so Inner can allocate the nearest server area for this account." });
    }
    const [users, profiles] = await Promise.all([readJson(FILES.users, []), readJson(FILES.profiles, {})]);
    if (users.some((entry) => entry.username.toLowerCase() === username.toLowerCase())) {
      return json(res, 409, { error: "That username already exists" });
    }
    const now = new Date().toISOString();
    const account = {
      username,
      role: "member",
      passwordHash: hashPassword(password),
      passwordPreset: "",
      contact,
      sourceIp: getClientIp(req),
      sourceHost: req.headers.host || "",
      sourceAgent: String(req.headers["user-agent"] || "").slice(0, 240),
      sourceDevice: deviceSignature(req),
      approximateLocation: approximateLocationFromIp(getClientIp(req)),
      allowPersistentLogin: true,
      createdAt: now,
      createdBy: "open-signup",
    };
    users.push(account);
    profiles[username] = sanitizeProfile({
      ...defaultProfile(username),
      displayName: body.displayName || username,
      updatedAt: now,
    });
    await Promise.all([writeJson(FILES.users, users), writeJson(FILES.profiles, profiles)]);
    await addSystemLog("account.signup.created", username, { sourceIp: account.sourceIp, contact }, req);
    await notifyAdminEmails("Inner open signup", [
      `${username} created a member account.`,
      `Role: member`,
      `Contact: ${contact || "not provided"}`,
      `IP: ${account.sourceIp || "unknown"}`,
      `Approx location: ${JSON.stringify(account.approximateLocation || {})}`,
      `Device: ${account.sourceDevice || "unknown"}`,
      `Browser: ${account.sourceAgent || "unknown"}`,
      `Time: ${now}`,
    ].join("\n"));
    broadcastManagers({ type: "users:update", users: users.map(safeUser) });
    return json(res, 201, { user: safeUser(account) });
  }

  const user = requireUser(req, res);
  if (!user) return;

  if (req.method === "GET" && pathname === "/api/browser/frame") {
    if (!canManage(user)) return text(res, 403, "Admin access required");
    return serveAdminBrowserFrame(req, res, requestUrl);
  }

  const shutdownSettings = await readJson(FILES.settings, {});
  if (shutdownSettings.serverEnabled === false && !canBypassShutdown(user)) {
    clearSessionForRequest(req, res);
    return json(res, 423, { error: "Server is shut down. Only admin, HMD, and dev access is open right now." });
  }

  if (req.method === "GET" && pathname === "/api/me") {
    return json(res, 200, { user });
  }

  if (req.method === "GET" && pathname === "/api/state") {
    const [
      settings,
      rooms,
      messages,
      dms,
      dmGroups,
      files,
      accountRequests,
      store,
      aiRequests,
      aiConfig,
      vpn,
      users,
      backups,
      profiles,
      friends,
      invites,
      reports,
      readReceipts,
      moderationLogs,
      logs,
      devConfig,
      voiceRooms,
      bots,
      plugins,
      automod,
      announcements,
    ] = await Promise.all([
      readJson(FILES.settings, {}),
      readJson(FILES.rooms, []),
      readJson(FILES.messages, []),
      readJson(FILES.dms, []),
      readJson(FILES.dmGroups, []),
      readJson(FILES.uploads, []),
      canManage(user) ? readJson(FILES.accountRequests, []) : [],
      readJson(FILES.store, { items: [], orders: [] }),
      readJson(FILES.aiRequests, []),
      readJson(FILES.ai, {}),
      readJson(FILES.vpn, {}),
      readJson(FILES.users, []),
      canManage(user) ? listBackups() : [],
      readJson(FILES.profiles, {}),
      readJson(FILES.friends, { requests: [], friendships: [] }),
      readJson(FILES.invites, []),
      canModerate(user) ? readJson(FILES.reports, []) : [],
      readJson(FILES.readReceipts, {}),
      canModerate(user) ? readJson(FILES.moderationLogs, []) : [],
      canManage(user) ? readJson(FILES.logs, []) : [],
      canDev(user) ? readJson(FILES.devConfig, {}) : {},
      readJson(FILES.voiceRooms, []),
      canDev(user) ? readJson(FILES.bots, []) : [],
      canDev(user) ? readJson(FILES.plugins, []) : [],
      canModerate(user) ? readJson(FILES.automod, {}) : {},
      readJson(FILES.announcements, []),
    ]);
    const accessibleRoomIds = new Set(rooms.filter((room) => canAccessRoom(room, user)).map((room) => room.id || "main"));
    const normalizedMessages = messages
      .map((message) => ({
        ...message,
        roomId: message.roomId || "main",
      }))
      .filter((message) => canManage(user) || accessibleRoomIds.has(message.roomId || "main"));
    const visibleDms = canManage(user)
      ? dms
      : dms.filter((entry) => Array.isArray(entry.participants) && entry.participants.includes(user.username));
    return json(res, 200, {
      user,
      settings: safeSettings(settings),
      rtcConfig: buildRtcConfig(),
      uploadConfig: safeUploadConfig(settings),
      rooms: safeRooms(rooms),
      messages: normalizedMessages.slice(-500),
      dms: visibleDms.slice(-500),
      dmGroups: safeDmGroups(dmGroups, user),
      files: safeFileRecords(files, user),
      accountRequests: canManage(user) ? safeAccountRequests(accountRequests) : [],
      store: safeStore(store, user),
      aiRequests: canManage(user) ? aiRequests.slice(-100) : [],
      aiConfigured: canManage(user) ? Boolean(process.env.OPENAI_API_KEY || aiConfig.apiKey) : false,
      emailStatus: canManage(user) ? emailProviderStatus() : null,
      vpn: safeVpn(vpn),
      locations: vpnLocations,
      users: canManage(user) ? users.map(safeUser) : [],
      people: users.map((entry) => publicUser(entry, profiles[entry.username])),
      backups,
      profiles: safeProfiles(profiles, users, user),
      friends: safeFriendState(friends, user),
      invites: canManage(user) ? invites.slice(-100) : safeInvitesForUser(invites, user),
      reports,
      liveIpTracking: canManage(user) ? liveIpTracking(users) : [],
      readReceipts: safeReadReceipts(readReceipts, user, { messages: normalizedMessages, dms: visibleDms, dmGroups }),
      moderationLogs: moderationLogs.slice(-250),
      logs: canManage(user) ? logs.slice(0, 300) : [],
      dev: canDev(user)
        ? await buildDevState({ settings, rooms, messages, dms, dmGroups, files, accountRequests, users, store, reports, moderationLogs, logs, devConfig, bots, plugins, automod })
        : null,
      voiceRooms,
      bots,
      plugins,
      automod,
      announcements: safeAnnouncements(announcements, user, rooms),
      presence: presenceList(profiles, user),
    });
  }

  if (req.method === "POST" && pathname === "/api/messages") {
    const settings = await readJson(FILES.settings, {});
    if (!settings.serverEnabled && !canManage(user)) return json(res, 423, { error: "Server room is off" });
    const featureError = await featureGateError(settings, "messages", user);
    if (featureError) return json(res, 423, { error: featureError });
    const rateError = await checkMessageRate(user);
    if (rateError) return json(res, 429, { error: rateError });

    const body = await readJsonBody(req);
    let textValue = String(body.text || "").trim();
    const roomId = String(body.roomId || "main").trim() || "main";
    const attachment = await resolveChatAttachment(body.attachment);
    if (!textValue && !attachment) return json(res, 400, { error: "Message cannot be empty" });
    if (textValue.length > 2000) return json(res, 400, { error: "Message is too long" });
    textValue = applySlashCommand(textValue);
    if (roomId !== "main") {
      const roomFeatureError = await featureGateError(settings, "rooms", user);
      if (roomFeatureError) return json(res, 423, { error: roomFeatureError });
    }

    const rooms = await readJson(FILES.rooms, []);
    const room = rooms.find((entry) => entry.id === roomId);
    if (!room) return json(res, 404, { error: "Room not found" });
    if (!canAccessRoom(room, user)) return json(res, 403, { error: "You do not have access to this room" });
    const automodError = await checkAutomod(textValue, user);
    if (automodError) return json(res, 400, { error: automodError });

    const messages = await readJson(FILES.messages, []);
    const message = {
      id: crypto.randomUUID(),
      roomId,
      parentId: String(body.parentId || "").slice(0, 80),
      text: textValue,
      attachment,
      mentions: extractMentions(textValue),
      reactions: {},
      user: user.username,
      sourceIp: getClientIp(req),
      sourceHost: req.headers.host || "",
      sourceAgent: String(req.headers["user-agent"] || "").slice(0, 240),
      sourceDevice: deviceSignature(req),
      approximateLocation: approximateLocationFromIp(getClientIp(req)),
      createdAt: new Date().toISOString(),
    };
    messages.push(message);
    await writeJson(FILES.messages, messages.slice(-3000));
    await addSystemLog("message.sent", user.username, { roomId, hasAttachment: Boolean(attachment), mentions: message.mentions }, req);
    broadcast({ type: "message:new", message });
    return json(res, 201, { message });
  }

  if (req.method === "POST" && pathname === "/api/upload") {
    const settings = await readJson(FILES.settings, {});
    if (!settings.serverEnabled && !canManage(user)) return json(res, 423, { error: "Server room is off" });
    const featureError = await featureGateError(settings, "files", user);
    if (featureError) return json(res, 423, { error: featureError });
    return saveUpload(req, res, user);
  }

  if (req.method === "POST" && pathname === "/api/uploads/direct-cloudinary/sign") {
    const settings = await readJson(FILES.settings, {});
    if (!settings.serverEnabled && !canManage(user)) return json(res, 423, { error: "Server room is off" });
    const featureError = await featureGateError(settings, "files", user);
    if (featureError) return json(res, 423, { error: featureError });
    if (!cloudinaryConfigured() || UPLOAD_PROVIDER === "mongodb") return json(res, 503, { error: "Direct Cloudinary uploads are not configured" });
    const body = await readJsonBody(req);
    const originalName = sanitizeFileName(body.originalName || "upload.bin");
    const extension = path.extname(originalName).toLowerCase();
    const size = Number(body.size || 0);
    const scaledUploadBytes = Math.round(MAX_UPLOAD_BYTES * serviceScaleMultiplier(settings, "uploads"));
    if (!isAllowedUploadExtension(extension)) return json(res, 400, { error: "Unsupported or unsafe file type" });
    if (size > scaledUploadBytes) return json(res, 413, { error: `File is larger than ${formatServerBytes(scaledUploadBytes)}` });

    const storedName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;
    const draft = createUploadRecord({
      req,
      user,
      originalName,
      storedName,
      category: normalizeCategory(body.category || "document"),
      extension,
      providedType: String(body.mimeType || "application/octet-stream").slice(0, 120),
      privateUpload: Boolean(body.private),
      size,
      url: "",
      persistence: "cloudinary-direct",
    });
    const fields = signedCloudinaryParams(storedName, draft);
    return json(res, 200, {
      uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY_CLOUD_NAME)}/auto/upload`,
      fields,
      draft: safeDirectUploadDraft(draft),
      maxBytes: scaledUploadBytes,
    });
  }

  if (req.method === "POST" && pathname === "/api/uploads/direct-cloudinary/complete") {
    const settings = await readJson(FILES.settings, {});
    if (!settings.serverEnabled && !canManage(user)) return json(res, 423, { error: "Server room is off" });
    const featureError = await featureGateError(settings, "files", user);
    if (featureError) return json(res, 423, { error: featureError });
    const body = await readJsonBody(req);
    const draft = body.draft || {};
    const cloudinary = body.cloudinary || {};
    if (!draft.id || !draft.storedName || !cloudinary.public_id) return json(res, 400, { error: "Cloudinary upload result is incomplete" });
    if (String(draft.user || "") !== user.username) return json(res, 403, { error: "Upload owner mismatch" });
    const originalName = sanitizeFileName(draft.originalName || "upload.bin");
    const extension = path.extname(originalName).toLowerCase();
    if (!isAllowedUploadExtension(extension)) return json(res, 400, { error: "Unsupported or unsafe file type" });

    const fileRecord = {
      ...draft,
      originalName,
      storedName: sanitizeFileName(draft.storedName || `${draft.id}${extension}`),
      category: normalizeCategory(draft.category || "document"),
      kind: classifyFile(extension, draft.mimeType),
      mimeType: mimeTypes[extension] || draft.mimeType || "application/octet-stream",
      size: Number(cloudinary.bytes || draft.size || 0),
      user: user.username,
      private: Boolean(draft.private),
      createdAt: draft.createdAt || new Date().toISOString(),
      url: `/api/files/${draft.id}/download`,
      persistence: "cloudinary-direct",
      cloudStorage: "cloudinary",
      cloudinaryPublicId: String(cloudinary.public_id || ""),
      cloudinaryResourceType: String(cloudinary.resource_type || "auto"),
      cloudinarySecureUrl: String(cloudinary.secure_url || ""),
      cloudinaryVersion: String(cloudinary.version || ""),
    };
    if (!fileRecord.cloudinarySecureUrl) return json(res, 400, { error: "Cloudinary did not return a secure file URL" });
    const files = await readJson(FILES.uploads, []);
    files.unshift(fileRecord);
    await writeJson(FILES.uploads, files);
    await addSystemLog("file.uploaded", user.username, { id: fileRecord.id, name: originalName, kind: fileRecord.kind, size: fileRecord.size, private: fileRecord.private, provider: "cloudinary-direct-browser" }, req);
    broadcastFileNew(fileRecord);
    return json(res, 201, { file: safeFileRecord(fileRecord, user) });
  }

  if (req.method === "POST" && pathname === "/api/announcements") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const title = String(body.title || "").trim().slice(0, 100);
    const message = String(body.message || body.body || "").trim().slice(0, 1200);
    const scope = String(body.scope || "all").toLowerCase() === "room" ? "room" : "all";
    const roomId = scope === "room" ? String(body.roomId || "").trim() : "";
    if (!title) return json(res, 400, { error: "Announcement title is required" });
    if (!message) return json(res, 400, { error: "Announcement message is required" });

    const rooms = await readJson(FILES.rooms, []);
    const room = scope === "room" ? rooms.find((entry) => entry.id === roomId) : null;
    if (scope === "room" && !room) return json(res, 404, { error: "Room not found" });

    const announcements = await readJson(FILES.announcements, []);
    const announcement = {
      id: crypto.randomUUID(),
      title,
      message,
      scope,
      roomId: room ? room.id : "",
      roomName: room ? room.name : "",
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: user.username,
    };
    const next = [announcement, ...announcements].slice(0, 200);
    await writeJson(FILES.announcements, next);
    await addSystemLog("announcement.created", user.username, { id: announcement.id, scope, roomId: announcement.roomId }, req);
    await notifyAdminEmails("Inner announcement posted", [
      `${user.username} posted an announcement.`,
      `Title: ${title}`,
      `Scope: ${scope === "room" ? `Room ${room ? room.name : roomId}` : "Whole platform"}`,
      "",
      message,
    ].join("\n"));
    broadcastAnnouncements(next, rooms);
    return json(res, 201, { announcement });
  }

  const announcementDeleteMatch = pathname.match(/^\/api\/announcements\/([^/]+)$/);
  if (req.method === "DELETE" && announcementDeleteMatch) {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const id = decodeURIComponent(announcementDeleteMatch[1]);
    const [announcements, rooms] = await Promise.all([readJson(FILES.announcements, []), readJson(FILES.rooms, [])]);
    const next = announcements.filter((entry) => entry.id !== id);
    if (next.length === announcements.length) return json(res, 404, { error: "Announcement not found" });
    await writeJson(FILES.announcements, next);
    await addSystemLog("announcement.deleted", user.username, { id }, req);
    broadcastAnnouncements(next, rooms);
    return json(res, 200, { announcements: safeAnnouncements(next, user, rooms) });
  }

  if (req.method === "GET" && pathname === "/api/files") {
    const files = await readJson(FILES.uploads, []);
    return json(res, 200, { files: safeFileRecords(files, user) });
  }

  const fileDownloadMatch = pathname.match(/^\/api\/files\/([^/]+)\/download$/);
  if (req.method === "GET" && fileDownloadMatch) {
    const id = decodeURIComponent(fileDownloadMatch[1]);
    const files = await readJson(FILES.uploads, []);
    const record = files.find((entry) => entry.id === id);
    if (!record) return text(res, 404, "File not found");
    if (!canAccessFileRecord(record, user)) return text(res, 403, "Private file");
    return serveFileRecord(req, res, record);
  }

  if (req.method === "POST" && pathname === "/api/profile") {
    const settings = await readJson(FILES.settings, {});
    const featureError = await featureGateError(settings, "profiles", user);
    if (featureError) return json(res, 423, { error: featureError });
    const body = await readJsonBody(req);
    const profiles = await readJson(FILES.profiles, {});
    const previous = profiles[user.username] || defaultProfile(user.username);
    const next = sanitizeProfile({
      ...previous,
      displayName: body.displayName,
      bio: body.bio,
      avatarUrl: body.avatarUrl,
      bannerUrl: body.bannerUrl,
      badges: body.badges,
      customStatus: body.customStatus,
      status: body.status,
      invisible: Boolean(body.invisible),
      theme: body.theme,
      customTheme: body.customTheme,
      updatedAt: new Date().toISOString(),
    });
    profiles[user.username] = next;
    await writeJson(FILES.profiles, profiles);
    broadcast({ type: "profiles:update", profiles: safeProfiles(profiles, await readJson(FILES.users, []), user) });
    return json(res, 200, { profile: next, profiles: safeProfiles(profiles, await readJson(FILES.users, []), user) });
  }

  if (req.method === "POST" && pathname === "/api/friends/request") {
    const settings = await readJson(FILES.settings, {});
    const featureError = await featureGateError(settings, "friends", user);
    if (featureError) return json(res, 423, { error: featureError });
    const body = await readJsonBody(req);
    const to = String(body.to || "").trim();
    if (!to || to.toLowerCase() === user.username.toLowerCase()) return json(res, 400, { error: "Choose another user" });
    const users = await readJson(FILES.users, []);
    const recipient = users.find((entry) => entry.username.toLowerCase() === to.toLowerCase());
    if (!recipient) return json(res, 404, { error: "Account not found" });
    const friends = await readJson(FILES.friends, { requests: [], friendships: [] });
    if (areFriends(friends, user.username, recipient.username)) return json(res, 409, { error: "Already friends" });
    const existing = friends.requests.find((request) =>
      request.status === "pending" &&
      ((request.from === user.username && request.to === recipient.username) ||
        (request.from === recipient.username && request.to === user.username))
    );
    if (existing) return json(res, 409, { error: "Friend request already pending" });
    const request = {
      id: crypto.randomUUID(),
      from: user.username,
      to: recipient.username,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    friends.requests.unshift(request);
    await writeJson(FILES.friends, friends);
    broadcastFriendUpdate(friends, user.username, recipient.username);
    return json(res, 201, { friends: safeFriendState(friends, user) });
  }

  if (req.method === "POST" && pathname === "/api/friends/respond") {
    const body = await readJsonBody(req);
    const id = String(body.id || "");
    const action = String(body.action || "").toLowerCase();
    if (!["accept", "decline"].includes(action)) return json(res, 400, { error: "Use accept or decline" });
    const friends = await readJson(FILES.friends, { requests: [], friendships: [] });
    const request = friends.requests.find((entry) => entry.id === id && entry.to === user.username && entry.status === "pending");
    if (!request) return json(res, 404, { error: "Friend request not found" });
    request.status = action === "accept" ? "accepted" : "declined";
    request.updatedAt = new Date().toISOString();
    if (action === "accept" && !areFriends(friends, request.from, request.to)) {
      friends.friendships.push({
        id: crypto.randomUUID(),
        users: [request.from, request.to],
        createdAt: new Date().toISOString(),
      });
    }
    await writeJson(FILES.friends, friends);
    broadcastFriendUpdate(friends, request.from, request.to);
    return json(res, 200, { friends: safeFriendState(friends, user) });
  }

  if (req.method === "POST" && pathname === "/api/friends/remove") {
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();
    const friends = await readJson(FILES.friends, { requests: [], friendships: [] });
    friends.friendships = friends.friendships.filter((entry) => !friendPair(entry, user.username, username));
    friends.requests = friends.requests.filter((entry) => !friendRequestPair(entry, user.username, username));
    await writeJson(FILES.friends, friends);
    broadcastFriendUpdate(friends, user.username, username);
    return json(res, 200, { friends: safeFriendState(friends, user) });
  }

  if (req.method === "POST" && pathname === "/api/reports") {
    const body = await readJsonBody(req);
    const [reports, messages, dms, users] = await Promise.all([
      readJson(FILES.reports, []),
      readJson(FILES.messages, []),
      readJson(FILES.dms, []),
      readJson(FILES.users, []),
    ]);
    const targetType = String(body.targetType || "message").slice(0, 40);
    const targetId = String(body.targetId || "").slice(0, 120);
    const target = targetType === "dm"
      ? dms.find((entry) => entry.id === targetId)
      : messages.find((entry) => entry.id === targetId);
    const report = {
      id: crypto.randomUUID(),
      reporter: user.username,
      reporterContact: userContactSnapshot(users, user.username),
      targetType,
      targetId,
      targetSender: target ? String(target.user || target.from || "").slice(0, 80) : "",
      targetSenderContact: target ? userContactSnapshot(users, String(target.user || target.from || "")) : null,
      targetText: target ? String(target.text || "").slice(0, 1000) : "",
      reason: String(body.reason || "").trim().slice(0, 500),
      status: "open",
      createdAt: new Date().toISOString(),
    };
    if (!report.reason) return json(res, 400, { error: "Report reason is required" });
    reports.unshift(report);
    await writeJson(FILES.reports, reports);
    await addModerationLog(user.username, "report:create", `${report.targetType}:${report.targetId}`, report.reason);
    await notifyAdminEmails("Inner report", [
      `${user.username} reported ${report.targetType}:${report.targetId}`,
      `Reporter contact: ${formatContactSnapshot(report.reporterContact)}`,
      `Sender: ${report.targetSender || "unknown"}`,
      `Sender contact: ${formatContactSnapshot(report.targetSenderContact)}`,
      `Message: ${report.targetText || "(not found)"}`,
      `Reason: ${report.reason}`,
    ].join("\n"));
    broadcastManagers({ type: "reports:update", reports: safeActiveReports(reports) });
    return json(res, 201, { report });
  }

  if (req.method === "POST" && pathname === "/api/reports/update") {
    if (!canModerate(user)) return json(res, 403, { error: "Moderator access required" });
    const body = await readJsonBody(req);
    const reports = await readJson(FILES.reports, []);
    const index = reports.findIndex((entry) => entry.id === String(body.id || ""));
    if (index === -1) return json(res, 404, { error: "Report not found" });
    reports[index] = {
      ...reports[index],
      status: normalizeReportStatus(body.status),
      note: String(body.note || reports[index].note || "").slice(0, 500),
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    await writeJson(FILES.reports, reports);
    await addModerationLog(user.username, "report:update", reports[index].targetId, reports[index].status);
    const activeReports = safeActiveReports(reports);
    broadcastManagers({ type: "reports:update", reports: activeReports });
    return json(res, 200, { reports: activeReports });
  }

  if (req.method === "POST" && pathname === "/api/read-receipts") {
    const body = await readJsonBody(req);
    const context = normalizeReceiptContext(body.context || "messages");
    let targetId = String(body.targetId || "main").trim().slice(0, 120) || "main";
    if (context === "dm" && !targetId.includes("|")) targetId = directReceiptTarget(user.username, targetId);
    if (!(await canAccessReceiptContext(context, targetId, user))) return json(res, 403, { error: "Read receipt access denied" });
    const receipts = await readJson(FILES.readReceipts, {});
    const key = receiptKey(context, targetId);
    const now = new Date().toISOString();
    const previous = receipts[key] && typeof receipts[key] === "object" ? receipts[key] : {};
    receipts[key] = {
      ...previous,
      [user.username]: now,
    };
    await writeJson(FILES.readReceipts, receipts);
    const payload = { type: "read-receipts:update", context, targetId, receipts: { [key]: receipts[key] } };
    if (context === "messages") broadcast(payload);
    else broadcastReceiptContext(payload, context, targetId, user);
    return json(res, 200, { readReceipts: safeReadReceipts(receipts, user) });
  }

  if (req.method === "POST" && pathname === "/api/logs/wipe") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    if (String(body.confirm || "").toUpperCase() !== "WIPE") return json(res, 400, { error: "Type WIPE to clear logs" });
    await Promise.all([writeJson(FILES.logs, []), writeJson(FILES.moderationLogs, [])]);
    await addSystemLog("logs.wiped", user.username, { note: String(body.note || "").slice(0, 160) }, req);
    const logs = await readJson(FILES.logs, []);
    broadcastManagers({ type: "logs:update", logs });
    broadcastManagers({ type: "moderation:update", moderationLogs: [] });
    return json(res, 200, { logs, moderationLogs: [] });
  }

  if (req.method === "POST" && pathname === "/api/wipe/reports") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    if (String(body.confirm || "").toUpperCase() !== "WIPE") return json(res, 400, { error: "Type WIPE to clear reports" });
    await writeJson(FILES.reports, []);
    await addSystemLog("reports.wiped", user.username, {}, req);
    broadcastManagers({ type: "reports:update", reports: [] });
    return json(res, 200, { reports: [] });
  }

  if (req.method === "POST" && pathname === "/api/wipe/uploads") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    if (String(body.confirm || "").toUpperCase() !== "WIPE") return json(res, 400, { error: "Type WIPE to clear uploads" });
    const files = await readJson(FILES.uploads, []);
    for (const record of files) {
      if (record && record.storedName) await fsp.rm(path.join(UPLOAD_DIR, record.storedName), { force: true }).catch(() => {});
      await deleteCloudUpload(record).catch(() => {});
    }
    await writeJson(FILES.uploads, []);
    await addSystemLog("uploads.wiped", user.username, { count: files.length }, req);
    broadcast({ type: "files:wipe" });
    return json(res, 200, { files: [] });
  }

  if (req.method === "POST" && pathname === "/api/wipe/rooms") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    if (String(body.confirm || "").toUpperCase() !== "WIPE") return json(res, 400, { error: "Type WIPE to reset rooms" });
    await createBackup(user.username).catch(() => null);
    const mainRoom = { id: "main", name: "Main", createdAt: new Date().toISOString(), createdBy: user.username };
    const messages = await readJson(FILES.messages, []);
    await Promise.all([
      writeJson(FILES.rooms, [mainRoom]),
      writeJson(FILES.messages, messages.filter((entry) => (entry.roomId || "main") === "main")),
      writeJson(FILES.invites, []),
    ]);
    await addSystemLog("rooms.wiped", user.username, {}, req);
    broadcast({ type: "rooms:update", rooms: safeRooms([mainRoom]) });
    return json(res, 200, { rooms: safeRooms([mainRoom]) });
  }

  if (req.method === "POST" && pathname === "/api/store/items") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const name = String(body.name || "").trim().slice(0, 80);
    const description = String(body.description || "").trim().slice(0, 500);
    const priceCents = Math.max(0, Math.round(Number(body.priceCents || 0)));
    const currency = normalizeCurrency(body.currency);
    const paymentLink = normalizeOptionalUrl(body.paymentLink);
    if (name.length < 2) return json(res, 400, { error: "Item name must be at least 2 characters" });
    if (priceCents <= 0) return json(res, 400, { error: "Price must be greater than 0" });
    if (String(body.paymentLink || "").trim() && !paymentLink) {
      return json(res, 400, { error: "Payment link must start with http:// or https://" });
    }

    const store = await readJson(FILES.store, { items: [], orders: [] });
    const item = {
      id: crypto.randomUUID(),
      name,
      description,
      priceCents,
      currency,
      paymentLink,
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: user.username,
    };
    store.items.unshift(item);
    await writeJson(FILES.store, store);
    broadcastStoreUpdate(store, "");
    return json(res, 201, { store: safeStore(store, user) });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/store/items/")) {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const id = pathname.split("/").pop();
    const store = await readJson(FILES.store, { items: [], orders: [] });
    const item = store.items.find((entry) => entry.id === id);
    if (!item) return json(res, 404, { error: "Store item not found" });
    store.items = store.items.filter((entry) => entry.id !== id);
    await writeJson(FILES.store, store);
    broadcastStoreUpdate(store, "");
    return json(res, 200, { store: safeStore(store, user) });
  }

  if (req.method === "POST" && pathname === "/api/store/orders") {
    const body = await readJsonBody(req);
    const itemId = String(body.itemId || "");
    const note = String(body.note || "").trim().slice(0, 500);
    const store = await readJson(FILES.store, { items: [], orders: [] });
    const item = store.items.find((entry) => entry.id === itemId && entry.active !== false);
    if (!item) return json(res, 404, { error: "Store item not found" });

    const order = {
      id: crypto.randomUUID(),
      itemId: item.id,
      itemName: item.name,
      priceCents: item.priceCents,
      currency: item.currency,
      paymentLink: item.paymentLink || "",
      user: user.username,
      status: "pending",
      note,
      sourceIp: getClientIp(req),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.orders.unshift(order);
    await writeJson(FILES.store, store);
    broadcastStoreUpdate(store, order.user);
    return json(res, 201, { store: safeStore(store, user), order });
  }

  if (req.method === "POST" && pathname === "/api/store/orders/update") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const id = String(body.id || "");
    const status = normalizeOrderStatus(body.status);
    const store = await readJson(FILES.store, { items: [], orders: [] });
    const index = store.orders.findIndex((entry) => entry.id === id);
    if (index === -1) return json(res, 404, { error: "Order not found" });
    store.orders[index] = {
      ...store.orders[index],
      status,
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    await writeJson(FILES.store, store);
    broadcastStoreUpdate(store, store.orders[index].user);
    return json(res, 200, { store: safeStore(store, user) });
  }

  if (req.method === "POST" && pathname === "/api/ai/suggest") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const prompt = String(body.prompt || "").trim().slice(0, 2000);
    if (prompt.length < 4) return json(res, 400, { error: "Tell the AI what change you want" });

    const aiRequests = await readJson(FILES.aiRequests, []);
    const suggestion = await generateAiSuggestion(prompt);
    const request = {
      id: crypto.randomUUID(),
      prompt,
      response: suggestion.text,
      configured: suggestion.configured,
      createdAt: new Date().toISOString(),
      createdBy: user.username,
    };
    aiRequests.push(request);
    await writeJson(FILES.aiRequests, aiRequests.slice(-200));
    broadcastManagers({ type: "ai:update", aiRequests: aiRequests.slice(-100) });
    return json(res, 201, { request, aiRequests: aiRequests.slice(-100) });
  }

  if (req.method === "POST" && pathname === "/api/ai/key") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const mode = String(body.mode || "set").toLowerCase();
    if (mode === "clear") {
      await writeJson(FILES.ai, { apiKey: "", updatedAt: new Date().toISOString(), updatedBy: user.username });
      return json(res, 200, { aiConfigured: Boolean(process.env.OPENAI_API_KEY) });
    }
    const apiKey = String(body.apiKey || "").trim();
    if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(apiKey)) return json(res, 400, { error: "Paste a valid OpenAI API key" });
    await writeJson(FILES.ai, {
      apiKey,
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    });
    return json(res, 200, { aiConfigured: true });
  }

  if (req.method === "POST" && pathname === "/api/rooms") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const name = String(body.name || "").trim().slice(0, 80);
    if (name.length < 2) return json(res, 400, { error: "Room name must be at least 2 characters" });

    const rooms = await readJson(FILES.rooms, []);
    if (rooms.some((room) => room.name.toLowerCase() === name.toLowerCase())) {
      return json(res, 409, { error: "Room already exists" });
    }

    const room = {
      id: crypto.randomUUID(),
      name,
      icon: String(body.icon || "").trim().slice(0, 12),
      banner: normalizeOptionalUrl(body.banner),
      theme: normalizeRoomTheme(body.theme),
      category: String(body.category || "General").trim().slice(0, 80) || "General",
      private: Boolean(body.private),
      inviteOnly: Boolean(body.inviteOnly),
      passwordHash: String(body.password || "").trim().length >= 1 ? hashPassword(String(body.password || "")) : "",
      allowedUsers: normalizeUsernameList(body.allowedUsers),
      moderators: normalizeUsernameList(body.moderators),
      createdAt: new Date().toISOString(),
      createdBy: user.username,
    };
    rooms.push(room);
    await writeJson(FILES.rooms, rooms);
    await addSystemLog("room.created", user.username, { roomId: room.id, name: room.name, private: room.private, inviteOnly: room.inviteOnly }, req);
    broadcast({ type: "room:new", room: safeRoom(room) });
    return json(res, 201, { room: safeRoom(room), rooms: safeRooms(rooms) });
  }

  if (req.method === "POST" && pathname === "/api/rooms/update") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const id = String(body.id || "").trim();
    const rooms = await readJson(FILES.rooms, []);
    const index = rooms.findIndex((entry) => entry.id === id);
    if (index === -1) return json(res, 404, { error: "Room not found" });
    const previous = rooms[index];
    rooms[index] = sanitizeRoom({
      ...previous,
      name: String(body.name || previous.name || "Room").trim().slice(0, 80),
      icon: body.icon,
      banner: body.banner,
      theme: body.theme,
      category: body.category,
      private: Boolean(body.private),
      inviteOnly: Boolean(body.inviteOnly),
      passwordHash: String(body.password || "").length ? hashPassword(String(body.password || "")) : previous.passwordHash || "",
      allowedUsers: body.allowedUsers,
      moderators: body.moderators,
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    });
    await writeJson(FILES.rooms, rooms);
    broadcast({ type: "rooms:update", rooms: safeRooms(rooms) });
    return json(res, 200, { rooms: safeRooms(rooms), room: safeRoom(rooms[index]) });
  }

  if (req.method === "POST" && pathname === "/api/rooms/invites") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const settings = await readJson(FILES.settings, {});
    const featureError = await featureGateError(settings, "invites", user);
    if (featureError) return json(res, 423, { error: featureError });
    const body = await readJsonBody(req);
    const roomId = String(body.roomId || "").trim();
    const rooms = await readJson(FILES.rooms, []);
    const room = rooms.find((entry) => entry.id === roomId);
    if (!room) return json(res, 404, { error: "Room not found" });
    const invites = await readJson(FILES.invites, []);
    const invite = {
      id: crypto.randomUUID(),
      code: crypto.randomBytes(8).toString("hex"),
      roomId,
      roomName: room.name,
      createdAt: new Date().toISOString(),
      createdBy: user.username,
      expiresAt: body.expiresMinutes
        ? new Date(Date.now() + Math.max(1, Number(body.expiresMinutes)) * 60 * 1000).toISOString()
        : "",
      maxUses: Math.max(0, Number(body.maxUses || 0)),
      uses: [],
    };
    invites.unshift(invite);
    await writeJson(FILES.invites, invites);
    broadcastManagers({ type: "invites:update", invites: invites.slice(-100) });
    return json(res, 201, { invite, invites });
  }

  if (req.method === "POST" && pathname === "/api/rooms/join") {
    const body = await readJsonBody(req);
    const code = String(body.code || "").trim();
    const invites = await readJson(FILES.invites, []);
    const invite = invites.find((entry) => entry.code === code);
    if (!invite || !inviteActive(invite)) return json(res, 404, { error: "Invite link is invalid or expired" });
    const rooms = await readJson(FILES.rooms, []);
    const room = rooms.find((entry) => entry.id === invite.roomId);
    if (!room) return json(res, 404, { error: "Room not found" });
    if (!Array.isArray(room.allowedUsers)) room.allowedUsers = [];
    if (!room.allowedUsers.includes(user.username)) room.allowedUsers.push(user.username);
    if (!Array.isArray(invite.uses)) invite.uses = [];
    invite.uses.push({ username: user.username, usedAt: new Date().toISOString() });
    await Promise.all([writeJson(FILES.rooms, rooms), writeJson(FILES.invites, invites)]);
    broadcast({ type: "rooms:update", rooms: safeRooms(rooms) });
    return json(res, 200, { room: safeRoom(room), rooms: safeRooms(rooms) });
  }

  if (req.method === "POST" && pathname === "/api/rooms/unlock") {
    const body = await readJsonBody(req);
    const roomId = String(body.roomId || "").trim();
    const password = String(body.password || "");
    const rooms = await readJson(FILES.rooms, []);
    const room = rooms.find((entry) => entry.id === roomId);
    if (!room) return json(res, 404, { error: "Room not found" });
    if (!room.passwordHash) return json(res, 200, { room: safeRoom(room), rooms: safeRooms(rooms) });
    if (!verifyPassword(password, room.passwordHash)) return json(res, 403, { error: "Room password is incorrect" });
    if (!Array.isArray(room.allowedUsers)) room.allowedUsers = [];
    if (!room.allowedUsers.includes(user.username)) room.allowedUsers.push(user.username);
    await writeJson(FILES.rooms, rooms);
    await addSystemLog("room.password.unlocked", user.username, { roomId, roomName: room.name }, req);
    broadcast({ type: "rooms:update", rooms: safeRooms(rooms) });
    return json(res, 200, { room: safeRoom(room), rooms: safeRooms(rooms) });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/rooms/")) {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const id = decodeURIComponent(pathname.split("/").pop() || "");
    if (id === "main") return json(res, 400, { error: "The main room cannot be deleted" });

    const rooms = await readJson(FILES.rooms, []);
    const room = rooms.find((entry) => entry.id === id);
    if (!room) return json(res, 404, { error: "Room not found" });

    const nextRooms = rooms.filter((entry) => entry.id !== id);
    const messages = await readJson(FILES.messages, []);
    const nextMessages = messages.filter((entry) => (entry.roomId || "main") !== id);
    await Promise.all([writeJson(FILES.rooms, nextRooms), writeJson(FILES.messages, nextMessages)]);
    await addSystemLog("room.deleted", user.username, { roomId: id, name: room.name }, req);
    broadcast({ type: "room:delete", id });
    return json(res, 200, { rooms: safeRooms(nextRooms) });
  }

  if (req.method === "POST" && pathname === "/api/dm-groups") {
    const settings = await readJson(FILES.settings, {});
    if (!settings.serverEnabled && !canManage(user)) return json(res, 423, { error: "Server room is off" });
    const featureError = await featureGateError(settings, "dms", user);
    if (featureError) return json(res, 423, { error: featureError });

    const body = await readJsonBody(req);
    const users = await readJson(FILES.users, []);
    const validUsers = new Map(users.map((entry) => [entry.username.toLowerCase(), entry.username]));
    const participants = normalizeUsernameList(body.participants)
      .map((name) => validUsers.get(name.toLowerCase()))
      .filter(Boolean);
    participants.push(user.username);
    const uniqueParticipants = Array.from(new Set(participants));
    if (uniqueParticipants.length < 3) return json(res, 400, { error: "Group DMs need at least 3 people including you" });
    if (!canManage(user)) {
      const friends = await readJson(FILES.friends, { requests: [], friendships: [] });
      const blocked = uniqueParticipants.filter((name) => name !== user.username && !areFriends(friends, user.username, name));
      if (blocked.length) return json(res, 403, { error: `Group DMs can only include accepted friends: ${blocked.join(", ")}` });
    }

    const groups = await readJson(FILES.dmGroups, []);
    const group = sanitizeDmGroup({
      id: crypto.randomUUID(),
      name: body.name,
      participants: uniqueParticipants,
      createdAt: new Date().toISOString(),
      createdBy: user.username,
    });
    groups.unshift(group);
    await writeJson(FILES.dmGroups, groups.slice(0, 300));
    await addSystemLog("dm.group.created", user.username, { groupId: group.id, name: group.name, participants: group.participants }, req);
    broadcastDmGroupUpdate(groups, group.participants);
    return json(res, 201, { group, dmGroups: safeDmGroups(groups, user) });
  }

  if (req.method === "POST" && pathname === "/api/dms") {
    const settings = await readJson(FILES.settings, {});
    if (!settings.serverEnabled && !canManage(user)) return json(res, 423, { error: "Server room is off" });
    const featureError = await featureGateError(settings, "dms", user);
    if (featureError) return json(res, 423, { error: featureError });

    const body = await readJsonBody(req);
    const to = String(body.to || "").trim();
    const groupId = String(body.groupId || "").trim();
    const textValue = String(body.text || "").trim();
    if (!to && !groupId) return json(res, 400, { error: "Choose who to message" });
    if (to && to.toLowerCase() === user.username.toLowerCase()) return json(res, 400, { error: "Choose another account" });
    const attachment = await resolveChatAttachment(body.attachment);
    if (!textValue && !attachment) return json(res, 400, { error: "Message cannot be empty" });
    if (textValue.length > 2000) return json(res, 400, { error: "Message is too long" });

    const users = await readJson(FILES.users, []);
    let recipient = null;
    let group = null;
    let participants = [];
    if (groupId) {
      const groups = await readJson(FILES.dmGroups, []);
      group = groups.find((entry) => entry.id === groupId);
      if (!group) return json(res, 404, { error: "Group DM not found" });
      if (!Array.isArray(group.participants) || !group.participants.includes(user.username)) {
        return json(res, 403, { error: "You are not in this group DM" });
      }
      participants = group.participants;
    } else {
      recipient = users.find((entry) => entry.username.toLowerCase() === to.toLowerCase());
      if (!recipient) return json(res, 404, { error: "Account not found" });
      if (!canManage(user)) {
        const friends = await readJson(FILES.friends, { requests: [], friendships: [] });
        if (!areFriends(friends, user.username, recipient.username)) {
          return json(res, 403, { error: "You can only DM accepted friends" });
        }
      }
      participants = [user.username, recipient.username];
    }

    const dms = await readJson(FILES.dms, []);
    const dm = {
      id: crypto.randomUUID(),
      kind: group ? "group" : "direct",
      from: user.username,
      to: group ? group.name : recipient.username,
      groupId: group ? group.id : "",
      groupName: group ? group.name : "",
      participants,
      text: textValue,
      attachment,
      sourceIp: getClientIp(req),
      sourceHost: req.headers.host || "",
      sourceAgent: String(req.headers["user-agent"] || "").slice(0, 240),
      sourceDevice: deviceSignature(req),
      approximateLocation: approximateLocationFromIp(getClientIp(req)),
      createdAt: new Date().toISOString(),
    };
    dms.push(dm);
    await writeJson(FILES.dms, dms.slice(-3000));
    await addSystemLog(group ? "dm.group.sent" : "dm.sent", user.username, { to: dm.to, groupId: dm.groupId, hasAttachment: Boolean(attachment) }, req);
    broadcastDm({ type: "dm:new", dm }, dm);
    return json(res, 201, { dm });
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/dms/")) {
    const id = decodeURIComponent(pathname.split("/").pop() || "");
    const body = await readJsonBody(req);
    const textValue = String(body.text || "").trim().slice(0, 2000);
    if (!textValue) return json(res, 400, { error: "DM cannot be empty" });
    const dms = await readJson(FILES.dms, []);
    const index = dms.findIndex((entry) => entry.id === id);
    if (index === -1) return json(res, 404, { error: "DM not found" });
    const dm = dms[index];
    if (dm.from !== user.username && !canModerate(user)) return json(res, 403, { error: "You can edit only your DMs" });
    dms[index] = {
      ...dm,
      text: textValue,
      editedAt: new Date().toISOString(),
      editedBy: user.username,
    };
    await writeJson(FILES.dms, dms);
    await addSystemLog("dm.edited", user.username, { id, groupId: dm.groupId || "" }, req);
    broadcastDm({ type: "dm:update", dm: dms[index] }, dms[index]);
    return json(res, 200, { dm: dms[index] });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/dm-groups/")) {
    const id = decodeURIComponent(pathname.split("/").pop() || "");
    const groups = await readJson(FILES.dmGroups, []);
    const group = groups.map(sanitizeDmGroup).find((entry) => entry.id === id);
    if (!group) return json(res, 404, { error: "Group DM not found" });
    if (!canManage(user) && group.createdBy !== user.username) return json(res, 403, { error: "Only the group creator or admin can delete this group" });
    const nextGroups = groups.filter((entry) => String(entry.id) !== id);
    const dms = await readJson(FILES.dms, []);
    const nextDms = dms.filter((entry) => entry.groupId !== id);
    await Promise.all([writeJson(FILES.dmGroups, nextGroups), writeJson(FILES.dms, nextDms)]);
    await addSystemLog("dm.group.deleted", user.username, { groupId: id, name: group.name, removedMessages: dms.length - nextDms.length }, req);
    broadcastDmGroupUpdate(nextGroups, group.participants);
    broadcastDm({ type: "dm-group:delete", id }, { participants: group.participants });
    return json(res, 200, { ok: true, dmGroups: safeDmGroups(nextGroups, user) });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/dms/")) {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const id = pathname.split("/").pop();
    const dms = await readJson(FILES.dms, []);
    const dm = dms.find((entry) => entry.id === id);
    if (!dm) return json(res, 404, { error: "DM not found" });

    const next = dms.filter((entry) => entry.id !== id);
    await writeJson(FILES.dms, next);
    await addSystemLog("dm.deleted", user.username, { id, participants: Array.isArray(dm.participants) ? dm.participants : [] }, req);
    broadcastDm({ type: "dm:delete", id }, dm);
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/features/lock") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const feature = String(body.feature || "").toLowerCase();
    if (!allowedFeatureLocks.has(feature)) return json(res, 400, { error: "Unknown feature" });

    const minutes = Math.max(0, Math.min(525600, Number(body.minutes || 0)));
    const reason = String(body.reason || "").trim().slice(0, 160);
    const settings = await readJson(FILES.settings, {});
    const featureLocks = { ...(settings.featureLocks || {}) };
    if (minutes > 0) {
      featureLocks[feature] = {
        disabledUntil: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
        disabledBy: user.username,
        reason,
      };
    } else {
      delete featureLocks[feature];
    }

    const next = {
      ...settings,
      featureLocks,
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    await writeJson(FILES.settings, next);
    await addSystemLog("feature.lock.updated", user.username, { feature, minutes, reason }, req);
    broadcast({ type: "state:update", settings: safeSettings(next) });
    return json(res, 200, { settings: safeSettings(next) });
  }

  if (req.method === "GET" && pathname === "/api/backups") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    return json(res, 200, { backups: await listBackups() });
  }

  if (req.method === "POST" && pathname === "/api/backups") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const backup = await createBackup(user.username);
    const backups = await listBackups();
    broadcastManagers({ type: "backups:update", backups });
    return json(res, 201, { backup, backups });
  }

  if (req.method === "POST" && pathname === "/api/backups/restore") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const fileName = sanitizeBackupName(body.fileName || "");
    if (!fileName) return json(res, 400, { error: "Choose a backup to restore" });
    await createBackup(user.username).catch(() => null);
    const restored = await restoreBackup(fileName, user.username);
    const backups = await listBackups();
    sessions.clear();
    broadcast({ type: "force:logout", reason: "Backup restored. Sign in again." });
    broadcastManagers({ type: "backups:update", backups });
    return json(res, 200, { ok: true, restored, backups });
  }

  if (req.method === "GET" && pathname.startsWith("/api/backups/")) {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const fileName = sanitizeBackupName(pathname.split("/").pop() || "");
    if (!fileName) return json(res, 400, { error: "Bad backup name" });
    return serveBackup(res, fileName);
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/backups/")) {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const fileName = sanitizeBackupName(pathname.split("/").pop() || "");
    if (!fileName) return json(res, 400, { error: "Bad backup name" });
    await fsp.rm(path.join(BACKUP_DIR, fileName), { force: true });
    const backups = await listBackups();
    broadcastManagers({ type: "backups:update", backups });
    return json(res, 200, { backups });
  }

  if (req.method === "POST" && pathname === "/api/account-requests/update") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const id = String(body.id || "");
    const status = normalizeAccountRequestStatus(body.status);
    const requests = await readJson(FILES.accountRequests, []);
    const index = requests.findIndex((entry) => entry.id === id);
    if (index === -1) return json(res, 404, { error: "Account request not found" });
    requests[index] = sanitizeAccountRequest({
      ...requests[index],
      status,
      adminNote: body.adminNote,
      declinedAt: status === "declined" ? new Date().toISOString() : requests[index].declinedAt,
      declinedBy: status === "declined" ? user.username : requests[index].declinedBy,
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    });
    await writeJson(FILES.accountRequests, requests);
    await addSystemLog("account.request.updated", user.username, { requestUsername: requests[index].username, status }, req);
    broadcastManagers({ type: "account-requests:update", accountRequests: safeAccountRequests(requests) });
    return json(res, 200, { accountRequests: safeAccountRequests(requests), request: safeAccountRequest(requests[index]) });
  }

  if (req.method === "POST" && pathname === "/api/account-requests/approve") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const id = String(body.id || "");
    const password = String(body.password || "");
    const role = normalizeRole(body.role || "member");
    if (password.length > 0 && password.length < 4) return json(res, 400, { error: "Password must be at least 4 characters" });
    if (["hmd", "dev"].includes(role) && !canDev(user)) return json(res, 403, { error: "HMD/dev access required" });

    const [requests, users, profiles] = await Promise.all([
      readJson(FILES.accountRequests, []),
      readJson(FILES.users, []),
      readJson(FILES.profiles, {}),
    ]);
    const index = requests.findIndex((entry) => entry.id === id);
    if (index === -1) return json(res, 404, { error: "Account request not found" });
    const request = sanitizeAccountRequest(requests[index]);
    if (request.status === "approved") return json(res, 409, { error: "Request already approved" });
    const nextPasswordHash = password.length >= 4 ? hashPassword(password) : request.passwordHash;
    if (!nextPasswordHash) return json(res, 400, { error: "This request has no password. Set one while approving." });
    if (users.some((entry) => entry.username.toLowerCase() === request.username.toLowerCase())) {
      return json(res, 409, { error: "That username already exists" });
    }

    const now = new Date().toISOString();
    const account = {
      username: request.username,
      role,
      passwordHash: nextPasswordHash,
      passwordPreset: "",
      allowPersistentLogin: Boolean(body.allowPersistentLogin),
      contact: request.contact,
      email: request.email,
      phone: request.phone,
      sourceIp: request.sourceIp,
      sourceDevice: request.sourceDevice,
      sourceAgent: request.sourceAgent,
      approximateLocation: request.approximateLocation,
      createdAt: now,
      createdBy: user.username,
      accountRequestId: request.id,
    };
    users.push(account);
    profiles[request.username] = sanitizeProfile({
      ...defaultProfile(request.username),
      displayName: request.displayName || request.username,
      updatedAt: now,
    });
    requests[index] = sanitizeAccountRequest({
      ...request,
      status: "approved",
      approvedAt: now,
      approvedBy: user.username,
      updatedAt: now,
      updatedBy: user.username,
    });
    await Promise.all([
      writeJson(FILES.users, users),
      writeJson(FILES.profiles, profiles),
      writeJson(FILES.accountRequests, requests),
    ]);
    await addSystemLog("account.request.approved", user.username, { requestUsername: request.username, role }, req);
    await notifyAdminEmails("Inner account approved", [
      `${request.username} was approved by ${user.username}.`,
      `Role: ${role}`,
      `Contact: ${request.contact || "not provided"}`,
      `Original request IP: ${request.sourceIp || "unknown"}`,
      `Original request device: ${request.sourceDevice || "unknown"}`,
      `Time: ${new Date().toISOString()}`,
    ].join("\n"));
    broadcastManagers({ type: "users:update", users: users.map(safeUser) });
    broadcastManagers({ type: "account-requests:update", accountRequests: safeAccountRequests(requests) });
    return json(res, 201, { users: users.map(safeUser), accountRequests: safeAccountRequests(requests), user: safeUser(account) });
  }

  if (req.method === "POST" && pathname === "/api/users") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const username = normalizeUsername(body.username);
    const password = String(body.password || "");
    const role = normalizeRole(body.role);
    if (!username) return json(res, 400, { error: "Use 3-32 letters, numbers, dots, dashes, or underscores" });
    if (username.toLowerCase() === "admin") return json(res, 400, { error: "The admin account already exists" });
    if (["hmd", "dev"].includes(role) && !canDev(user)) return json(res, 403, { error: "HMD/dev access required" });
    if (password.length < 4) return json(res, 400, { error: "Password must be at least 4 characters" });

    const users = await readJson(FILES.users, []);
    if (users.some((entry) => entry.username.toLowerCase() === username.toLowerCase())) {
      return json(res, 409, { error: "Username already exists" });
    }

    users.push({
      username,
      role,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      createdBy: user.username,
      allowPersistentLogin: Boolean(body.allowPersistentLogin),
      bannedUntil: "",
      banReason: "",
    });
    await writeJson(FILES.users, users);
    const profiles = await readJson(FILES.profiles, {});
    profiles[username] = defaultProfile(username);
    await writeJson(FILES.profiles, profiles);
    if (username.toLowerCase() === "admin2") await unmarkDeletedDefault("admin2", user.username);
    await addSystemLog("account.created", user.username, { username, role }, req);
    await notifyAdminEmails("Inner account created", [
      `${user.username} created an account.`,
      `Username: ${username}`,
      `Role: ${role}`,
      `Persistent login: ${body.allowPersistentLogin ? "yes" : "no"}`,
      `Created from IP: ${getClientIp(req) || "unknown"}`,
      `Created from device: ${deviceSignature(req)}`,
      `Time: ${new Date().toISOString()}`,
    ].join("\n"));
    broadcastManagers({ type: "users:update", users: users.map(safeUser) });
    return json(res, 201, { users: users.map(safeUser) });
  }

  if (req.method === "POST" && pathname === "/api/users/update") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();
    if (!username) return json(res, 400, { error: "Choose a user" });

    const users = await readJson(FILES.users, []);
    const index = users.findIndex((entry) => entry.username.toLowerCase() === username.toLowerCase());
    if (index === -1) return json(res, 404, { error: "User not found" });

    const previous = users[index];
    const nextRole = username.toLowerCase() === "admin" ? "admin" : normalizeRole(body.role);
    if (["hmd", "dev"].includes(nextRole) && !canDev(user)) return json(res, 403, { error: "HMD/dev access required" });
    users[index] = {
      ...previous,
      role: nextRole,
      allowPersistentLogin: Boolean(body.allowPersistentLogin),
      mutedUntil: body.mutedUntil !== undefined ? String(body.mutedUntil || "") : previous.mutedUntil || "",
      shadowMuted: body.shadowMuted !== undefined ? Boolean(body.shadowMuted) : Boolean(previous.shadowMuted),
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    await writeJson(FILES.users, users);
    if (previous.role !== nextRole || previous.allowPersistentLogin !== users[index].allowPersistentLogin) {
      expireUserSessions(username);
    }
    broadcastManagers({ type: "users:update", users: users.map(safeUser) });
    return json(res, 200, { users: users.map(safeUser) });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/users/")) {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const username = decodeURIComponent(pathname.split("/").pop() || "");
    if (username.toLowerCase() === "admin") return json(res, 400, { error: "The admin account cannot be deleted" });
    const users = await readJson(FILES.users, []);
    const next = users.filter((entry) => entry.username.toLowerCase() !== username.toLowerCase());
    if (next.length === users.length) return json(res, 404, { error: "User not found" });
    await writeJson(FILES.users, next);
    if (username.toLowerCase() === "admin2") await markDeletedDefault("admin2", user.username);
    expireUserSessions(username);
    broadcastManagers({ type: "users:update", users: next.map(safeUser) });
    return json(res, 200, { users: next.map(safeUser) });
  }

  if (req.method === "POST" && pathname === "/api/users/ban") {
    if (!canModerate(user)) return json(res, 403, { error: "Moderator access required" });
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();
    if (!username) return json(res, 400, { error: "Choose a user" });
    if (username.toLowerCase() === "admin") return json(res, 400, { error: "The main admin account cannot be banned" });

    const minutes = Math.max(0, Number(body.minutes || 0));
    const reason = String(body.reason || "").trim().slice(0, 160);
    const users = await readJson(FILES.users, []);
    const index = users.findIndex((entry) => entry.username.toLowerCase() === username.toLowerCase());
    if (index === -1) return json(res, 404, { error: "User not found" });

    users[index] = {
      ...users[index],
      bannedUntil: minutes > 0 ? new Date(Date.now() + minutes * 60 * 1000).toISOString() : "",
      banReason: minutes > 0 ? reason : "",
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    await writeJson(FILES.users, users);
    await addModerationLog(user.username, minutes > 0 ? "user:ban" : "user:unban", username, reason || `${minutes} minutes`);
    if (minutes > 0) expireUserSessions(username);
    broadcastManagers({ type: "users:update", users: users.map(safeUser) });
    return json(res, 200, { users: users.map(safeUser) });
  }

  if (req.method === "POST" && pathname === "/api/users/mute") {
    if (!canModerate(user)) return json(res, 403, { error: "Moderator access required" });
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();
    const minutes = Math.max(0, Number(body.minutes || 0));
    const shadowMuted = Boolean(body.shadowMuted);
    const users = await readJson(FILES.users, []);
    const index = users.findIndex((entry) => entry.username.toLowerCase() === username.toLowerCase());
    if (index === -1) return json(res, 404, { error: "User not found" });
    users[index] = {
      ...users[index],
      mutedUntil: minutes > 0 ? new Date(Date.now() + minutes * 60 * 1000).toISOString() : "",
      shadowMuted: minutes > 0 && shadowMuted,
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    await writeJson(FILES.users, users);
    await addModerationLog(user.username, minutes > 0 ? "user:mute" : "user:unmute", username, shadowMuted ? "shadow mute" : "");
    broadcastManagers({ type: "users:update", users: users.map(safeUser) });
    return json(res, 200, { users: users.map(safeUser) });
  }

  if (req.method === "POST" && pathname === "/api/users/kick") {
    if (!canModerate(user)) return json(res, 403, { error: "Moderator access required" });
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();
    expireUserSessions(username);
    await addModerationLog(user.username, "user:kick", username, String(body.reason || "").slice(0, 160));
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname.startsWith("/api/messages/") && pathname.endsWith("/reactions")) {
    const parts = pathname.split("/");
    const id = decodeURIComponent(parts[3] || "");
    const body = await readJsonBody(req);
    const emoji = normalizeReaction(body.emoji);
    if (!emoji) return json(res, 400, { error: "Unsupported reaction" });
    const messages = await readJson(FILES.messages, []);
    const index = messages.findIndex((entry) => entry.id === id);
    if (index === -1) return json(res, 404, { error: "Message not found" });
    const reactions = messages[index].reactions && typeof messages[index].reactions === "object" ? messages[index].reactions : {};
    const usersForEmoji = new Set(Array.isArray(reactions[emoji]) ? reactions[emoji] : []);
    if (usersForEmoji.has(user.username)) {
      usersForEmoji.delete(user.username);
    } else {
      usersForEmoji.add(user.username);
    }
    reactions[emoji] = Array.from(usersForEmoji);
    messages[index] = { ...messages[index], reactions };
    await writeJson(FILES.messages, messages);
    broadcast({ type: "message:update", message: messages[index] });
    return json(res, 200, { message: messages[index] });
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/messages/")) {
    const id = decodeURIComponent(pathname.split("/").pop() || "");
    const body = await readJsonBody(req);
    const textValue = String(body.text || "").trim().slice(0, 2000);
    if (!textValue) return json(res, 400, { error: "Message cannot be empty" });
    const messages = await readJson(FILES.messages, []);
    const index = messages.findIndex((entry) => entry.id === id);
    if (index === -1) return json(res, 404, { error: "Message not found" });
    if (messages[index].user !== user.username && !canModerate(user)) return json(res, 403, { error: "You can edit only your messages" });
    const automodError = await checkAutomod(textValue, user);
    if (automodError) return json(res, 400, { error: automodError });
    messages[index] = {
      ...messages[index],
      text: applySlashCommand(textValue),
      editedAt: new Date().toISOString(),
      editedBy: user.username,
    };
    await writeJson(FILES.messages, messages);
    await addSystemLog("message.edited", user.username, { id }, req);
    broadcast({ type: "message:update", message: messages[index] });
    return json(res, 200, { message: messages[index] });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/messages/")) {
    if (!canModerate(user)) return json(res, 403, { error: "Moderator access required" });
    const id = pathname.split("/").pop();
    const messages = await readJson(FILES.messages, []);
    const next = messages.filter((entry) => entry.id !== id);
    if (next.length === messages.length) return json(res, 404, { error: "Message not found" });
    await writeJson(FILES.messages, next);
    broadcast({ type: "message:delete", id });
    return json(res, 200, { ok: true });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/files/")) {
    const id = pathname.split("/").pop();
    const files = await readJson(FILES.uploads, []);
    const record = files.find((entry) => entry.id === id);
    if (!record) return json(res, 404, { error: "File not found" });
    if (!canManage(user) && record.user !== user.username) return json(res, 403, { error: "Admin or uploader access required" });
    const next = files.filter((entry) => entry.id !== id);
    await writeJson(FILES.uploads, next);
    await fsp.rm(path.join(UPLOAD_DIR, record.storedName), { force: true }).catch(() => {});
    await deleteCloudUpload(record).catch(() => {});
    await addSystemLog("file.deleted", user.username, { id, name: record.originalName }, req);
    broadcast({ type: "file:delete", id });
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/settings") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const settings = await readJson(FILES.settings, {});
    const nextServerEnabled =
      typeof body.serverEnabled === "boolean" ? body.serverEnabled : Boolean(settings.serverEnabled);
    const next = {
      ...settings,
      serverEnabled: nextServerEnabled,
      roomName: String(body.roomName || settings.roomName || "Inner").slice(0, 80),
      signupMode: ["open", "request"].includes(String(body.signupMode || settings.signupMode || "").toLowerCase())
        ? String(body.signupMode || settings.signupMode).toLowerCase()
        : DEFAULT_SIGNUP_MODE,
      requireContact: typeof body.requireContact === "boolean" ? body.requireContact : settings.requireContact !== false,
      reportEmails: Array.isArray(body.reportEmails)
        ? body.reportEmails.map((entry) => String(entry || "").trim()).filter(Boolean).slice(0, 4)
        : Array.isArray(settings.reportEmails)
          ? settings.reportEmails.slice(0, 4)
          : REPORT_EMAILS,
      chessUrl: sanitizeExternalUrl(body.chessUrl) || sanitizeExternalUrl(settings.chessUrl) || "https://chessverse.co.in/",
      moderationSettings: {
        ...(settings.moderationSettings || {}),
        ...(body.moderationSettings && typeof body.moderationSettings === "object" ? body.moderationSettings : {}),
        updatedAt: new Date().toISOString(),
        updatedBy: user.username,
      },
      customizations: sanitizeCustomizations({
        ...(settings.customizations || {}),
        ...(body.customizations && typeof body.customizations === "object" ? body.customizations : {}),
        updatedAt: new Date().toISOString(),
        updatedBy: user.username,
      }),
      serviceScale: sanitizeServiceScale(body.serviceScale && typeof body.serviceScale === "object" ? body.serviceScale : settings.serviceScale || {}),
      featureVisibility: sanitizeFeatureVisibility(canOwn(user) && body.featureVisibility && typeof body.featureVisibility === "object" ? body.featureVisibility : settings.featureVisibility || {}),
      paywalls: sanitizePaywalls(canOwn(user) && body.paywalls && typeof body.paywalls === "object" ? body.paywalls : settings.paywalls || {}),
      shutdownAt: nextServerEnabled ? "" : settings.shutdownAt || new Date().toISOString(),
      shutdownBy: nextServerEnabled ? "" : settings.shutdownBy || user.username,
      shutdownReason: nextServerEnabled ? "" : String(body.shutdownReason || settings.shutdownReason || "Admin shutdown").slice(0, 160),
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    await writeJson(FILES.settings, next);
    broadcast({ type: "state:update", settings: safeSettings(next) });
    let kicked = { sessions: 0, clients: 0 };
    if (!next.serverEnabled) {
      kicked = kickNonShutdownUsers();
      await addSystemLog("server.shutdown", user.username, { kicked, roomName: next.roomName }, req);
    } else if (settings.serverEnabled === false) {
      await addSystemLog("server.restart", user.username, { roomName: next.roomName }, req);
    } else {
      await addSystemLog("server.settings.updated", user.username, { roomName: next.roomName }, req);
    }
    return json(res, 200, { settings: safeSettings(next) });
  }

  if (req.method === "POST" && pathname === "/api/vpn") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const existing = await readJson(FILES.vpn, {});
    const location = vpnLocations.includes(body.location) ? body.location : existing.location || "United States";
    const next = {
      ...existing,
      enabled: typeof body.enabled === "boolean" ? body.enabled : Boolean(existing.enabled),
      username: String(body.username || "").trim().slice(0, 80),
      location,
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    if (String(body.password || "").length > 0) {
      next.passwordHash = hashPassword(String(body.password));
    }
    await writeJson(FILES.vpn, next);
    broadcast({ type: "vpn:update", vpn: safeVpn(next) });
    return json(res, 200, { vpn: safeVpn(next) });
  }

  if (req.method === "POST" && pathname === "/api/dev/config") {
    if (!canDev(user)) return json(res, 403, { error: "HMD/dev access required" });
    const body = await readJsonBody(req);
    const existing = await readJson(FILES.devConfig, {});
    const next = {
      ...existing,
      emergencyMode: typeof body.emergencyMode === "boolean" ? body.emergencyMode : Boolean(existing.emergencyMode),
      metricsEnabled: typeof body.metricsEnabled === "boolean" ? body.metricsEnabled : Boolean(existing.metricsEnabled),
      theme: String(body.theme || existing.theme || "midnight").slice(0, 80),
      rollout: body.rollout && typeof body.rollout === "object" ? body.rollout : existing.rollout || {},
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    await writeJson(FILES.devConfig, next);
    await addModerationLog(user.username, "dev:config", "system", next.emergencyMode ? "emergency on" : "config update");
    broadcastManagers({ type: "dev:update", devConfig: next });
    return json(res, 200, { devConfig: next });
  }

  if (req.method === "POST" && pathname === "/api/dev/bots") {
    if (!canDev(user)) return json(res, 403, { error: "HMD/dev access required" });
    const body = await readJsonBody(req);
    const bots = await readJson(FILES.bots, []);
    const bot = {
      id: crypto.randomUUID(),
      name: String(body.name || "Automation bot").trim().slice(0, 80),
      enabled: Boolean(body.enabled),
      commandPrefix: String(body.commandPrefix || "/").slice(0, 8),
      description: String(body.description || "").slice(0, 300),
      createdAt: new Date().toISOString(),
      createdBy: user.username,
    };
    bots.unshift(bot);
    await writeJson(FILES.bots, bots);
    broadcastManagers({ type: "bots:update", bots });
    return json(res, 201, { bots, bot });
  }

  if (req.method === "POST" && pathname === "/api/dev/plugins") {
    if (!canDev(user)) return json(res, 403, { error: "HMD/dev access required" });
    const body = await readJsonBody(req);
    const plugins = await readJson(FILES.plugins, []);
    const plugin = {
      id: crypto.randomUUID(),
      name: String(body.name || "Plugin").trim().slice(0, 80),
      hook: String(body.hook || "message").trim().slice(0, 80),
      enabled: Boolean(body.enabled),
      notes: String(body.notes || "").slice(0, 500),
      createdAt: new Date().toISOString(),
      createdBy: user.username,
    };
    plugins.unshift(plugin);
    await writeJson(FILES.plugins, plugins);
    broadcastManagers({ type: "plugins:update", plugins });
    return json(res, 201, { plugins, plugin });
  }

  if (req.method === "POST" && pathname === "/api/automod") {
    if (!canModerate(user)) return json(res, 403, { error: "Moderator access required" });
    const body = await readJsonBody(req);
    const existing = await readJson(FILES.automod, {});
    const next = {
      ...existing,
      enabled: typeof body.enabled === "boolean" ? body.enabled : Boolean(existing.enabled),
      spamWindowSeconds: Math.max(2, Math.min(120, Number(body.spamWindowSeconds || existing.spamWindowSeconds || 8))),
      maxMessagesPerWindow: Math.max(2, Math.min(50, Number(body.maxMessagesPerWindow || existing.maxMessagesPerWindow || 6))),
      mutedWords: Array.isArray(body.mutedWords) ? body.mutedWords.map((word) => String(word).trim().toLowerCase()).filter(Boolean).slice(0, 100) : existing.mutedWords || [],
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    await writeJson(FILES.automod, next);
    await addModerationLog(user.username, "automod:update", "system", "");
    broadcastManagers({ type: "automod:update", automod: next });
    return json(res, 200, { automod: next });
  }

  if (req.method === "POST" && pathname === "/api/voice/rooms") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const voiceRooms = await readJson(FILES.voiceRooms, []);
    const room = {
      id: crypto.randomUUID(),
      name: String(body.name || "Voice room").trim().slice(0, 80),
      private: Boolean(body.private),
      createdAt: new Date().toISOString(),
      createdBy: user.username,
    };
    voiceRooms.push(room);
    await writeJson(FILES.voiceRooms, voiceRooms);
    broadcast({ type: "voice:rooms", voiceRooms });
    return json(res, 201, { voiceRooms, room });
  }

  if (req.method === "POST" && pathname === "/api/change-password") {
    const body = await readJsonBody(req);
    const currentPassword = String(body.currentPassword || "");
    const nextPassword = String(body.nextPassword || "");
    if (nextPassword.length < 4) return json(res, 400, { error: "New password must be at least 4 characters" });

    const users = await readJson(FILES.users, []);
    const index = users.findIndex((entry) => entry.username === user.username);
    if (index === -1 || !verifyPassword(currentPassword, users[index].passwordHash)) {
      return json(res, 403, { error: "Current password is incorrect" });
    }

    users[index] = {
      ...users[index],
      passwordHash: hashPassword(nextPassword),
      updatedAt: new Date().toISOString(),
    };
    await writeJson(FILES.users, users);
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/users/reset-password") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();
    const nextPassword = String(body.nextPassword || "");
    if (!username) return json(res, 400, { error: "Choose a user" });
    if (nextPassword.length < 4) return json(res, 400, { error: "Password must be at least 4 characters" });

    const users = await readJson(FILES.users, []);
    const index = users.findIndex((entry) => entry.username.toLowerCase() === username.toLowerCase());
    if (index === -1) return json(res, 404, { error: "User not found" });

    users[index] = {
      ...users[index],
      passwordHash: hashPassword(nextPassword),
      passwordPreset: "",
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    await writeJson(FILES.users, users);
    expireUserSessions(username);
    broadcastManagers({ type: "users:update", users: users.map(safeUser) });
    return json(res, 200, { users: users.map(safeUser) });
  }

  if (req.method === "POST" && pathname === "/api/email/test") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const result = await notifyAdminEmails(
      "Inner test email",
      `This is a test email from Inner.\n\nSent by ${user.username} at ${new Date().toISOString()}.\nIf you received this, email delivery is working.`,
      { detailed: true }
    );
    if (!result.ok) {
      const status = emailProviderStatus(result.recipients || []);
      return json(res, 503, {
        error: emailFailureMessage(result, status),
        email: status,
        result,
      });
    }
    return json(res, 200, { ok: true, email: emailProviderStatus(result.recipients || []), result });
  }

  if (req.method === "GET" && pathname === "/api/email/status") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    return json(res, 200, { email: emailProviderStatus() });
  }

  json(res, 404, { error: "API route not found" });
}

async function saveUpload(req, res, user) {
  const settings = await readJson(FILES.settings, {});
  const originalName = sanitizeFileName(req.headers["x-file-name"] || "upload.bin");
  const providedType = String(req.headers["x-file-type"] || "application/octet-stream").slice(0, 120);
  const category = normalizeCategory(req.headers["x-file-category"] || "document");
  const privateUpload = parseBooleanHeader(req.headers["x-file-private"]);
  const extension = path.extname(originalName).toLowerCase();

  if (!isAllowedUploadExtension(extension)) {
    return json(res, 400, {
      error: "Unsupported or unsafe file type. Executable files are blocked, but normal media, documents, archives, and project files are allowed.",
    });
  }

  const scaledUploadBytes = Math.round(MAX_UPLOAD_BYTES * serviceScaleMultiplier(settings, "uploads"));
  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > scaledUploadBytes) {
    return json(res, 413, { error: `File is larger than ${formatServerBytes(scaledUploadBytes)}` });
  }

  const storedName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;
  const mustAvoidLocalDisk = cloudStorageRequired() && cloudinaryConfigured() && UPLOAD_PROVIDER !== "mongodb";
  if (cloudStorageRequired() && !cloudinaryConfigured() && !persistence.ready) {
    await addSystemLog("file.upload.blocked", user.username, { name: originalName, reason: "cloud storage missing" }, req);
    return json(res, 503, { error: "Cloudinary is not connected on this Render app. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET before uploads." });
  }

  if (mustAvoidLocalDisk) {
    const fileRecord = createUploadRecord({
      req,
      user,
      originalName,
      storedName,
      category,
      extension,
      providedType,
      privateUpload,
      size: contentLength || 0,
      url: "",
      persistence: "cloudinary",
    });
    try {
      const cloudUpload = await uploadRequestToCloudinary(req, storedName, fileRecord, extension, providedType, scaledUploadBytes);
      const cloudFile = cloudUpload.data;
      fileRecord.size = cloudUpload.bytes;
      fileRecord.cloudStorage = "cloudinary";
      fileRecord.cloudinaryPublicId = cloudFile.public_id || cloudFile.publicId || "";
      fileRecord.cloudinaryResourceType = cloudFile.resource_type || "auto";
      fileRecord.cloudinarySecureUrl = cloudFile.secure_url || "";
      fileRecord.cloudinaryVersion = cloudFile.version || "";
      fileRecord.url = `/api/files/${fileRecord.id}/download`;
    } catch (error) {
      const status = error.statusCode || (String(error.message || "").includes("larger than") ? 413 : 503);
      if (status === 400 || status === 413) {
        await addSystemLog("file.upload.blocked", user.username, { name: originalName, reason: error.message || "Upload blocked" }, req);
        return json(res, status, { error: error.message || "Upload blocked" });
      }
      await addSystemLog("file.upload.failed", user.username, { name: originalName, provider: "cloudinary", reason: error.message || "Cloudinary upload failed" }, req);
      return json(res, 503, { error: "Upload could not be saved to Cloudinary. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET." });
    }

    const files = await readJson(FILES.uploads, []);
    files.unshift(fileRecord);
    await writeJson(FILES.uploads, files);
    await addSystemLog("file.uploaded", user.username, { id: fileRecord.id, name: originalName, kind: fileRecord.kind, size: fileRecord.size, private: privateUpload, provider: "cloudinary-stream" }, req);
    broadcastFileNew(fileRecord);
    return json(res, 201, { file: safeFileRecord(fileRecord, user) });
  }

  const target = path.join(UPLOAD_DIR, storedName);
  let written = 0;
  let inlineEnabled = !persistence.ready && INLINE_UPLOAD_BYTES > 0 && (!contentLength || contentLength <= INLINE_UPLOAD_BYTES);
  let inlineChunks = [];

  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(target, { flags: "wx" });

    req.on("data", (chunk) => {
      written += chunk.length;
      if (inlineEnabled) {
        if (written <= INLINE_UPLOAD_BYTES) {
          inlineChunks.push(Buffer.from(chunk));
        } else {
          inlineEnabled = false;
          inlineChunks = [];
        }
      }
      if (written > scaledUploadBytes) {
        out.destroy(new Error(`File is larger than ${formatServerBytes(scaledUploadBytes)}`));
        req.destroy();
      }
    });
    req.on("error", reject);
    out.on("error", reject);
    out.on("finish", resolve);
    req.pipe(out);
  }).catch(async (error) => {
    await fsp.rm(target, { force: true }).catch(() => {});
    throw error;
  });

  const validationError = await validateUploadBytes(target, extension, providedType);
  if (validationError) {
    await fsp.rm(target, { force: true }).catch(() => {});
    await addSystemLog("file.upload.blocked", user.username, { name: originalName, reason: validationError }, req);
    return json(res, 400, { error: validationError });
  }

  const fileRecord = createUploadRecord({
    req,
    user,
    originalName,
    storedName,
    category,
    extension,
    providedType,
    privateUpload,
    size: written,
    url: `/uploads/${encodeURIComponent(storedName)}`,
    persistence: inlineEnabled ? "disk+inline" : "disk",
  });

  if (cloudinaryConfigured() && UPLOAD_PROVIDER !== "mongodb") {
    try {
      const cloudFile = await uploadLocalFileToCloudinary(storedName, target, fileRecord);
      fileRecord.cloudStorage = "cloudinary";
      fileRecord.cloudinaryPublicId = cloudFile.public_id || cloudFile.publicId || "";
      fileRecord.cloudinaryResourceType = cloudFile.resource_type || "auto";
      fileRecord.cloudinarySecureUrl = cloudFile.secure_url || "";
      fileRecord.cloudinaryVersion = cloudFile.version || "";
      fileRecord.persistence = "disk+cloudinary";
      fileRecord.url = `/api/files/${fileRecord.id}/download`;
      inlineEnabled = false;
      inlineChunks = [];
    } catch (error) {
      await fsp.rm(target, { force: true }).catch(() => {});
      await addSystemLog("file.upload.failed", user.username, { name: originalName, provider: "cloudinary", reason: error.message || "Cloudinary upload failed" }, req);
      return json(res, 503, { error: "Upload could not be saved to Cloudinary. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET." });
    }
  } else if (persistence.ready) {
    try {
      const cloudFile = await uploadLocalFileToCloud(storedName, target, fileRecord);
      fileRecord.cloudStorage = "mongodb-gridfs";
      fileRecord.cloudFileId = String(cloudFile._id || "");
      fileRecord.persistence = "disk+mongodb-gridfs";
    } catch (error) {
      await fsp.rm(target, { force: true }).catch(() => {});
      await addSystemLog("file.upload.failed", user.username, { name: originalName, reason: error.message || "Cloud upload failed" }, req);
      return json(res, 503, { error: "Upload could not be saved to cloud storage. Check MONGODB_URI before users upload files." });
    }
  } else if (cloudStorageRequired()) {
    await fsp.rm(target, { force: true }).catch(() => {});
    return json(res, 503, { error: "Cloud storage is not connected. Set Cloudinary env vars or MONGODB_URI so uploads survive redeploys." });
  }

  if (inlineEnabled && inlineChunks.length) {
    fileRecord.inlineEncoding = "base64";
    fileRecord.inlineSize = written;
    fileRecord.inlineData = Buffer.concat(inlineChunks, written).toString("base64");
  }

  const files = await readJson(FILES.uploads, []);
  files.unshift(fileRecord);
  await writeJson(FILES.uploads, files);
  await addSystemLog("file.uploaded", user.username, { id: fileRecord.id, name: originalName, kind: fileRecord.kind, size: written, private: privateUpload }, req);
  broadcastFileNew(fileRecord);
  const safeRecord = safeFileRecord(fileRecord, user);
  return json(res, 201, { file: safeRecord });
}

async function resolveChatAttachment(attachment) {
  if (!attachment || typeof attachment !== "object") return null;
  const id = String(attachment.id || "");
  if (!id) return null;
  const files = await readJson(FILES.uploads, []);
  const file = files.find((entry) => entry.id === id);
  if (!file) return null;
  if (!["image", "video", "audio"].includes(file.kind)) return null;
  if (file.private) return null;
  return safeFileRecord(file, null);
}

function createUploadRecord({ req, user, originalName, storedName, category, extension, providedType, privateUpload, size, url, persistence: persistenceLabel }) {
  return {
    id: crypto.randomUUID(),
    originalName,
    storedName,
    category,
    kind: classifyFile(extension, providedType),
    mimeType: mimeTypes[extension] || providedType || "application/octet-stream",
    size,
    user: user.username,
    sourceIp: getClientIp(req),
    sourceHost: req.headers.host || "",
    sourceAgent: String(req.headers["user-agent"] || "").slice(0, 240),
    sourceDevice: deviceSignature(req),
    approximateLocation: approximateLocationFromIp(getClientIp(req)),
    private: privateUpload,
    createdAt: new Date().toISOString(),
    url,
    persistence: persistenceLabel,
  };
}

function readRequestBuffer(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error(`File is larger than ${formatServerBytes(maxBytes)}`));
        req.destroy();
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks, total)));
    req.on("error", reject);
  });
}

async function uploadLocalFileToCloud(storedName, filePath, record) {
  if (!persistence.ready || !persistence.uploadBucket) throw new Error("MongoDB/GridFS is not connected");
  return new Promise((resolve, reject) => {
    const source = fs.createReadStream(filePath);
    const upload = persistence.uploadBucket.openUploadStream(storedName, {
      contentType: record.mimeType || "application/octet-stream",
      metadata: uploadMetadata(record),
    });
    source.on("error", reject);
    upload.on("error", reject);
    upload.on("finish", resolve);
    source.pipe(upload);
  });
}

async function uploadBufferToCloud(storedName, buffer, record) {
  if (!persistence.ready || !persistence.uploadBucket) throw new Error("MongoDB/GridFS is not connected");
  return new Promise((resolve, reject) => {
    const upload = persistence.uploadBucket.openUploadStream(storedName, {
      contentType: record.mimeType || "application/octet-stream",
      metadata: uploadMetadata(record),
    });
    upload.on("error", reject);
    upload.on("finish", resolve);
    upload.end(buffer);
  });
}

async function uploadLocalFileToCloudinary(storedName, filePath, record) {
  if (!cloudinaryConfigured()) throw new Error("Cloudinary is not configured");
  const buffer = await fsp.readFile(filePath);
  return uploadBufferToCloudinary(storedName, buffer, record);
}

async function uploadBufferToCloudinary(storedName, buffer, record) {
  if (!cloudinaryConfigured()) throw new Error("Cloudinary is not configured");
  if (typeof fetch !== "function" || typeof FormData !== "function" || typeof Blob !== "function") {
    throw new Error("This Node runtime cannot upload multipart Cloudinary files");
  }
  const publicId = `${path.basename(storedName, path.extname(storedName))}`;
  const params = {
    timestamp: Math.floor(Date.now() / 1000),
    folder: CLOUDINARY_FOLDER,
    public_id: publicId,
    overwrite: "true",
    unique_filename: "false",
    use_filename: "false",
    context: `inner_id=${record.id}|uploader=${record.user}|private=${record.private ? "true" : "false"}`,
  };
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: record.mimeType || "application/octet-stream" }), record.originalName || storedName);
  appendSignedCloudinaryParams(form, params);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY_CLOUD_NAME)}/auto/upload`, {
    method: "POST",
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error && data.error.message ? data.error.message : `Cloudinary upload failed (${response.status})`);
  return data;
}

function uploadRequestToCloudinary(req, storedName, record, extension, mimeType, maxBytes) {
  if (!cloudinaryConfigured()) return Promise.reject(new Error("Cloudinary is not configured"));
  return new Promise((resolve, reject) => {
    const boundary = `----inner-${crypto.randomBytes(12).toString("hex")}`;
    const params = signedCloudinaryParams(storedName, record);
    let settled = false;
    let total = 0;
    let head = Buffer.alloc(0);
    let validated = false;

    const finishReject = (error, cloudReq) => {
      if (settled) return;
      settled = true;
      if (cloudReq) cloudReq.destroy();
      reject(error);
    };

    const cloudReq = https.request(
      {
        method: "POST",
        hostname: "api.cloudinary.com",
        path: `/v1_1/${encodeURIComponent(CLOUDINARY_CLOUD_NAME)}/auto/upload`,
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
      },
      (cloudRes) => {
        const chunks = [];
        cloudRes.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        cloudRes.on("end", () => {
          if (settled) return;
          settled = true;
          const raw = Buffer.concat(chunks).toString("utf8");
          let data = {};
          try {
            data = JSON.parse(raw || "{}");
          } catch (error) {
            data = {};
          }
          if (cloudRes.statusCode < 200 || cloudRes.statusCode >= 300) {
            const error = new Error(data.error && data.error.message ? data.error.message : `Cloudinary upload failed (${cloudRes.statusCode})`);
            error.statusCode = 503;
            reject(error);
            return;
          }
          resolve({ data, bytes: total });
        });
      }
    );

    cloudReq.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    for (const [key, value] of Object.entries(params)) {
      cloudReq.write(`--${boundary}\r\n`);
      cloudReq.write(`Content-Disposition: form-data; name="${key}"\r\n\r\n`);
      cloudReq.write(`${value}\r\n`);
    }
    cloudReq.write(`--${boundary}\r\n`);
    cloudReq.write(`Content-Disposition: form-data; name="file"; filename="${multipartSafeName(record.originalName || storedName)}"\r\n`);
    cloudReq.write(`Content-Type: ${record.mimeType || "application/octet-stream"}\r\n\r\n`);

    const checkHead = (final = false) => {
      if (validated) return "";
      if (!final && head.length < 16) return "";
      const validationError = validateUploadBuffer(head, extension, mimeType);
      if (!validationError) validated = true;
      return validationError;
    };

    req.on("data", (chunk) => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBytes) {
        const error = new Error(`File is larger than ${formatServerBytes(maxBytes)}`);
        error.statusCode = 413;
        req.destroy();
        finishReject(error, cloudReq);
        return;
      }
      if (head.length < 16) head = Buffer.concat([head, chunk]).subarray(0, 16);
      const validationError = checkHead(false);
      if (validationError) {
        const error = new Error(validationError);
        error.statusCode = 400;
        req.destroy();
        finishReject(error, cloudReq);
        return;
      }
      if (!cloudReq.write(chunk)) {
        req.pause();
        cloudReq.once("drain", () => req.resume());
      }
    });

    req.on("end", () => {
      if (settled) return;
      const validationError = checkHead(true);
      if (validationError) {
        const error = new Error(validationError);
        error.statusCode = 400;
        finishReject(error, cloudReq);
        return;
      }
      cloudReq.end(`\r\n--${boundary}--\r\n`);
    });
    req.on("error", (error) => finishReject(error, cloudReq));
  });
}

async function deleteCloudinaryUpload(record) {
  if (!cloudinaryConfigured() || !record || record.cloudStorage !== "cloudinary" || !record.cloudinaryPublicId) return;
  if (typeof fetch !== "function" || typeof FormData !== "function") return;
  const resourceType = ["image", "video", "raw"].includes(record.cloudinaryResourceType)
    ? record.cloudinaryResourceType
    : record.kind === "video" || record.kind === "audio"
      ? "video"
      : record.kind === "image"
        ? "image"
        : "raw";
  const params = {
    timestamp: Math.floor(Date.now() / 1000),
    public_id: record.cloudinaryPublicId,
    invalidate: "true",
  };
  const form = new FormData();
  appendSignedCloudinaryParams(form, params);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY_CLOUD_NAME)}/${resourceType}/destroy`, {
    method: "POST",
    body: form,
  }).catch(() => null);
  if (response && !response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error && data.error.message ? data.error.message : `Cloudinary delete failed (${response.status})`);
  }
}

function appendSignedCloudinaryParams(form, params) {
  const signedParams = {
    ...params,
    signature: signCloudinaryParams(params),
    api_key: CLOUDINARY_API_KEY,
  };
  for (const [key, value] of Object.entries(signedParams)) {
    if (value === undefined || value === null || value === "") continue;
    form.append(key, String(value));
  }
}

function signedCloudinaryParams(storedName, record) {
  const publicId = `${path.basename(storedName, path.extname(storedName))}`;
  const params = {
    timestamp: Math.floor(Date.now() / 1000),
    folder: CLOUDINARY_FOLDER,
    public_id: publicId,
    overwrite: "true",
    unique_filename: "false",
    use_filename: "false",
    context: `inner_id=${record.id}|uploader=${record.user}|private=${record.private ? "true" : "false"}`,
  };
  return {
    ...params,
    signature: signCloudinaryParams(params),
    api_key: CLOUDINARY_API_KEY,
  };
}

function multipartSafeName(name) {
  return String(name || "upload.bin").replace(/[\r\n"]/g, "_").slice(0, 180) || "upload.bin";
}

function signCloudinaryParams(params) {
  const payload = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto.createHash("sha1").update(`${payload}${CLOUDINARY_API_SECRET}`).digest("hex");
}

function cloudinaryConfigured() {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
}

function storageModeLabel() {
  if (cloudinaryConfigured() && persistence.ready) return "cloudinary+mongodb-gridfs";
  if (cloudinaryConfigured()) return "cloudinary";
  if (persistence.ready) return "mongodb-gridfs";
  return "local-disk";
}

function uploadMetadata(record) {
  return {
    id: record.id,
    originalName: record.originalName,
    category: record.category,
    kind: record.kind,
    mimeType: record.mimeType,
    size: record.size,
    user: record.user,
    private: Boolean(record.private),
    createdAt: record.createdAt,
  };
}

function cloudStorageRequired() {
  return REQUIRE_CLOUD_STORAGE || (!LOCALHOST_MODE && Boolean(MONGODB_URI));
}

async function handleUpgrade(req, socket) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  if (requestUrl.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  const user = getSessionUser(req);
  if (!user) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  const settings = await readJson(FILES.settings, {});
  if (settings.serverEnabled === false && !canBypassShutdown(user)) {
    socket.write("HTTP/1.1 423 Locked\r\n\r\n");
    socket.destroy();
    return;
  }

  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "\r\n",
    ].join("\r\n")
  );

  const id = crypto.randomUUID();
  const client = {
    id,
    username: user.username,
    role: user.role,
    socket,
    buffer: Buffer.alloc(0),
    ip: getClientIp(req),
    device: deviceSignature(req),
    network: {},
    connectedAt: new Date().toISOString(),
    sharing: false,
    screenRoomId: "",
    status: "online",
    invisible: false,
    typingRoomId: "",
    voiceRoomId: "",
    muted: false,
    deafened: false,
    videoEnabled: false,
    cameraOff: true,
  };
  wsClients.set(id, client);

  sendWs(client, {
    type: "hello",
    clientId: id,
    user: safeUser(user),
    peers: peerList(id),
    presence: presenceList(await readJson(FILES.profiles, {}), user),
  });
  broadcast({ type: "peer:joined", peer: peerSummary(client) }, id);

  socket.on("data", (chunk) => handleWsData(client, chunk));
  socket.on("close", () => removeClient(id));
  socket.on("error", () => removeClient(id));
}

function handleWsData(client, chunk) {
  client.buffer = Buffer.concat([client.buffer, chunk]);

  while (client.buffer.length >= 2) {
    const firstByte = client.buffer[0];
    const secondByte = client.buffer[1];
    const opcode = firstByte & 0x0f;
    const masked = Boolean(secondByte & 0x80);
    let length = secondByte & 0x7f;
    let offset = 2;

    if (length === 126) {
      if (client.buffer.length < offset + 2) return;
      length = client.buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (client.buffer.length < offset + 8) return;
      const bigLength = client.buffer.readBigUInt64BE(offset);
      if (bigLength > BigInt(1024 * 1024)) {
        closeWs(client);
        return;
      }
      length = Number(bigLength);
      offset += 8;
    }

    let mask;
    if (masked) {
      if (client.buffer.length < offset + 4) return;
      mask = client.buffer.subarray(offset, offset + 4);
      offset += 4;
    }

    if (client.buffer.length < offset + length) return;

    const payload = client.buffer.subarray(offset, offset + length);
    client.buffer = client.buffer.subarray(offset + length);

    if (opcode === 0x8) {
      closeWs(client);
      return;
    }

    if (opcode === 0x9) {
      sendFrame(client.socket, Buffer.alloc(0), 0xA);
      continue;
    }

    if (opcode !== 0x1) continue;

    const data = Buffer.alloc(payload.length);
    if (masked && mask) {
      for (let index = 0; index < payload.length; index += 1) {
        data[index] = payload[index] ^ mask[index % 4];
      }
    } else {
      payload.copy(data);
    }

    try {
      Promise.resolve(handleWsMessage(client, JSON.parse(data.toString("utf8")))).catch((error) => {
        sendWs(client, { type: "error", error: error.message || "Live update failed" });
      });
    } catch (error) {
      sendWs(client, { type: "error", error: "Bad websocket message" });
    }
  }
}

async function handleWsMessage(client, message) {
  if (message.type === "ping") {
    return sendWs(client, { type: "pong", at: Date.now() });
  }

  if (message.type === "client:network") {
    client.network = sanitizeClientNetwork(message.network);
    await addSystemLog("client.network", client.username, { network: client.network });
    return;
  }

  if (message.type === "presence:update") {
    client.status = normalizePresenceStatus(message.status);
    client.invisible = Boolean(message.invisible);
    const profiles = await readJson(FILES.profiles, {});
    if (profiles[client.username]) {
      profiles[client.username] = sanitizeProfile({
        ...profiles[client.username],
        status: client.status,
        invisible: client.invisible,
        customStatus: message.customStatus !== undefined ? message.customStatus : profiles[client.username].customStatus,
        updatedAt: new Date().toISOString(),
      });
      await writeJson(FILES.profiles, profiles);
    }
    return broadcast({ type: "presence:update", presence: presenceList(profiles, client) });
  }

  if (message.type === "typing") {
    client.typingRoomId = message.active ? String(message.roomId || "main").slice(0, 80) : "";
    return broadcast({
      type: "typing",
      roomId: client.typingRoomId,
      username: client.username,
      active: Boolean(message.active),
    }, client.id);
  }

  const settings = await readJson(FILES.settings, {});
  if (
    settings.serverEnabled === false &&
    !canBypassShutdown(client) &&
    (message.type === "signal" ||
      message.type === "screen:status" ||
      message.type === "screen:request" ||
      message.type === "call:invite" ||
      message.type === "soundboard:play" ||
      message.type === "voice:join" ||
      message.type === "voice:state" ||
      message.type === "voice:signal")
  ) {
    return sendWs(client, { type: "error", error: "Server is shut down. Only admin, HMD, and dev access is open right now." });
  }
  const screenFeatureError = await featureGateError(settings, "screen", client);
  if (screenFeatureError && (message.type === "signal" || message.type === "screen:status" || message.type === "screen:request")) {
    return sendWs(client, { type: "error", error: screenFeatureError });
  }

  if (message.type === "signal") {
    const roomInfo = await resolveRealtimeRoom(message.roomId || "screen:global", client);
    const target = wsClients.get(String(message.target || ""));
    if (!target) return;
    if (!canTargetRealtimeRoom(roomInfo, target)) return sendWs(client, { type: "error", error: "Target is not in this call" });
    return sendWs(target, {
      type: "signal",
      from: client.id,
      fromUser: client.username,
      roomId: roomInfo.roomId,
      signal: message.signal,
    });
  }

  if (message.type === "screen:request" || message.type === "location:request") {
    if (!canManage(client)) return sendWs(client, { type: "error", error: "Admin access required" });
    const target = wsClients.get(String(message.target || ""));
    if (!target) return sendWs(client, { type: "error", error: "User is not online" });
    return sendWs(target, {
      type: message.type,
      from: client.id,
      fromUser: client.username,
    });
  }

  if (message.type === "location:share") {
    const target = wsClients.get(String(message.target || ""));
    if (!target) return;
    return sendWs(target, {
      type: "location:share",
      from: client.id,
      fromUser: client.username,
      location: sanitizeLocation(message.location),
    });
  }

  if (message.type === "voice:join") {
    const voiceFeatureError = await featureGateError(settings, "voice", client);
    if (voiceFeatureError) return sendWs(client, { type: "error", error: voiceFeatureError });
    const roomInfo = await resolveRealtimeRoom(message.roomId || "lobby", client);
    client.voiceRoomId = roomInfo.roomId;
    client.muted = Boolean(message.muted);
    client.deafened = Boolean(message.deafened);
    client.videoEnabled = Boolean(message.videoEnabled);
    client.cameraOff = Boolean(message.cameraOff);
    await addSystemLog("voice.join", client.username, { roomId: client.voiceRoomId, videoEnabled: client.videoEnabled });
    return broadcastRealtimeRoom({
      type: "voice:update",
      roomId: client.voiceRoomId,
      joinedPeerId: client.id,
      peers: voicePeers(client.voiceRoomId),
    }, roomInfo);
  }

  if (message.type === "voice:leave") {
    const previousRoom = client.voiceRoomId;
    const roomInfo = previousRoom ? await resolveRealtimeRoom(previousRoom, client, { allowAfterLeave: true }) : null;
    client.voiceRoomId = "";
    client.muted = false;
    client.deafened = false;
    client.videoEnabled = false;
    client.cameraOff = true;
    await addSystemLog("voice.leave", client.username, { roomId: previousRoom });
    return broadcastRealtimeRoom({
      type: "voice:update",
      leftPeerId: client.id,
      roomId: previousRoom,
      peers: previousRoom ? voicePeers(previousRoom) : [],
    }, roomInfo);
  }

  if (message.type === "voice:state") {
    client.muted = Boolean(message.muted);
    client.deafened = Boolean(message.deafened);
    client.videoEnabled = Boolean(message.videoEnabled);
    client.cameraOff = Boolean(message.cameraOff);
    const roomInfo = client.voiceRoomId ? await resolveRealtimeRoom(client.voiceRoomId, client) : null;
    return broadcastRealtimeRoom({
      type: "voice:update",
      roomId: client.voiceRoomId,
      peers: client.voiceRoomId ? voicePeers(client.voiceRoomId) : [],
    }, roomInfo);
  }

  if (message.type === "voice:signal") {
    const roomInfo = await resolveRealtimeRoom(message.roomId || client.voiceRoomId || "lobby", client);
    const target = wsClients.get(String(message.target || ""));
    if (!target) return;
    if (!canTargetRealtimeRoom(roomInfo, target) || target.voiceRoomId !== roomInfo.roomId) {
      return sendWs(client, { type: "error", error: "Target is not in this call" });
    }
    return sendWs(target, {
      type: "voice:signal",
      from: client.id,
      fromUser: client.username,
      roomId: roomInfo.roomId,
      videoEnabled: Boolean(client.videoEnabled),
      signal: message.signal,
    });
  }

  if (message.type === "call:invite") {
    const voiceFeatureError = await featureGateError(settings, "voice", client);
    if (voiceFeatureError) return sendWs(client, { type: "error", error: voiceFeatureError });
    const roomInfo = await resolveRealtimeRoom(message.roomId || client.voiceRoomId || "lobby", client);
    const mode = message.mode === "video" ? "video" : "voice";
    await addSystemLog("call.invite", client.username, { roomId: roomInfo.roomId, mode });
    return broadcastRealtimeRoom({
      type: "call:invite",
      roomId: roomInfo.roomId,
      roomLabel: String(message.roomLabel || roomInfo.label || "call").slice(0, 120),
      mode,
      from: client.id,
      fromUser: client.username,
    }, roomInfo, client.id);
  }

  if (message.type === "soundboard:play") {
    const voiceFeatureError = await featureGateError(settings, "voice", client);
    if (voiceFeatureError) return sendWs(client, { type: "error", error: voiceFeatureError });
    const roomInfo = await resolveRealtimeRoom(message.roomId || client.voiceRoomId || "lobby", client);
    const sound = normalizeSoundboardSound(message.sound);
    await addSystemLog("soundboard.play", client.username, { roomId: roomInfo.roomId, sound });
    return broadcastRealtimeRoom({
      type: "soundboard:play",
      roomId: roomInfo.roomId,
      sound,
      from: client.id,
      fromUser: client.username,
    }, roomInfo);
  }

  if (message.type === "screen:status") {
    const roomInfo = await resolveRealtimeRoom(message.roomId || "screen:global", client);
    client.sharing = Boolean(message.sharing);
    client.screenRoomId = client.sharing ? roomInfo.roomId : "";
    await addSystemLog(client.sharing ? "screen.share.started" : "screen.share.stopped", client.username, { roomId: roomInfo.roomId });
    return broadcastRealtimeRoom({
      type: "screen:status",
      from: client.id,
      fromUser: client.username,
      roomId: roomInfo.roomId,
      sharing: client.sharing,
    }, roomInfo);
  }
}

async function removeClient(id) {
  const client = wsClients.get(id);
  if (!client) return;
  const previousVoiceRoom = client.voiceRoomId;
  wsClients.delete(id);
  broadcast({ type: "peer:left", peerId: id, username: client.username });
  if (previousVoiceRoom) {
    const roomInfo = await resolveRealtimeRoom(previousVoiceRoom, client, { allowAfterLeave: true }).catch(() => null);
    broadcastRealtimeRoom({ type: "voice:update", roomId: previousVoiceRoom, peers: voicePeers(previousVoiceRoom) }, roomInfo);
  }
}

function expireUserSessions(username) {
  const lower = String(username || "").toLowerCase();
  for (const [token, session] of sessions) {
    if (String(session.username || "").toLowerCase() === lower) sessions.delete(token);
  }
  for (const client of Array.from(wsClients.values())) {
    if (String(client.username || "").toLowerCase() === lower) closeWs(client);
  }
}

async function markDeletedDefault(username, updatedBy) {
  const settings = await readJson(FILES.settings, {});
  const deletedDefaultAdmins = Array.isArray(settings.deletedDefaultAdmins) ? settings.deletedDefaultAdmins : [];
  if (!deletedDefaultAdmins.includes(username)) deletedDefaultAdmins.push(username);
  await writeJson(FILES.settings, {
    ...settings,
    deletedDefaultAdmins,
    updatedAt: new Date().toISOString(),
    updatedBy,
  });
}

async function unmarkDeletedDefault(username, updatedBy) {
  const settings = await readJson(FILES.settings, {});
  const deletedDefaultAdmins = Array.isArray(settings.deletedDefaultAdmins)
    ? settings.deletedDefaultAdmins.filter((entry) => entry !== username)
    : [];
  await writeJson(FILES.settings, {
    ...settings,
    deletedDefaultAdmins,
    updatedAt: new Date().toISOString(),
    updatedBy,
  });
}

function peerList(exceptId) {
  return Array.from(wsClients.values())
    .filter((client) => client.id !== exceptId)
    .map(peerSummary);
}

function peerSummary(client) {
  return {
    id: client.id,
    username: client.username,
    role: client.role,
    sharing: Boolean(client.sharing),
    screenRoomId: client.screenRoomId || "",
    status: client.invisible ? "offline" : normalizePresenceStatus(client.status),
    voiceRoomId: client.voiceRoomId || "",
    muted: Boolean(client.muted),
    deafened: Boolean(client.deafened),
    videoEnabled: Boolean(client.videoEnabled),
    cameraOff: Boolean(client.cameraOff),
  };
}

function voicePeers(roomId) {
  return Array.from(wsClients.values())
    .filter((client) => client.voiceRoomId === roomId)
    .map(peerSummary);
}

async function resolveRealtimeRoom(roomId, client, options = {}) {
  const cleanRoomId = String(roomId || "lobby").trim().slice(0, 160) || "lobby";
  if (!cleanRoomId.startsWith("dm:") && !cleanRoomId.startsWith("group:")) {
    return { roomId: cleanRoomId, private: false, label: cleanRoomId };
  }

  let participants = [];
  let label = "DM call";
  if (cleanRoomId.startsWith("dm:")) {
    const parts = cleanRoomId.split(":").slice(1).map((part) => normalizeUsername(part)).filter(Boolean);
    participants = Array.from(new Set(parts)).slice(0, 2);
    label = participants.join(" + ") || "DM call";
  } else {
    const groupId = cleanRoomId.slice("group:".length);
    const groups = await readJson(FILES.dmGroups, []);
    const group = groups.map(sanitizeDmGroup).find((entry) => entry.id === groupId);
    if (!group) throw new Error("Group call not found");
    participants = group.participants;
    label = group.name;
  }

  if (!participants.length) throw new Error("Call room is empty");
  if (!options.allowAfterLeave && !participants.includes(client.username) && !canManage(client)) {
    throw new Error("You are not in this call");
  }

  return { roomId: cleanRoomId, private: true, participants: new Set(participants), label };
}

function canTargetRealtimeRoom(roomInfo, target) {
  if (!roomInfo || !roomInfo.private) return true;
  return roomInfo.participants.has(target.username) || canManage(target);
}

function broadcast(payload, exceptId) {
  for (const client of wsClients.values()) {
    if (client.id !== exceptId) sendWs(client, payload);
  }
}

function broadcastAnnouncements(announcements, rooms) {
  for (const client of wsClients.values()) {
    sendWs(client, {
      type: "announcements:update",
      announcements: safeAnnouncements(announcements, client, rooms),
    });
  }
}

function broadcastRealtimeRoom(payload, roomInfo, exceptId) {
  if (!roomInfo || !roomInfo.private) return broadcast(payload, exceptId);
  for (const client of wsClients.values()) {
    if (client.id === exceptId) continue;
    if (roomInfo.participants.has(client.username) || canManage(client)) sendWs(client, payload);
  }
}

function broadcastManagers(payload) {
  for (const client of wsClients.values()) {
    if (canManage(client)) sendWs(client, payload);
  }
}

function broadcastDm(payload, dm) {
  const participants = new Set(Array.isArray(dm.participants) ? dm.participants : [dm.from, dm.to]);
  for (const client of wsClients.values()) {
    if (canManage(client) || participants.has(client.username)) sendWs(client, payload);
  }
}

async function broadcastReceiptContext(payload, context, targetId, user) {
  if (context === "dm") {
    const participants = new Set(targetId.split("|").map(normalizeUsername).filter(Boolean));
    for (const client of wsClients.values()) {
      if (canManage(client) || participants.has(client.username)) sendWs(client, payload);
    }
    return;
  }
  if (context === "group") {
    const groups = await readJson(FILES.dmGroups, []);
    const group = groups.map(sanitizeDmGroup).find((entry) => entry.id === targetId);
    const participants = new Set(group ? group.participants : []);
    for (const client of wsClients.values()) {
      if (canManage(client) || participants.has(client.username) || client.username === user.username) sendWs(client, payload);
    }
  }
}

function broadcastStoreUpdate(store, orderUser) {
  for (const client of wsClients.values()) {
    if (canManage(client) || client.username === orderUser) {
      sendWs(client, { type: "store:update", store: safeStore(store, client) });
    }
  }
}

function broadcastFileNew(file) {
  for (const client of wsClients.values()) {
    if (canAccessFileRecord(file, client)) {
      sendWs(client, { type: "file:new", file: safeFileRecord(file, client) });
    }
  }
}

function sendWs(client, payload) {
  if (!client.socket || client.socket.destroyed) return;
  sendFrame(client.socket, Buffer.from(JSON.stringify(payload), "utf8"), 0x1);
}

function sendFrame(socket, payload, opcode) {
  const length = payload.length;
  let header;

  if (length < 126) {
    header = Buffer.alloc(2);
    header[1] = length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  header[0] = 0x80 | opcode;
  socket.write(Buffer.concat([header, payload]));
}

function closeWs(client) {
  if (client.socket && !client.socket.destroyed) client.socket.end();
  removeClient(client.id);
}

function clearSessionForRequest(req, res) {
  const token = getCookie(req, SESSION_COOKIE);
  if (token) sessions.delete(token);
  res.setHeader("Set-Cookie", sessionCookie("", req, 0));
}

function kickNonShutdownUsers() {
  let sessionsKicked = 0;
  let clientsKicked = 0;

  for (const [token, session] of sessions) {
    if (!canBypassShutdown(session)) {
      sessions.delete(token);
      sessionsKicked += 1;
    }
  }

  for (const client of Array.from(wsClients.values())) {
    if (!canBypassShutdown(client)) {
      sendWs(client, {
        type: "server:shutdown",
        error: "Server shutdown is on. Admin, HMD, and dev accounts can stay connected.",
      });
      closeWs(client);
      clientsKicked += 1;
    }
  }

  return { sessions: sessionsKicked, clients: clientsKicked };
}

function requireUser(req, res) {
  const user = getSessionUser(req);
  if (!user) {
    json(res, 401, { error: "Login required" });
    return null;
  }
  return user;
}

function getSessionUser(req) {
  const token = getCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt && session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  if (!session.persistent) session.expiresAt = Date.now() + SESSION_IDLE_MS;
  return { username: session.username, role: normalizeRole(session.role) };
}

function getCookie(req, name) {
  const cookies = String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const cookie of cookies) {
    const index = cookie.indexOf("=");
    if (index === -1) continue;
    if (cookie.slice(0, index) === name) return decodeURIComponent(cookie.slice(index + 1));
  }
  return "";
}

function sessionCookie(value, req, maxAgeSeconds = null) {
  const parts = [`${SESSION_COOKIE}=${encodeURIComponent(value)}`, "HttpOnly", "SameSite=Lax", "Path=/"];
  if (maxAgeSeconds !== null) parts.push(`Max-Age=${Math.max(0, Number(maxAgeSeconds) || 0)}`);
  if (isHttpsRequest(req)) parts.push("Secure");
  return parts.join("; ");
}

function isHttpsRequest(req) {
  if (req.socket && req.socket.encrypted) return true;
  const forwarded = firstForwardedValue(req.headers["x-forwarded-proto"]).toLowerCase();
  return forwarded === "https";
}

function shouldRedirectToHttps(req) {
  if (!FORCE_HTTPS || isHttpsRequest(req)) return false;
  const forwarded = firstForwardedValue(req.headers["x-forwarded-proto"]).toLowerCase();
  if (forwarded !== "http") return false;
  const host = String(req.headers.host || "").split(":")[0].toLowerCase();
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
  return true;
}

function redirectToHttps(req, res) {
  const host = req.headers.host || `${HOST}:${PORT}`;
  const location = `https://${host}${req.url || "/"}`;
  res.writeHead(308, {
    Location: location,
    "Cache-Control": "no-store",
  });
  res.end();
}

function firstForwardedValue(value) {
  return String(Array.isArray(value) ? value[0] : value || "")
    .split(",")[0]
    .trim();
}

function safeUser(user) {
  return {
    username: user.username,
    role: normalizeRole(user.role),
    owner: canOwn(user),
    createdAt: user.createdAt || "",
    createdBy: user.createdBy || "",
    updatedAt: user.updatedAt || "",
    updatedBy: user.updatedBy || "",
    bannedUntil: user.bannedUntil || "",
    banReason: user.banReason || "",
    banned: isUserBanned(user),
    allowPersistentLogin: Boolean(user.allowPersistentLogin),
    locked: Boolean(user.locked),
    lastLoginAt: user.lastLoginAt || "",
    lastLoginIp: user.lastLoginIp || "",
    lastLoginDevice: user.lastLoginDevice || "",
    lastLoginApproximateLocation: user.lastLoginApproximateLocation || null,
    sourceIp: user.sourceIp || "",
    sourceDevice: user.sourceDevice || "",
    contact: user.contact || "",
    email: user.email || "",
    phone: user.phone || "",
    mutedUntil: user.mutedUntil || "",
    muted: isUserMuted(user),
    shadowMuted: Boolean(user.shadowMuted),
  };
}

function publicUser(user, profile = {}) {
  return {
    username: user.username,
    role: normalizeRole(user.role),
    banned: isUserBanned(user),
    displayName: profile.displayName || user.username,
    avatarUrl: profile.avatarUrl || "",
    bannerUrl: profile.bannerUrl || "",
    badges: normalizeBadgeList(profile.badges),
    customStatus: profile.customStatus || "",
    status: profile.invisible ? "offline" : normalizePresenceStatus(profile.status || "offline"),
  };
}

function defaultProfile(username) {
  return {
    displayName: username,
    bio: "",
    avatarUrl: "",
    bannerUrl: "",
    badges: [],
    customStatus: "",
    status: "offline",
    invisible: false,
    theme: "system",
    customTheme: defaultCustomTheme(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeProfile(profile) {
  return {
    displayName: String(profile.displayName || "").trim().slice(0, 80) || "User",
    bio: String(profile.bio || "").trim().slice(0, 500),
    avatarUrl: normalizeOptionalUrl(profile.avatarUrl),
    bannerUrl: normalizeOptionalUrl(profile.bannerUrl),
    badges: normalizeBadgeList(profile.badges),
    customStatus: String(profile.customStatus || "").trim().slice(0, 80),
    status: normalizePresenceStatus(profile.status),
    invisible: Boolean(profile.invisible),
    theme: normalizeRoomTheme(profile.theme),
    customTheme: sanitizeCustomTheme(profile.customTheme || {}),
    createdAt: profile.createdAt || new Date().toISOString(),
    updatedAt: profile.updatedAt || new Date().toISOString(),
  };
}

function safeProfiles(profiles, users, viewer) {
  const result = {};
  for (const user of users || []) {
    const profile = sanitizeProfile({
      ...defaultProfile(user.username),
      ...(profiles[user.username] || {}),
    });
    result[user.username] = {
      ...profile,
      status: profile.invisible && (!viewer || viewer.username !== user.username) ? "offline" : profile.status,
      invisible: viewer && viewer.username === user.username ? profile.invisible : false,
    };
  }
  return result;
}

function presenceList(profiles, viewer) {
  const online = new Map();
  for (const client of wsClients.values()) {
    if (client.invisible && (!viewer || viewer.username !== client.username)) continue;
    online.set(client.username, {
      username: client.username,
      role: normalizeRole(client.role),
      status: client.invisible ? "offline" : normalizePresenceStatus(client.status),
      customStatus: profiles[client.username] ? profiles[client.username].customStatus || "" : "",
      clientId: client.id,
      voiceRoomId: client.voiceRoomId || "",
    });
  }
  return Array.from(online.values()).sort((a, b) => a.username.localeCompare(b.username));
}

function safeFriendState(friends, user) {
  const username = user.username;
  return {
    friends: (friends.friendships || [])
      .filter((entry) => Array.isArray(entry.users) && entry.users.includes(username))
      .map((entry) => ({
        id: entry.id,
        username: entry.users.find((name) => name !== username),
        createdAt: entry.createdAt || "",
      })),
    incoming: (friends.requests || [])
      .filter((entry) => entry.to === username && entry.status === "pending"),
    outgoing: (friends.requests || [])
      .filter((entry) => entry.from === username && entry.status === "pending"),
  };
}

function areFriends(friends, first, second) {
  return (friends.friendships || []).some((entry) => friendPair(entry, first, second));
}

function friendPair(entry, first, second) {
  const users = Array.isArray(entry.users) ? entry.users.map((name) => String(name).toLowerCase()) : [];
  return users.includes(String(first || "").toLowerCase()) && users.includes(String(second || "").toLowerCase());
}

function friendRequestPair(entry, first, second) {
  const from = String(entry.from || "").toLowerCase();
  const to = String(entry.to || "").toLowerCase();
  const a = String(first || "").toLowerCase();
  const b = String(second || "").toLowerCase();
  return (from === a && to === b) || (from === b && to === a);
}

function broadcastFriendUpdate(friends, ...usernames) {
  const targets = new Set(usernames.map((name) => String(name || "").toLowerCase()));
  for (const client of wsClients.values()) {
    if (targets.has(client.username.toLowerCase())) {
      sendWs(client, { type: "friends:update", friends: safeFriendState(friends, client) });
    }
  }
}

function broadcastDmGroupUpdate(groups, usernames) {
  const targets = new Set((usernames || []).map((name) => String(name || "").toLowerCase()));
  for (const client of wsClients.values()) {
    if (canManage(client) || targets.has(client.username.toLowerCase())) {
      sendWs(client, { type: "dm-groups:update", dmGroups: safeDmGroups(groups, client) });
    }
  }
}

function safeInvitesForUser(invites, user) {
  return (invites || [])
    .filter(inviteActive)
    .filter((invite) => Array.isArray(invite.uses) && invite.uses.some((use) => use.username === user.username))
    .slice(-25);
}

function inviteActive(invite) {
  if (!invite) return false;
  if (invite.expiresAt && Date.parse(invite.expiresAt) < Date.now()) return false;
  if (invite.maxUses && Array.isArray(invite.uses) && invite.uses.length >= invite.maxUses) return false;
  return true;
}

function sanitizeRoom(room) {
  return {
    ...room,
    name: String(room.name || "Room").trim().slice(0, 80) || "Room",
    icon: String(room.icon || "").trim().slice(0, 12),
    banner: normalizeOptionalUrl(room.banner),
    theme: normalizeRoomTheme(room.theme),
    category: String(room.category || "General").trim().slice(0, 80) || "General",
    private: Boolean(room.private),
    inviteOnly: Boolean(room.inviteOnly),
    passwordHash: String(room.passwordHash || ""),
    requiresPassword: Boolean(room.passwordHash),
    allowedUsers: normalizeUsernameList(room.allowedUsers),
    moderators: normalizeUsernameList(room.moderators),
  };
}

function safeRoom(room) {
  const safe = sanitizeRoom(room);
  delete safe.passwordHash;
  safe.requiresPassword = Boolean(room && room.passwordHash);
  return safe;
}

function safeRooms(rooms) {
  return (rooms || []).map(safeRoom);
}

function canAccessRoom(room, user) {
  if (!room || !user) return false;
  if (room.id === "main" || canManage(user)) return true;
  if (room.passwordHash && !normalizeUsernameList(room.allowedUsers).includes(user.username)) return false;
  if (!room.private && !room.inviteOnly) return true;
  const allowed = new Set([...(room.allowedUsers || []), ...(room.moderators || []), room.createdBy].filter(Boolean));
  return allowed.has(user.username);
}

function safeAnnouncements(announcements, user, rooms) {
  const roomMap = new Map((rooms || []).map((room) => [room.id, room]));
  return (announcements || [])
    .filter((announcement) => announcement && announcement.active !== false)
    .filter((announcement) => {
      if (announcement.scope !== "room") return true;
      return canAccessRoom(roomMap.get(announcement.roomId), user);
    })
    .slice(0, 50)
    .map((announcement) => ({
      id: String(announcement.id || ""),
      title: String(announcement.title || "Announcement").slice(0, 100),
      message: String(announcement.message || announcement.body || "").slice(0, 1200),
      scope: announcement.scope === "room" ? "room" : "all",
      roomId: String(announcement.roomId || ""),
      roomName: String(announcement.roomName || ""),
      createdAt: announcement.createdAt || "",
      createdBy: String(announcement.createdBy || ""),
    }));
}

function sanitizeDmGroup(group) {
  return {
    id: String(group.id || crypto.randomUUID()),
    name: String(group.name || "Group DM").trim().slice(0, 80) || "Group DM",
    participants: Array.from(new Set(normalizeUsernameList(group.participants))).slice(0, 50),
    createdAt: group.createdAt || new Date().toISOString(),
    createdBy: String(group.createdBy || "").slice(0, 80),
    updatedAt: group.updatedAt || "",
    updatedBy: group.updatedBy || "",
  };
}

function safeDmGroups(groups, user) {
  const isAdmin = canManage(user);
  const username = user && user.username;
  return (groups || [])
    .map(sanitizeDmGroup)
    .filter((group) => isAdmin || group.participants.includes(username))
    .map((group) => ({
      ...group,
      participantCount: group.participants.length,
    }));
}

function canAccessFileRecord(file, user) {
  if (!file || !user) return !file || !file.private;
  return !file.private || canManage(user) || file.user === user.username;
}

function safeFileRecords(files, user) {
  return (files || [])
    .filter((file) => canAccessFileRecord(file, user))
    .map((file) => safeFileRecord(file, user));
}

function safeFileRecord(file, viewer) {
  const showAdminMeta = viewer && canManage(viewer);
  return {
    id: file.id,
    originalName: file.originalName,
    storedName: file.storedName,
    category: file.category,
    kind: file.kind,
    mimeType: file.mimeType,
    size: file.size,
    user: file.user,
    private: Boolean(file.private),
    sourceIp: showAdminMeta ? file.sourceIp : "",
    sourceHost: showAdminMeta ? file.sourceHost : "",
    sourceAgent: showAdminMeta ? file.sourceAgent : "",
    sourceDevice: showAdminMeta ? file.sourceDevice || "" : "",
    approximateLocation: showAdminMeta ? file.approximateLocation || null : null,
    createdAt: file.createdAt,
    url: `/api/files/${encodeURIComponent(file.id)}/download`,
    persistence: file.persistence || (file.inlineData ? "disk+inline" : "disk"),
    cloudStorage: file.cloudStorage || "",
    externalBacked: Boolean(file.cloudinarySecureUrl || file.cloudFileId),
    cloudinaryPublicId: showAdminMeta ? file.cloudinaryPublicId || "" : "",
    inlineBacked: Boolean(file.inlineData),
    inlineSize: Number(file.inlineSize || 0),
  };
}

function sanitizeAccountRequest(request) {
  return {
    id: String(request.id || crypto.randomUUID()),
    username: normalizeUsername(request.username),
    displayName: String(request.displayName || request.username || "").trim().slice(0, 80),
    contact: String(request.contact || "").trim().slice(0, 160),
    email: String(request.email || "").trim().slice(0, 120),
    phone: String(request.phone || "").trim().slice(0, 80),
    passwordHash: String(request.passwordHash || "").slice(0, 240),
    passwordSet: Boolean(request.passwordHash || request.passwordSet),
    note: String(request.note || "").trim().slice(0, 600),
    location: sanitizeLocation(request.location),
    status: normalizeAccountRequestStatus(request.status),
    adminNote: String(request.adminNote || "").trim().slice(0, 400),
    sourceIp: String(request.sourceIp || "").slice(0, 80),
    sourceHost: String(request.sourceHost || "").slice(0, 120),
    sourceAgent: String(request.sourceAgent || "").slice(0, 240),
    sourceDevice: String(request.sourceDevice || "").slice(0, 80),
    approximateLocation: request.approximateLocation && typeof request.approximateLocation === "object" ? request.approximateLocation : null,
    createdAt: request.createdAt || new Date().toISOString(),
    updatedAt: request.updatedAt || "",
    updatedBy: String(request.updatedBy || "").slice(0, 80),
    approvedAt: request.approvedAt || "",
    approvedBy: String(request.approvedBy || "").slice(0, 80),
    declinedAt: request.declinedAt || "",
    declinedBy: String(request.declinedBy || "").slice(0, 80),
  };
}

function safeAccountRequest(request) {
  const safe = sanitizeAccountRequest(request);
  delete safe.passwordHash;
  return {
    ...safe,
    location: safe.location
      ? {
          latitude: safe.location.latitude,
          longitude: safe.location.longitude,
          accuracy: safe.location.accuracy,
          sharedAt: safe.location.sharedAt,
        }
      : null,
  };
}

function safeAccountRequests(requests) {
  return (requests || [])
    .map(safeAccountRequest)
    .filter((request) => {
      if (request.status === "declined") return false;
      if (request.status === "approved") {
        const approvedAt = Date.parse(request.approvedAt || request.updatedAt || request.createdAt);
        return Number.isFinite(approvedAt) ? Date.now() - approvedAt < 48 * 60 * 60 * 1000 : true;
      }
      return true;
    })
    .slice(0, 500);
}

async function requestLoginStatus(usernameValue, passwordValue) {
  const username = normalizeUsername(usernameValue);
  if (!username) return null;
  const requests = await readJson(FILES.accountRequests, []);
  const request = requests
    .map(sanitizeAccountRequest)
    .find((entry) => entry.username.toLowerCase() === username.toLowerCase());
  if (!request || !request.passwordHash || !verifyPassword(passwordValue, request.passwordHash)) return null;
  if (request.status === "pending" || request.status === "reviewing") {
    return {
      status: request.status,
      message: "Admin is reviewing your account request. Check back after an admin makes a decision.",
    };
  }
  if (request.status === "declined") {
    const declinedAt = Date.parse(request.declinedAt || request.updatedAt || request.createdAt);
    if (Number.isFinite(declinedAt) && Date.now() - declinedAt <= 12 * 60 * 60 * 1000) {
      return {
        status: "declined",
        message: "Request denied. Ask an admin if you think this was a mistake.",
      };
    }
  }
  return null;
}

function safeActiveReports(reports) {
  return (reports || [])
    .filter((report) => !["done", "closed", "resolved", "dismissed"].includes(String(report.status || "").toLowerCase()))
    .slice(0, 250);
}

function userContactSnapshot(users, username) {
  const target = (users || []).find((entry) => entry.username.toLowerCase() === String(username || "").toLowerCase());
  if (!target) return null;
  return {
    username: target.username,
    contact: String(target.contact || "").slice(0, 160),
    email: String(target.email || "").slice(0, 120),
    phone: String(target.phone || "").slice(0, 80),
    sourceIp: String(target.sourceIp || "").slice(0, 80),
    lastLoginIp: String(target.lastLoginIp || "").slice(0, 80),
  };
}

function formatContactSnapshot(contact) {
  if (!contact) return "not available";
  return [contact.email, contact.phone, contact.contact, contact.lastLoginIp ? `last IP ${contact.lastLoginIp}` : ""].filter(Boolean).join(" / ") || "not available";
}

function liveIpTracking(users) {
  const rows = [];
  const seen = new Set();
  for (const client of wsClients.values()) {
    seen.add(client.username.toLowerCase());
    rows.push({
      username: client.username,
      role: normalizeRole(client.role),
      live: true,
      ip: client.ip || "",
      device: client.device || "",
      network: client.network || {},
      approximateLocation: approximateLocationFromIp(client.ip || ""),
      lastSeenAt: client.connectedAt || new Date().toISOString(),
      source: "live websocket",
    });
  }
  for (const user of users || []) {
    const username = String(user.username || "");
    if (!username || seen.has(username.toLowerCase())) continue;
    rows.push({
      username,
      role: normalizeRole(user.role),
      live: false,
      ip: user.lastLoginIp || user.sourceIp || "",
      device: user.lastLoginDevice || user.sourceDevice || "",
      approximateLocation: user.lastLoginApproximateLocation || user.approximateLocation || approximateLocationFromIp(user.lastLoginIp || user.sourceIp || ""),
      lastSeenAt: user.lastLoginAt || user.createdAt || "",
      source: user.lastLoginAt ? "last login" : "signup/request",
    });
  }
  return rows.sort((a, b) => Number(Boolean(b.live)) - Number(Boolean(a.live)) || String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || "")));
}

function normalizeReceiptContext(context) {
  const value = String(context || "").trim().toLowerCase();
  if (["messages", "dm", "group"].includes(value)) return value;
  return "messages";
}

function receiptKey(context, targetId) {
  return `${normalizeReceiptContext(context)}:${String(targetId || "main").trim().slice(0, 120) || "main"}`;
}

function directReceiptTarget(userA, userB) {
  return [normalizeUsername(userA), normalizeUsername(userB)].filter(Boolean).sort((a, b) => a.localeCompare(b)).join("|");
}

function safeReadReceipts(receipts, user, options = {}) {
  if (!receipts || typeof receipts !== "object") return {};
  if (canManage(user)) return receipts;
  const result = {};
  const groups = Array.isArray(options.dmGroups) ? options.dmGroups.map(sanitizeDmGroup) : [];
  for (const [key, value] of Object.entries(receipts)) {
    const [context, ...rest] = key.split(":");
    const targetId = rest.join(":");
    if (context === "messages") {
      result[key] = value;
    } else if (context === "dm") {
      const participants = targetId.split("|").map(normalizeUsername).filter(Boolean);
      if (participants.includes(user.username)) result[key] = value;
    } else if (context === "group") {
      const group = groups.find((entry) => entry.id === targetId);
      if (group && group.participants.includes(user.username)) result[key] = value;
    }
  }
  return result;
}

async function canAccessReceiptContext(context, targetId, user) {
  if (canManage(user)) return true;
  if (context === "messages") {
    const rooms = await readJson(FILES.rooms, []);
    const room = rooms.find((entry) => entry.id === targetId) || { id: "main" };
    return canAccessRoom(room, user);
  }
  if (context === "group") {
    const groups = await readJson(FILES.dmGroups, []);
    const group = groups.map(sanitizeDmGroup).find((entry) => entry.id === targetId);
    return Boolean(group && group.participants.includes(user.username));
  }
  const participants = targetId.split("|").map(normalizeUsername).filter(Boolean);
  return participants.includes(user.username) && participants.length >= 2;
}

function normalizeAccountRequestStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (["pending", "reviewing", "approved", "declined"].includes(value)) return value;
  return "pending";
}

function safeSettings(settings) {
  return {
    ...settings,
    customizations: sanitizeCustomizations(settings.customizations || {}),
    serviceScale: sanitizeServiceScale(settings.serviceScale || {}),
      featureLocks: activeFeatureLocks(settings.featureLocks || {}),
      featureVisibility: sanitizeFeatureVisibility(settings.featureVisibility || {}),
      paywalls: sanitizePaywalls(settings.paywalls || {}),
      shutdownMode: settings.serverEnabled === false,
    shutdownAt: settings.serverEnabled === false ? String(settings.shutdownAt || "") : "",
    shutdownBy: settings.serverEnabled === false ? String(settings.shutdownBy || "") : "",
    shutdownReason: settings.serverEnabled === false ? String(settings.shutdownReason || "") : "",
  };
}

function safeUploadConfig(settings) {
  const maxBytes = Math.round(MAX_UPLOAD_BYTES * serviceScaleMultiplier(settings || {}, "uploads"));
  return {
    maxBytes,
    maxLabel: formatServerBytes(maxBytes),
    directCloudinary: cloudinaryConfigured() && UPLOAD_PROVIDER !== "mongodb",
    cloudRequired: cloudStorageRequired(),
    provider: storageModeLabel(),
  };
}

function safeDirectUploadDraft(draft) {
  return {
    id: String(draft.id || ""),
    originalName: String(draft.originalName || ""),
    storedName: String(draft.storedName || ""),
    category: String(draft.category || "document"),
    kind: String(draft.kind || "document"),
    mimeType: String(draft.mimeType || "application/octet-stream"),
    size: Number(draft.size || 0),
    user: String(draft.user || ""),
    sourceIp: String(draft.sourceIp || ""),
    sourceHost: String(draft.sourceHost || ""),
    sourceAgent: String(draft.sourceAgent || ""),
    sourceDevice: String(draft.sourceDevice || ""),
    approximateLocation: draft.approximateLocation || null,
    private: Boolean(draft.private),
    createdAt: draft.createdAt || new Date().toISOString(),
    url: `/api/files/${encodeURIComponent(draft.id || "")}/download`,
    persistence: "cloudinary-direct",
  };
}

function defaultServiceScale() {
  return {
    messages: 100,
    dms: 100,
    uploads: 100,
    voice: 100,
    screen: 100,
    notifications: 100,
    moderation: 100,
    realtime: 100,
    domain: 100,
  };
}

function sanitizeServiceScale(scale) {
  const defaults = defaultServiceScale();
  const next = {};
  for (const key of Object.keys(defaults)) {
    const value = Math.round(Number(scale[key] || defaults[key]));
    next[key] = Math.max(25, Math.min(200, Number.isFinite(value) ? value : defaults[key]));
  }
  return next;
}

function serviceScaleMultiplier(settings, key) {
  const scale = sanitizeServiceScale(settings && settings.serviceScale ? settings.serviceScale : {});
  return Math.max(0.25, Math.min(2, Number(scale[key] || 100) / 100));
}

function defaultCustomizations() {
  return {
    appName: "",
    connectedLabel: "",
    disconnectedLabel: "",
    serverOnLabel: "",
    serverOffLabel: "",
    versionLabel: "",
    notice: "",
    accent: "",
    density: "comfortable",
    rounded: true,
    customCss: "",
    updatedAt: "",
    updatedBy: "",
  };
}

function sanitizeCustomizations(customizations) {
  const accent = String(customizations.accent || "").trim();
  return {
    ...defaultCustomizations(),
    appName: String(customizations.appName || "").trim().slice(0, 60),
    connectedLabel: String(customizations.connectedLabel || "").trim().slice(0, 40),
    disconnectedLabel: String(customizations.disconnectedLabel || "").trim().slice(0, 40),
    serverOnLabel: String(customizations.serverOnLabel || "").trim().slice(0, 40),
    serverOffLabel: String(customizations.serverOffLabel || "").trim().slice(0, 40),
    versionLabel: String(customizations.versionLabel || "").trim().slice(0, 80),
    notice: String(customizations.notice || "").trim().slice(0, 240),
    accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent : "",
    density: ["compact", "comfortable"].includes(String(customizations.density || "").toLowerCase()) ? String(customizations.density).toLowerCase() : "comfortable",
    rounded: customizations.rounded !== false,
    customCss: String(customizations.customCss || "").slice(0, 8000),
    updatedAt: customizations.updatedAt || "",
    updatedBy: String(customizations.updatedBy || "").slice(0, 80),
  };
}

function buildRtcConfig() {
  const configuredIceServers = parseIceServersJson(
    firstEnvValue("INNER_ICE_SERVERS_JSON", "ICE_SERVERS_JSON", "TURN_ICE_SERVERS_JSON")
  );
  if (configuredIceServers.length) {
    const config = { iceServers: configuredIceServers, iceCandidatePoolSize: 6 };
    if (isTruthy(process.env.INNER_RTC_RELAY_ONLY)) config.iceTransportPolicy = "relay";
    return config;
  }

  const stunUrls = splitEnvList(firstEnvValue("INNER_STUN_URLS", "STUN_URLS", "STUN_URL")).map(normalizeIceUrl);
  let turnUrls = splitEnvList(
    firstEnvValue(
      "INNER_TURN_URLS",
      "TURN_URLS",
      "TURN_URL",
      "TURNS_URL",
      "TURN_SERVER_URLS",
      "TURN_SERVER_URL"
    )
  ).map((entry) => normalizeIceUrl(entry, "turn"));
  if (!turnUrls.length) {
    const turnHost = firstEnvValue("INNER_TURN_HOST", "TURN_HOST", "TURN_SERVER_HOST");
    if (turnHost) {
      turnUrls = [
        `turn:${turnHost}:3478?transport=udp`,
        `turn:${turnHost}:3478?transport=tcp`,
        `turns:${turnHost}:443?transport=tcp`,
      ];
    }
  }
  const turnUsername = firstEnvValue("INNER_TURN_USERNAME", "INNER_TURN_USER", "TURN_USERNAME", "TURN_USER");
  const turnCredential = firstEnvValue(
    "INNER_TURN_CREDENTIAL",
    "INNER_TURN_CREDENTIALS",
    "INNER_TURN_PASSWORD",
    "INNER_TURN_SECRET",
    "TURN_CREDENTIAL",
    "TURN_CREDENTIALS",
    "TURN_PASSWORD",
    "TURN_SECRET"
  );
  const iceServers = [
    {
      urls: stunUrls.length
        ? stunUrls
        : [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
            "stun:global.stun.twilio.com:3478",
          ],
    },
  ];

  if (turnUrls.length) {
    const turnServer = { urls: turnUrls };
    if (turnUsername) turnServer.username = turnUsername;
    if (turnCredential) {
      turnServer.credential = turnCredential;
      turnServer.credentialType = "password";
    }
    iceServers.push(turnServer);
  }

  const config = { iceServers, iceCandidatePoolSize: 6 };
  if (isTruthy(process.env.INNER_RTC_RELAY_ONLY)) config.iceTransportPolicy = "relay";
  return config;
}

function splitEnvList(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseIceServersJson(value) {
  const textValue = String(value || "").trim();
  if (!textValue) return [];
  try {
    const parsed = JSON.parse(textValue);
    const iceServers = Array.isArray(parsed) ? parsed : parsed.iceServers;
    if (!Array.isArray(iceServers)) return [];
    return iceServers
      .map((entry) => normalizeIceServer(entry))
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function normalizeIceServer(entry) {
  if (!entry || typeof entry !== "object") return null;
  const urls = Array.isArray(entry.urls)
    ? entry.urls.map((url) => normalizeIceUrl(url)).filter(Boolean)
    : normalizeIceUrl(entry.urls);
  if (!urls || (Array.isArray(urls) && !urls.length)) return null;
  const next = { urls };
  if (entry.username) next.username = String(entry.username);
  if (entry.credential || entry.password) {
    next.credential = String(entry.credential || entry.password);
    next.credentialType = entry.credentialType || "password";
  }
  return next;
}

function normalizeIceUrl(value, fallbackScheme = "stun") {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^(stun|stuns|turn|turns):/i.test(url)) return url;
  if (/^https?:/i.test(url)) return "";
  return `${fallbackScheme}:${url}`;
}

function firstEnvValue(...names) {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  return "";
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function isFalsy(value) {
  return ["0", "false", "no", "off"].includes(String(value || "").trim().toLowerCase());
}

function safeStore(store, user) {
  const items = Array.isArray(store.items) ? store.items : [];
  const orders = Array.isArray(store.orders) ? store.orders : [];
  const isAdmin = canManage(user);
  return {
    items: isAdmin ? items : items.filter((item) => item.active !== false),
    orders: isAdmin ? orders : orders.filter((order) => user && order.user === user.username),
  };
}

function activeFeatureLocks(featureLocks) {
  const active = {};
  const now = Date.now();
  for (const [feature, lock] of Object.entries(featureLocks || {})) {
    if (!allowedFeatureLocks.has(feature)) continue;
    const disabledUntil = Date.parse(lock && lock.disabledUntil);
    if (!Number.isFinite(disabledUntil) || disabledUntil <= now) continue;
    active[feature] = {
      disabledUntil: new Date(disabledUntil).toISOString(),
      disabledBy: String(lock.disabledBy || ""),
      reason: String(lock.reason || "").slice(0, 160),
    };
  }
  return active;
}

function featureBlocked(settings, feature, user) {
  if (canManage(user)) return "";
  const visibility = sanitizeFeatureVisibility(settings.featureVisibility || {})[feature];
  if (visibility && visibility.hidden && !visibility.allowedUsers.includes(String(user && user.username || "").toLowerCase())) {
    return `${featureLabel(feature)} is hidden for your account`;
  }
  const lock = activeFeatureLocks(settings.featureLocks || {})[feature];
  if (!lock) return "";
  const label = feature === "dms" ? "DMs" : feature.charAt(0).toUpperCase() + feature.slice(1);
  return `${label} disabled until ${new Date(lock.disabledUntil).toLocaleString()}${lock.reason ? `: ${lock.reason}` : ""}`;
}

async function featureGateError(settings, feature, user) {
  const blocked = featureBlocked(settings, feature, user);
  if (blocked) return blocked;
  const paywalls = sanitizePaywalls(settings.paywalls || {});
  const wholeAppPaywall = paywalls.all;
  if (feature !== "store" && wholeAppPaywall && wholeAppPaywall.enabled) {
    return featurePaywallBlocked(settings, await readJson(FILES.store, { items: [], orders: [] }), "all", user);
  }
  if (!paywalls[feature] || !paywalls[feature].enabled) return "";
  return featurePaywallBlocked(settings, await readJson(FILES.store, { items: [], orders: [] }), feature, user);
}

async function featurePaywallBlocked(settings, store, feature, user) {
  if (canManage(user)) return "";
  const paywall = sanitizePaywalls(settings.paywalls || {})[feature];
  if (!paywall || !paywall.enabled || !paywall.itemId) return "";
  const orders = Array.isArray(store && store.orders) ? store.orders : [];
  const paid = orders.some((order) =>
    order &&
    order.user === user.username &&
    order.itemId === paywall.itemId &&
    order.status === "paid"
  );
  if (paid) return "";
  const items = Array.isArray(store && store.items) ? store.items : [];
  const item = items.find((entry) => entry.id === paywall.itemId);
  return paywall.message || `${featureLabel(feature)} needs ${item ? item.name : "a paid pass"} before you can use it. Open Store to request access.`;
}

function featureLabel(feature) {
  const labels = {
    messages: "Messages",
    all: "All / whole app",
    files: "Files",
    screen: "Screen",
    dms: "DMs",
    rooms: "Side rooms",
    vpn: "VPN",
    friends: "Friends",
    profiles: "Profiles",
    voice: "Voice",
    invites: "Invites",
    moderation: "Moderation",
    bots: "Bots",
    plugins: "Plugins",
    store: "Store",
    chess: "Chess",
  };
  return labels[feature] || String(feature || "Feature");
}

function sanitizeFeatureVisibility(source) {
  const result = {};
  for (const feature of allowedFeatureLocks) {
    const entry = source && source[feature] && typeof source[feature] === "object" ? source[feature] : {};
    result[feature] = {
      hidden: Boolean(entry.hidden),
      allowedUsers: normalizeUsernameList(entry.allowedUsers || []),
    };
  }
  return result;
}

function sanitizePaywalls(source) {
  const result = {};
  for (const feature of allowedFeatureLocks) {
    const entry = source && source[feature] && typeof source[feature] === "object" ? source[feature] : {};
    result[feature] = {
      enabled: Boolean(entry.enabled),
      itemId: String(entry.itemId || "").slice(0, 120),
      message: String(entry.message || "").trim().slice(0, 220),
    };
  }
  return result;
}

function sanitizeClientNetwork(network) {
  const source = network && typeof network === "object" ? network : {};
  return {
    effectiveType: String(source.effectiveType || "").slice(0, 30),
    type: String(source.type || "").slice(0, 30),
    downlink: Math.max(0, Math.min(10000, Number(source.downlink || 0))),
    rtt: Math.max(0, Math.min(60000, Number(source.rtt || 0))),
    saveData: Boolean(source.saveData),
    platform: String(source.platform || "").slice(0, 80),
    language: String(source.language || "").slice(0, 40),
    screen: String(source.screen || "").slice(0, 40),
  };
}

function normalizeRole(role) {
  const value = String(role || "").toLowerCase();
  if (value === "owner") return "admin";
  if (["member", "moderator", "admin", "hmd", "dev"].includes(value)) return value;
  return "member";
}

function normalizeSoundboardSound(sound) {
  const value = String(sound || "").toLowerCase();
  if (["chime", "ping", "pop", "ring"].includes(value)) return value;
  return "chime";
}

function canManage(user) {
  return managerRoles.has(normalizeRole(user && user.role));
}

function canOwn(user) {
  return ownerUsernames.has(String(user && user.username || "").toLowerCase());
}

function canDev(user) {
  return developerRoles.has(normalizeRole(user && user.role));
}

function canBypassShutdown(user) {
  const username = String(user && user.username ? user.username : "").toLowerCase();
  return shutdownExemptUsernames.has(username) || canManage(user);
}

function canModerate(user) {
  return moderatorRoles.has(normalizeRole(user && user.role));
}

function isUserBanned(user) {
  if (!user || !user.bannedUntil) return false;
  const until = Date.parse(user.bannedUntil);
  return Number.isFinite(until) && until > Date.now();
}

function isUserMuted(user) {
  if (!user || !user.mutedUntil) return false;
  const until = Date.parse(user.mutedUntil);
  return Number.isFinite(until) && until > Date.now();
}

function normalizeUsername(username) {
  const value = String(username || "").trim();
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(value)) return "";
  return value;
}

function normalizeCurrency(currency) {
  const value = String(currency || "USD").trim().toUpperCase();
  if (["USD", "INR", "EUR", "GBP"].includes(value)) return value;
  return "USD";
}

function normalizeOrderStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (["pending", "paid", "cancelled", "refunded"].includes(value)) return value;
  return "pending";
}

function normalizeOptionalUrl(value) {
  const textValue = String(value || "").trim().slice(0, 500);
  if (!textValue) return "";
  try {
    const parsed = new URL(textValue);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.toString();
  } catch (error) {
    return "";
  }
  return "";
}

function normalizePresenceStatus(status) {
  const value = String(status || "online").trim().toLowerCase();
  if (["online", "idle", "offline", "busy", "invisible"].includes(value)) return value;
  return "online";
}

function normalizeRoomTheme(theme) {
  const value = String(theme || "system").trim().toLowerCase();
  if (["system", "midnight", "ocean", "forest", "rose", "slate", "glass", "custom"].includes(value)) return value;
  return "system";
}

function defaultCustomTheme() {
  return {
    bg: "#f7f7f4",
    surface: "#ffffff",
    ink: "#151515",
    accent: "#245c4f",
  };
}

function sanitizeCustomTheme(theme) {
  const defaults = defaultCustomTheme();
  return {
    bg: sanitizeHexColor(theme.bg, defaults.bg),
    surface: sanitizeHexColor(theme.surface, defaults.surface),
    ink: sanitizeHexColor(theme.ink, defaults.ink),
    accent: sanitizeHexColor(theme.accent, defaults.accent),
  };
}

function sanitizeHexColor(value, fallback) {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

function normalizeUsernameList(value) {
  if (Array.isArray(value)) return value.map(normalizeUsername).filter(Boolean).slice(0, 200);
  return String(value || "")
    .split(/[,\n]/)
    .map(normalizeUsername)
    .filter(Boolean)
    .slice(0, 200);
}

function normalizeBadgeList(value) {
  const badges = Array.isArray(value) ? value : String(value || "").split(/[,\n]/);
  return badges
    .map((badge) => String(badge || "").trim().slice(0, 24))
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeReportStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (["open", "reviewing", "resolved", "dismissed", "done"].includes(value)) return value;
  return "open";
}

function normalizeReaction(value) {
  const textValue = String(value || "").trim();
  if (["like", "heart", "laugh", "wow", "sad", "pray", "+1", "helpful", "funny", "supportive"].includes(textValue)) return textValue;
  return "";
}

function extractMentions(textValue) {
  return Array.from(new Set(String(textValue || "").match(/@([a-zA-Z0-9._-]{3,32})/g) || []))
    .map((mention) => mention.slice(1))
    .slice(0, 20);
}

function applySlashCommand(textValue) {
  if (textValue.startsWith("/me ")) return `* ${textValue.slice(4).trim()}`;
  if (textValue === "/shrug") return "shrug";
  return textValue;
}

async function checkAutomod(textValue, user) {
  if (canModerate(user)) return "";
  const automod = await readJson(FILES.automod, {});
  if (!automod.enabled) return "";
  const lower = String(textValue || "").toLowerCase();
  for (const word of automod.mutedWords || []) {
    if (word && lower.includes(String(word).toLowerCase())) return "Message blocked by auto moderation";
  }
  return "";
}

async function checkMessageRate(user) {
  if (canModerate(user)) return "";
  const users = await readJson(FILES.users, []);
  const account = users.find((entry) => entry.username === user.username);
  if (isUserMuted(account)) return `You are muted until ${new Date(account.mutedUntil).toLocaleString()}`;
  const automod = await readJson(FILES.automod, {});
  const windowMs = Math.max(2, Number(automod.spamWindowSeconds || 8)) * 1000;
  const settings = await readJson(FILES.settings, {});
  const maxMessages = Math.max(2, Math.round(Number(automod.maxMessagesPerWindow || 6) * serviceScaleMultiplier(settings, "messages")));
  const now = Date.now();
  const entries = (messageRateLimits.get(user.username) || []).filter((time) => now - time < windowMs);
  entries.push(now);
  messageRateLimits.set(user.username, entries);
  if (automod.enabled && entries.length > maxMessages) {
    await addModerationLog("automod", "spam:rate-limit", user.username, `${entries.length}/${maxMessages}`);
    return "Slow down a little before sending more messages";
  }
  return "";
}

async function addModerationLog(actor, action, target, note) {
  const logs = await readJson(FILES.moderationLogs, []);
  logs.unshift({
    id: crypto.randomUUID(),
    actor,
    action,
    target,
    note: String(note || "").slice(0, 500),
    createdAt: new Date().toISOString(),
  });
  await writeJson(FILES.moderationLogs, logs.slice(0, 2000));
  broadcastManagers({ type: "moderation:update", moderationLogs: logs.slice(0, 250) });
}

async function addSystemLog(action, actor, details = {}, req = null) {
  const logs = await readJson(FILES.logs, []);
  const entry = {
    id: crypto.randomUUID(),
    action: String(action || "event").slice(0, 120),
    actor: String(actor || "system").slice(0, 80),
    details,
    sourceIp: req ? getClientIp(req) : "",
    sourceHost: req ? String(req.headers.host || "").slice(0, 120) : "",
    createdAt: new Date().toISOString(),
  };
  logs.unshift(entry);
  const next = logs.slice(0, 3000);
  await writeJson(FILES.logs, next);
  broadcastManagers({ type: "logs:update", logs: next.slice(0, 300) });
}

async function buildDevState(data) {
  const storage = await storageSummary();
  return {
    startedAt: serverStartedAt,
    uptimeSeconds: Math.round((Date.now() - Date.parse(serverStartedAt)) / 1000),
    counts: {
      users: data.users.length,
      rooms: data.rooms.length,
      messages: data.messages.length,
      dms: data.dms.length,
      dmGroups: (data.dmGroups || []).length,
      files: data.files.length,
      accountRequests: (data.accountRequests || []).length,
      logs: (data.logs || []).length,
      reports: data.reports.length,
      orders: (data.store.orders || []).length,
      online: wsClients.size,
    },
    storage,
    devConfig: data.devConfig || {},
    bots: data.bots || [],
    plugins: data.plugins || [],
    automod: data.automod || {},
    local: buildLocalhostState(),
    serviceScale: sanitizeServiceScale(data.settings && data.settings.serviceScale ? data.settings.serviceScale : {}),
  };
}

async function storageSummary() {
  const files = await readJson(FILES.uploads, []);
  const totalUploadBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  const inlineBytes = files.reduce((sum, file) => sum + Number(file.inlineSize || 0), 0);
  const dataFiles = await fsp.readdir(DATA_DIR).catch(() => []);
  return {
    uploadCount: files.length,
    totalUploadBytes,
    inlineBackedCount: files.filter((file) => file.inlineData).length,
    inlineBytes,
    inlineLimitBytes: INLINE_UPLOAD_BYTES,
    dataFileCount: dataFiles.length,
    dataDir: DATA_DIR,
    persistenceMode: storageModeLabel(),
    cloudStorageReady: cloudinaryConfigured() || persistence.ready,
    cloudinaryConfigured: cloudinaryConfigured(),
    cloudinaryFolder: cloudinaryConfigured() ? CLOUDINARY_FOLDER : "",
    cloudStorageError: persistence.error,
  };
}

function buildLocalhostState() {
  const protocol = HTTPS_KEY_PATH && HTTPS_CERT_PATH ? "https" : "http";
  const loopback = `${protocol}://127.0.0.1:${PORT}`;
  const lanLinks = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry && entry.family === "IPv4" && !entry.internal) {
        lanLinks.push(`${protocol}://${entry.address}:${PORT}`);
      }
    }
  }
  return {
    localhostMode: LOCALHOST_MODE,
    loopback,
    lanLinks: Array.from(new Set(lanLinks)).slice(0, 6),
    dataDir: DATA_DIR,
    uploadDir: UPLOAD_DIR,
    port: PORT,
    host: HOST,
    cloudRequired: cloudStorageRequired(),
    storageMode: storageModeLabel(),
  };
}

async function migrateExistingUploadsToCloud() {
  if (!persistence.ready && !cloudinaryConfigured()) return;
  const files = await readJson(FILES.uploads, []);
  if (!Array.isArray(files) || !files.length) return;

  let changed = false;
  for (const record of files) {
    if (!record || !record.storedName) continue;
    const localPath = path.join(UPLOAD_DIR, record.storedName);
    if (cloudinaryConfigured() && record.cloudStorage !== "cloudinary") {
      try {
        if (fs.existsSync(localPath)) {
          const cloudFile = await uploadLocalFileToCloudinary(record.storedName, localPath, record);
          record.cloudStorage = "cloudinary";
          record.cloudinaryPublicId = cloudFile.public_id || "";
          record.cloudinaryResourceType = cloudFile.resource_type || "auto";
          record.cloudinarySecureUrl = cloudFile.secure_url || "";
          record.cloudinaryVersion = cloudFile.version || "";
          record.persistence = record.persistence && record.persistence.includes("disk") ? "disk+cloudinary" : "cloudinary";
          delete record.inlineData;
          record.inlineEncoding = "";
          record.inlineSize = 0;
          changed = true;
          continue;
        } else if (record.inlineEncoding === "base64" && record.inlineData) {
          const buffer = Buffer.from(record.inlineData, "base64");
          const cloudFile = await uploadBufferToCloudinary(record.storedName, buffer, record);
          record.cloudStorage = "cloudinary";
          record.cloudinaryPublicId = cloudFile.public_id || "";
          record.cloudinaryResourceType = cloudFile.resource_type || "auto";
          record.cloudinarySecureUrl = cloudFile.secure_url || "";
          record.cloudinaryVersion = cloudFile.version || "";
          record.persistence = "cloudinary";
          delete record.inlineData;
          record.inlineEncoding = "";
          record.inlineSize = 0;
          changed = true;
          continue;
        }
      } catch (error) {
        persistence.error = error.message || "Cloudinary migration failed";
        console.error("[persistence] cloudinary migration failed:", record.originalName || record.storedName, persistence.error);
      }
    }
    if (!persistence.ready) continue;
    const existing = await findCloudUpload(record).catch(() => null);
    if (existing) {
      if (record.cloudStorage !== "mongodb-gridfs" || String(record.cloudFileId || "") !== String(existing._id)) {
        record.cloudStorage = "mongodb-gridfs";
        record.cloudFileId = String(existing._id);
        record.persistence = record.persistence && record.persistence.includes("disk")
          ? "disk+mongodb-gridfs"
          : "mongodb-gridfs";
        delete record.inlineData;
        record.inlineEncoding = "";
        record.inlineSize = 0;
        changed = true;
      }
      continue;
    }

    try {
      if (fs.existsSync(localPath)) {
        const cloudFile = await uploadLocalFileToCloud(record.storedName, localPath, record);
        record.cloudStorage = "mongodb-gridfs";
        record.cloudFileId = String(cloudFile._id || "");
        record.persistence = "disk+mongodb-gridfs";
        delete record.inlineData;
        record.inlineEncoding = "";
        record.inlineSize = 0;
        changed = true;
      } else if (record.inlineEncoding === "base64" && record.inlineData) {
        const buffer = Buffer.from(record.inlineData, "base64");
        const cloudFile = await uploadBufferToCloud(record.storedName, buffer, record);
        record.cloudStorage = "mongodb-gridfs";
        record.cloudFileId = String(cloudFile._id || "");
        record.persistence = "mongodb-gridfs";
        delete record.inlineData;
        record.inlineEncoding = "";
        record.inlineSize = 0;
        changed = true;
      }
    } catch (error) {
      persistence.error = error.message || "Upload migration failed";
      console.error("[persistence] upload migration failed:", record.originalName || record.storedName, persistence.error);
    }
  }

  if (changed) await writeJson(FILES.uploads, files);
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const raw = forwarded || req.socket.remoteAddress || "";
  return raw.replace(/^::ffff:/, "");
}

function deviceSignature(req) {
  const source = [
    req.headers["user-agent"] || "",
    req.headers["accept-language"] || "",
    req.headers["sec-ch-ua-platform"] || "",
    req.headers["sec-ch-ua-mobile"] || "",
  ].join("|");
  return crypto.createHash("sha256").update(source).digest("hex").slice(0, 24);
}

function approximateLocationFromIp(ip) {
  const clean = String(ip || "").trim();
  const privateNetwork =
    !clean ||
    clean === "::1" ||
    clean === "127.0.0.1" ||
    clean.startsWith("10.") ||
    clean.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(clean);
  return {
    ip: clean,
    type: privateNetwork ? "private/local" : "public",
    note: privateNetwork ? "Approximate location unavailable for local/private IP" : "IP captured for admin review; geolocation lookup can be added by provider",
  };
}

async function notifyAdminEmails(subject, body, options = {}) {
  const settings = await readJson(FILES.settings, {}).catch(() => ({}));
  const configured = Array.isArray(settings.reportEmails) ? settings.reportEmails.map((entry) => String(entry || "").trim()).filter(Boolean) : [];
  const recipients = configured.length ? configured.slice(0, 4) : REPORT_EMAILS;
  if (!recipients.length && !EMAIL_WEBHOOK_URL) {
    await addSystemLog("email.skipped", "system", { subject, reason: "No recipients configured" });
    const result = { ok: false, reason: "No recipients configured", recipients, provider: "", status: 0 };
    return options.detailed ? result : false;
  }
  const payload = {
    subject,
    body,
    recipients,
    app: "Inner",
    createdAt: new Date().toISOString(),
  };

  if (typeof fetch !== "function") {
    await addSystemLog("email.queued", "system", { subject, recipients, reason: "Fetch unavailable" });
    const result = { ok: false, reason: "Fetch unavailable", recipients, provider: "", status: 0 };
    return options.detailed ? result : false;
  }

  const attempts = [
    smtpConfigured() ? () => sendSmtpEmail(payload) : null,
    RESEND_API_KEY ? () => sendResendEmail(payload) : null,
    BREVO_API_KEY ? () => sendBrevoEmail(payload) : null,
    SENDGRID_API_KEY ? () => sendSendGridEmail(payload) : null,
    EMAIL_WEBHOOK_URL ? () => sendWebhookEmail(payload) : null,
  ].filter(Boolean);
  if (!attempts.length) {
    await addSystemLog("email.queued", "system", { subject, recipients, reason: "No email provider configured" });
    const result = { ok: false, reason: "No email provider configured", recipients, provider: "", status: 0 };
    return options.detailed ? result : false;
  }

  let lastError = "";
  let lastProvider = "";
  let lastStatus = 0;
  for (const attempt of attempts) {
    try {
      const result = await attempt();
      lastProvider = result.provider || lastProvider;
      lastStatus = result.status || lastStatus;
      await addSystemLog(result.ok ? "email.sent" : "email.failed", "system", {
        subject,
        recipients,
        provider: result.provider,
        status: result.status,
        reason: result.error || "",
      });
      if (result.ok) return options.detailed ? { ...result, recipients } : true;
      lastError = result.error || `status ${result.status}`;
    } catch (error) {
      lastError = error.message || "provider failed";
      await addSystemLog("email.failed", "system", { subject, recipients, reason: lastError });
    }
  }

  await addSystemLog("email.failed", "system", { subject, recipients, reason: lastError || "All providers failed" });
  const result = { ok: false, reason: lastError || "All providers failed", recipients, provider: lastProvider, status: lastStatus };
  return options.detailed ? result : false;
}

async function sendResendEmail(payload) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: payload.recipients,
      subject: payload.subject,
      text: payload.body,
      reply_to: EMAIL_REPLY_TO || undefined,
    }),
  });
  const data = await response.json().catch(() => ({}));
  return {
    provider: "resend",
    ok: response.ok,
    status: response.status,
    error: data.message || (data.error && data.error.message) || "",
  };
}

function smtpConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

async function sendSmtpEmail(payload) {
  const { email, name } = parseEmailFrom(EMAIL_FROM || SMTP_USER);
  if (!email || !email.includes("@")) {
    return { provider: "smtp", ok: false, status: 0, error: "INNER_EMAIL_FROM must be a real email sender" };
  }
  const port = SMTP_PORT || (isTruthy(SMTP_SECURE) ? 465 : 587);
  const secure = isTruthy(SMTP_SECURE) || port === 465;
  const subject = sanitizeMailHeader(payload.subject);
  const fromHeader = name ? `${sanitizeMailHeader(name)} <${email}>` : email;
  const toHeader = payload.recipients.join(", ");
  const message = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    payload.body,
  ].join("\r\n").replace(/\r?\n\./g, "\r\n..");

  let socket;
  try {
    socket = await openSmtpSocket(SMTP_HOST, port, secure);
    const session = smtpSession(socket);
    await session.expect(220);
    await session.command(`EHLO ${smtpEhloName()}`, 250);
    if (!secure && port !== 25) {
      await session.command("STARTTLS", 220);
      socket = tls.connect({ socket, servername: SMTP_HOST, rejectUnauthorized: false });
      await new Promise((resolve, reject) => {
        socket.once("secureConnect", resolve);
        socket.once("error", reject);
      });
      session.replaceSocket(socket);
      await session.command(`EHLO ${smtpEhloName()}`, 250);
    }
    await session.command("AUTH LOGIN", 334);
    await session.command(Buffer.from(SMTP_USER).toString("base64"), 334);
    await session.command(Buffer.from(SMTP_PASS).toString("base64"), 235);
    await session.command(`MAIL FROM:<${email}>`, 250);
    for (const recipient of payload.recipients) {
      await session.command(`RCPT TO:<${recipient}>`, [250, 251]);
    }
    await session.command("DATA", 354);
    await session.command(`${message}\r\n.`, 250);
    await session.command("QUIT", 221).catch(() => {});
    socket.end();
    return { provider: "smtp", ok: true, status: 200, error: "" };
  } catch (error) {
    if (socket) socket.destroy();
    return { provider: "smtp", ok: false, status: 0, error: error.message || "SMTP send failed" };
  }
}

function openSmtpSocket(host, port, secure) {
  return new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host, port, servername: host, rejectUnauthorized: false })
      : net.createConnection({ host, port });
    socket.setTimeout(20000, () => socket.destroy(new Error("SMTP connection timed out")));
    socket.once(secure ? "secureConnect" : "connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

function smtpSession(initialSocket) {
  let socket = initialSocket;
  let buffer = "";
  let waiters = [];
  const onData = (chunk) => {
    buffer += chunk.toString("utf8");
    flush();
  };
  const onError = (error) => {
    const next = waiters;
    waiters = [];
    next.forEach((entry) => entry.reject(error));
  };
  const attach = (nextSocket) => {
    socket = nextSocket;
    buffer = "";
    socket.on("data", onData);
    socket.on("error", onError);
  };
  const detach = () => {
    socket.off("data", onData);
    socket.off("error", onError);
  };
  const flush = () => {
    const complete = buffer.match(/(?:^|\r?\n)(\d{3}) [^\r\n]*(?:\r?\n)?$/);
    if (!complete || !waiters.length) return;
    const response = buffer;
    buffer = "";
    waiters.shift().resolve(response);
  };
  const expect = async (codes) => {
    const accepted = Array.isArray(codes) ? codes : [codes];
    const response = await new Promise((resolve, reject) => {
      waiters.push({ resolve, reject });
      flush();
    });
    const code = Number(response.slice(0, 3));
    if (!accepted.includes(code)) {
      throw new Error(`SMTP ${code || "error"}: ${response.trim().slice(0, 220)}`);
    }
    return response;
  };
  attach(socket);
  return {
    expect,
    async command(command, codes) {
      socket.write(`${command}\r\n`);
      return expect(codes);
    },
    replaceSocket(nextSocket) {
      detach();
      attach(nextSocket);
    },
  };
}

function smtpEhloName() {
  return "inner.local";
}

function sanitizeMailHeader(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").slice(0, 180);
}

async function sendBrevoEmail(payload) {
  const { email, name } = parseEmailFrom(EMAIL_FROM);
  if (!email || !email.includes("@")) {
    return {
      provider: "brevo",
      ok: false,
      status: 0,
      error: "INNER_EMAIL_FROM must be a real sender, for example Inner <innerservers@gmail.com>",
    };
  }
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      sender: { email, name: name || "Inner" },
      to: payload.recipients.map((address) => ({ email: address })),
      subject: payload.subject,
      textContent: payload.body,
      replyTo: EMAIL_REPLY_TO ? { email: EMAIL_REPLY_TO } : undefined,
    }),
  });
  const data = await response.json().catch(() => ({}));
  return {
    provider: "brevo",
    ok: response.ok,
    status: response.status,
    error: data.message || "",
  };
}

async function sendSendGridEmail(payload) {
  const { email, name } = parseEmailFrom(EMAIL_FROM);
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: payload.recipients.map((address) => ({ email: address })) }],
      from: { email, name: name || "Inner" },
      reply_to: EMAIL_REPLY_TO ? { email: EMAIL_REPLY_TO } : undefined,
      subject: payload.subject,
      content: [{ type: "text/plain", value: payload.body }],
    }),
  });
  const text = await response.text().catch(() => "");
  return {
    provider: "sendgrid",
    ok: response.ok,
    status: response.status,
    error: text.slice(0, 300),
  };
}

async function sendWebhookEmail(payload) {
  try {
    const response = await fetch(EMAIL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await response.text().catch(() => "");
    return {
      provider: "webhook",
      ok: response.ok,
      status: response.status,
      error: text.slice(0, 300),
    };
  } catch (error) {
    return {
      provider: "webhook",
      ok: false,
      status: 0,
      error: error.message || "webhook failed",
    };
  }
}

function parseEmailFrom(value) {
  const raw = String(value || "").trim();
  const match = /^(.*?)<([^>]+)>$/.exec(raw);
  if (match) {
    return {
      name: match[1].trim().replace(/^"|"$/g, ""),
      email: match[2].trim(),
    };
  }
  return { name: "Inner", email: raw || "noreply@example.com" };
}

function emailProviderStatus(recipients = []) {
  const parsedFrom = parseEmailFrom(EMAIL_FROM);
  return {
    recipients: recipients.length ? recipients : REPORT_EMAILS,
    from: EMAIL_FROM,
    fromEmail: parsedFrom.email,
    replyTo: EMAIL_REPLY_TO || "",
    providers: {
      smtp: smtpConfigured(),
      brevo: Boolean(BREVO_API_KEY),
      resend: Boolean(RESEND_API_KEY),
      sendgrid: Boolean(SENDGRID_API_KEY),
      webhook: Boolean(EMAIL_WEBHOOK_URL),
    },
  };
}

function emailFailureMessage(result, status) {
  if (!status.recipients.length) return "Email was not sent because no report emails are configured.";
  if (!status.providers.smtp && !status.providers.brevo && !status.providers.resend && !status.providers.sendgrid && !status.providers.webhook) {
    return "Email provider is not visible to the server yet. Add SMTP settings or BREVO_API_KEY in Render Environment, save changes, then redeploy/restart.";
  }
  const provider = result.provider ? `${result.provider} ` : "";
  const detail = result.reason || result.error || "";
  if (result.provider === "brevo" && result.status === 403 && /not yet activated|smtp account/i.test(detail)) {
    return "Brevo is connected, but Brevo rejected the email because your Brevo SMTP/API account is not activated yet. Activate transactional SMTP/API in Brevo or contact contact@brevo.com, then click Send test email again.";
  }
  if (result.provider === "brevo" && result.status === 401) {
    return "Brevo rejected the API key. Check BREVO_API_KEY in Render Environment, save, then redeploy/restart.";
  }
  return `Email was not sent. ${provider}${result.status ? `status ${result.status}. ` : ""}${detail}`.trim();
}

function sanitizeExternalUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.toString();
  } catch (error) {
    return "";
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function serveAdminBrowserFrame(req, res, requestUrl) {
  const target = sanitizeExternalUrl(requestUrl.searchParams.get("url"));
  if (!target) return text(res, 400, "Enter a valid http or https URL");
  if (typeof fetch !== "function") return text(res, 500, "Server fetch is unavailable");
  try {
    const response = await fetch(target, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 Inner Admin Browser",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const contentType = response.headers.get("content-type") || "text/html; charset=utf-8";
    const body = await response.text();
    res.statusCode = response.ok ? 200 : response.status;
    res.setHeader("Content-Type", contentType.includes("text/html") ? "text/html; charset=utf-8" : contentType);
    res.setHeader("Cache-Control", "no-store");
    if (!contentType.includes("text/html")) return res.end(body);
    const escapedTarget = escapeHtml(target);
    const baseTag = `<base href="${escapedTarget}">`;
    const cleaned = body
      .replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, "")
      .replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
    return res.end(cleaned.includes("<head") ? cleaned : `${baseTag}${cleaned}`);
  } catch (error) {
    return text(res, 502, `Could not open site through admin browser: ${error.message || "fetch failed"}`);
  }
}

function sanitizeLocation(location) {
  if (!location || typeof location !== "object") return null;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(Number(location.accuracy)) ? Number(location.accuracy) : null,
    source: String(location.source || "browser").slice(0, 40),
    reason: String(location.reason || "").slice(0, 120),
    sharedAt: new Date().toISOString(),
  };
}

function safeVpn(vpn) {
  return {
    enabled: Boolean(vpn.enabled),
    username: vpn.username || "",
    passwordSet: Boolean(vpn.passwordHash),
    location: vpn.location || "United States",
    updatedAt: vpn.updatedAt || "",
    updatedBy: vpn.updatedBy || "",
  };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, passwordRecord) {
  const [salt, expected] = String(passwordRecord || "").split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === actual.length && crypto.timingSafeEqual(expectedBuffer, actual);
}

async function readJsonBody(req) {
  const body = await readBody(req, MAX_JSON_BYTES);
  if (!body.trim()) return {};
  return JSON.parse(body);
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJson(file, fallback) {
  const key = jsonStorageKey(file);
  if (persistence.ready && key) {
    try {
      const document = await persistence.json.findOne({ _id: key });
      if (document && Object.prototype.hasOwnProperty.call(document, "data")) return document.data;

      const localValue = await readLocalJson(file, null);
      if (localValue !== null) {
        await writeCloudJson(key, localValue);
        return localValue;
      }
      return fallback;
    } catch (error) {
      persistence.error = error.message || "Cloud read failed";
      console.log("MongoDB failure bypassed.");
    }
  }

  return readLocalJson(file, fallback);
}

async function readLocalJson(file, fallback) {
  try {
    const data = await fsp.readFile(file, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return fallback;
  }
}

async function writeJson(file, value) {
  const key = jsonStorageKey(file);
  if (persistence.ready && key) {
    try {
      await writeCloudJson(key, value);
      await writeLocalJson(file, value).catch(() => {});
      return;
    } catch (error) {
      persistence.error = error.message || "Cloud write failed";
      console.log("MongoDB failure bypassed.");
    }
  }

  await writeLocalJson(file, value);
}

async function writeCloudJson(key, value) {
  const data = key === "files" && Array.isArray(value) ? value.map(stripInlineUploadData) : value;
  await persistence.json.updateOne(
    { _id: key },
    {
      $set: {
        data,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}

async function writeLocalJson(file, value) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const jsonText = `${JSON.stringify(value, null, 2)}\n`;
  const directory = path.dirname(file);
  const tempFile = path.join(
    directory,
    `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`
  );
  let handle;

  try {
    handle = await fsp.open(tempFile, "w");
    await handle.writeFile(jsonText, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await fsp.rename(tempFile, file);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fsp.rm(tempFile, { force: true }).catch(() => {});
    throw error;
  }
}

async function jsonExists(file) {
  const key = jsonStorageKey(file);
  if (persistence.ready && key) {
    const document = await persistence.json.findOne({ _id: key }, { projection: { _id: 1 } });
    if (document) return true;
  }
  return fs.existsSync(file);
}

function jsonStorageKey(file) {
  const absolute = path.resolve(String(file || ""));
  const relative = path.relative(DATA_DIR, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return "";
  if (path.extname(relative).toLowerCase() !== ".json") return "";
  return relative.replaceAll(path.sep, "/").replace(/\.json$/i, "");
}

function stripInlineUploadData(record) {
  if (!record || typeof record !== "object") return record;
  const { inlineData, ...next } = record;
  if (inlineData) {
    next.inlineEncoding = "";
    next.inlineSize = 0;
  }
  return next;
}

async function listBackups() {
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
  const entries = await fsp.readdir(BACKUP_DIR, { withFileTypes: true }).catch(() => []);
  const backups = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const stat = await fsp.stat(path.join(BACKUP_DIR, entry.name)).catch(() => null);
    if (!stat) continue;
    backups.push({
      fileName: entry.name,
      size: stat.size,
      createdAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    });
  }
  return backups.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

async function createBackup(username) {
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
  const [settings, rooms, messages, dms, dmGroups, files, accountRequests, store, aiRequests, users, vpn, profiles, friends, invites, reports, readReceipts, moderationLogs, logs, devConfig, voiceRooms, bots, plugins, automod] = await Promise.all([
    readJson(FILES.settings, {}),
    readJson(FILES.rooms, []),
    readJson(FILES.messages, []),
    readJson(FILES.dms, []),
    readJson(FILES.dmGroups, []),
    readJson(FILES.uploads, []),
    readJson(FILES.accountRequests, []),
    readJson(FILES.store, { items: [], orders: [] }),
    readJson(FILES.aiRequests, []),
    readJson(FILES.users, []),
    readJson(FILES.vpn, {}),
    readJson(FILES.profiles, {}),
    readJson(FILES.friends, { requests: [], friendships: [] }),
    readJson(FILES.invites, []),
    readJson(FILES.reports, []),
    readJson(FILES.readReceipts, {}),
    readJson(FILES.moderationLogs, []),
    readJson(FILES.logs, []),
    readJson(FILES.devConfig, {}),
    readJson(FILES.voiceRooms, []),
    readJson(FILES.bots, []),
    readJson(FILES.plugins, []),
    readJson(FILES.automod, {}),
  ]);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `inner-backup-${timestamp}.json`;
  const backup = {
    app: "Inner",
    version: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: username,
    note: "This backup includes account password hashes, account requests, chat history, and upload records. Uploaded file contents remain in data/uploads unless an upload has an inline backup.",
    data: {
      settings,
      rooms,
      messages,
      dms,
      dmGroups,
      files,
      accountRequests,
      store,
      aiRequests,
      users,
      vpn: safeVpn(vpn),
      profiles,
      friends,
      invites,
      reports,
      readReceipts,
      moderationLogs,
      logs,
      devConfig,
      voiceRooms,
      bots,
      plugins,
      automod,
    },
  };
  await writeJson(path.join(BACKUP_DIR, fileName), backup);
  const stat = await fsp.stat(path.join(BACKUP_DIR, fileName));
  return {
    fileName,
    size: stat.size,
    createdAt: stat.birthtime.toISOString(),
    updatedAt: stat.mtime.toISOString(),
  };
}

async function serveBackup(res, fileName) {
  const target = path.join(BACKUP_DIR, fileName);
  try {
    const stat = await fsp.stat(target);
    if (!stat.isFile()) return json(res, 404, { error: "Backup not found" });
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": stat.size,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    });
    fs.createReadStream(target).pipe(res);
  } catch (error) {
    json(res, 404, { error: "Backup not found" });
  }
}

async function restoreBackup(fileName, username) {
  const target = path.join(BACKUP_DIR, sanitizeBackupName(fileName));
  const backup = await readLocalJson(target, null);
  if (!backup || !backup.data || typeof backup.data !== "object") {
    throw new Error("Backup file is invalid");
  }
  const data = backup.data;
  const map = [
    ["settings", FILES.settings, {}],
    ["rooms", FILES.rooms, []],
    ["messages", FILES.messages, []],
    ["dms", FILES.dms, []],
    ["dmGroups", FILES.dmGroups, []],
    ["files", FILES.uploads, []],
    ["accountRequests", FILES.accountRequests, []],
    ["store", FILES.store, { items: [], orders: [] }],
    ["aiRequests", FILES.aiRequests, []],
    ["users", FILES.users, []],
    ["vpn", FILES.vpn, {}],
    ["profiles", FILES.profiles, {}],
    ["friends", FILES.friends, { requests: [], friendships: [] }],
    ["invites", FILES.invites, []],
    ["reports", FILES.reports, []],
    ["readReceipts", FILES.readReceipts, {}],
    ["moderationLogs", FILES.moderationLogs, []],
    ["logs", FILES.logs, []],
    ["devConfig", FILES.devConfig, {}],
    ["voiceRooms", FILES.voiceRooms, []],
    ["bots", FILES.bots, []],
    ["plugins", FILES.plugins, []],
    ["automod", FILES.automod, {}],
  ];
  for (const [key, file, fallback] of map) {
    await writeJson(file, data[key] === undefined ? fallback : data[key]);
  }
  await ensureRooms();
  await ensureSettings();
  await addSystemLog("backup.restored", username, { fileName });
  return { fileName, restoredAt: new Date().toISOString() };
}

async function generateAiSuggestion(prompt) {
  const aiConfig = await readJson(FILES.ai, {});
  const apiKey = process.env.OPENAI_API_KEY || aiConfig.apiKey || "";
  if (!apiKey) {
    return {
      configured: false,
      text:
        "AI is not connected yet. Set OPENAI_API_KEY before starting Inner, then ask again. I saved this request in the Admin panel so it is not lost.",
    };
  }

  if (typeof fetch !== "function") {
    return {
      configured: false,
      text: "This Node runtime does not include fetch, so the AI helper cannot call the API from here.",
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.INNER_AI_MODEL || "gpt-5.2",
        instructions:
          "You are the built-in admin helper for Inner, a small private workspace app. Help the admin describe safe, small UI/content/admin-setting changes. Do not ask for passwords, secrets, or unsafe surveillance. Return a concise plan and exact text/settings to change.",
        input: prompt,
        max_output_tokens: 700,
        store: false,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        configured: false,
        text: data.error && data.error.message ? data.error.message : `AI request failed (${response.status})`,
      };
    }
    return {
      configured: true,
      text: extractAiText(data) || "AI returned no text.",
    };
  } catch (error) {
    return {
      configured: false,
      text: error.message || "AI request failed.",
    };
  }
}

function extractAiText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function sanitizeBackupName(name) {
  let decoded = "";
  try {
    decoded = decodeURIComponent(String(name || ""));
  } catch (error) {
    return "";
  }
  if (!/^inner-backup-[a-zA-Z0-9_.-]+\.json$/.test(decoded)) return "";
  return decoded;
}

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function text(res, status, payload) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(payload);
}

async function serveStatic(res, filePath) {
  const safePath = safeJoin(PUBLIC_DIR, path.relative(PUBLIC_DIR, filePath));
  if (!safePath) return text(res, 404, "Not found");
  try {
    const stat = await fsp.stat(safePath);
    if (!stat.isFile()) return text(res, 404, "Not found");
    const extension = path.extname(safePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(safePath).pipe(res);
  } catch (error) {
    text(res, 404, "Not found");
  }
}

async function serveUpload(req, res, pathname, user) {
  const settings = await readJson(FILES.settings, {});
  if (!settings.serverEnabled && !canManage(user)) return text(res, 423, "Server room is off");
  const featureError = await featureGateError(settings, "files", user);
  if (featureError) return text(res, 423, featureError);
  const storedName = path.basename(pathname);
  const files = await readJson(FILES.uploads, []);
  const record = files.find((entry) => entry.storedName === storedName);
  if (!record) return text(res, 404, "Not found");
  if (!canAccessFileRecord(record, user)) return text(res, 403, "Private file");

  const target = path.join(UPLOAD_DIR, storedName);
  return serveFileRecord(req, res, record, target);
}

async function serveFileRecord(req, res, record, targetPath = "") {
  const target = targetPath || path.join(UPLOAD_DIR, record.storedName || "");
  try {
    const stat = await fsp.stat(target);
    const extension = path.extname(target).toLowerCase();
    const contentType = record.mimeType || mimeTypes[extension] || "application/octet-stream";
    const requestUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    const dispositionType = requestUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
    const disposition = `${dispositionType}; filename="${record.originalName.replaceAll('"', "")}"`;
    const range = req.headers.range;

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match) {
        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Number(match[2]) : stat.size - 1;
        if (start <= end && end < stat.size) {
          res.writeHead(206, {
            "Content-Type": contentType,
            "Content-Length": end - start + 1,
            "Content-Disposition": disposition,
            "Accept-Ranges": "bytes",
            "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          });
          fs.createReadStream(target, { start, end }).pipe(res);
          return;
        }
      }
    }

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stat.size,
      "Content-Disposition": disposition,
      "Accept-Ranges": "bytes",
    });
    fs.createReadStream(target).pipe(res);
  } catch (error) {
    if (await serveCloudUpload(req, res, record)) {
      return;
    }
    if (record.inlineEncoding === "base64" && record.inlineData) {
      return serveUploadBuffer(req, res, record, Buffer.from(record.inlineData, "base64"));
    }
    text(res, 404, "Not found");
  }
}

async function serveCloudUpload(req, res, record) {
  if (record && record.cloudStorage === "cloudinary" && record.cloudinarySecureUrl) {
    const requestUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    if (record.private || requestUrl.searchParams.get("download") === "1") return proxyCloudinaryUpload(req, res, record);
    res.writeHead(302, {
      Location: record.cloudinarySecureUrl,
      "Cache-Control": record.private ? "no-store" : "private, max-age=60",
    });
    res.end();
    return true;
  }
  if (!persistence.ready || !persistence.uploadBucket || !record || !record.storedName) return false;
  const file = await findCloudUpload(record);
  if (!file) return false;

  const contentType = record.mimeType || file.contentType || "application/octet-stream";
  const requestUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const dispositionType = requestUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  const disposition = `${dispositionType}; filename="${String(record.originalName || "upload").replaceAll('"', "")}"`;
  const size = Number(file.length || record.size || 0);
  const range = req.headers.range;
  let status = 200;
  let start = 0;
  let end = Math.max(0, size - 1);
  const headers = {
    "Content-Type": contentType,
    "Content-Disposition": disposition,
    "Accept-Ranges": "bytes",
  };

  if (range && size > 0) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      start = match[1] ? Number(match[1]) : 0;
      end = match[2] ? Number(match[2]) : size - 1;
      if (start > end || end >= size) {
        res.writeHead(416, { "Content-Range": `bytes */${size}` });
        res.end();
        return true;
      }
      status = 206;
      headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
    }
  }

  headers["Content-Length"] = status === 206 ? end - start + 1 : size;
  const streamOptions = status === 206 ? { start, end: end + 1 } : {};
  const stream = persistence.uploadBucket.openDownloadStream(file._id, streamOptions);
  stream.on("error", () => {
    if (!res.headersSent) text(res, 404, "Not found");
    else res.destroy();
  });
  res.writeHead(status, headers);
  stream.pipe(res);
  return true;
}

async function proxyCloudinaryUpload(req, res, record) {
  if (typeof fetch !== "function") return false;
  const requestHeaders = {};
  if (req.headers.range) requestHeaders.Range = req.headers.range;
  const upstream = await fetch(record.cloudinarySecureUrl, { headers: requestHeaders }).catch(() => null);
  if (!upstream || !upstream.ok) return false;
  const requestUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const dispositionType = requestUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  const headers = {
    "Content-Type": upstream.headers.get("content-type") || record.mimeType || "application/octet-stream",
    "Content-Disposition": `${dispositionType}; filename="${String(record.originalName || "upload").replaceAll('"', "")}"`,
    "Accept-Ranges": upstream.headers.get("accept-ranges") || "bytes",
    "Cache-Control": "no-store",
  };
  const length = upstream.headers.get("content-length");
  const range = upstream.headers.get("content-range");
  if (length) headers["Content-Length"] = length;
  if (range) headers["Content-Range"] = range;
  res.writeHead(upstream.status, headers);
  if (upstream.body) {
    Readable.fromWeb(upstream.body).pipe(res);
  } else {
    res.end(Buffer.from(await upstream.arrayBuffer()));
  }
  return true;
}

async function findCloudUpload(record) {
  if (!persistence.ready || !persistence.uploadFiles) return null;
  if (record.cloudFileId && persistence.ObjectId && persistence.ObjectId.isValid(record.cloudFileId)) {
    const byId = await persistence.uploadFiles.findOne({ _id: new persistence.ObjectId(record.cloudFileId) });
    if (byId) return byId;
  }
  return persistence.uploadFiles.findOne({ filename: record.storedName }, { sort: { uploadDate: -1 } });
}

function addCloudinaryDownloadFlag(url, originalName) {
  try {
    const parsed = new URL(url);
    const cleanName = String(originalName || "download").replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "download";
    parsed.searchParams.set("download", cleanName);
    return parsed.toString();
  } catch (error) {
    return url;
  }
}

async function deleteCloudUpload(record) {
  if (record && record.cloudStorage === "cloudinary") {
    await deleteCloudinaryUpload(record);
    return;
  }
  if (!persistence.ready || !persistence.uploadBucket || !persistence.uploadFiles || !record) return;
  const files = await persistence.uploadFiles.find({ filename: record.storedName }).toArray();
  if (
    record.cloudFileId &&
    persistence.ObjectId &&
    persistence.ObjectId.isValid(record.cloudFileId) &&
    !files.some((file) => String(file._id) === String(record.cloudFileId))
  ) {
    files.push({ _id: new persistence.ObjectId(record.cloudFileId) });
  }
  for (const file of files) {
    await persistence.uploadBucket.delete(file._id).catch(() => {});
  }
}

function serveUploadBuffer(req, res, record, buffer) {
  const contentType = record.mimeType || "application/octet-stream";
  const requestUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const dispositionType = requestUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  const disposition = `${dispositionType}; filename="${String(record.originalName || "upload").replaceAll('"', "")}"`;
  const range = req.headers.range;

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : buffer.length - 1;
      if (start <= end && end < buffer.length) {
        res.writeHead(206, {
          "Content-Type": contentType,
          "Content-Length": end - start + 1,
          "Content-Disposition": disposition,
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${start}-${end}/${buffer.length}`,
        });
        res.end(buffer.subarray(start, end + 1));
        return;
      }
    }
  }

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": buffer.length,
    "Content-Disposition": disposition,
    "Accept-Ranges": "bytes",
  });
  res.end(buffer);
}

function safeJoin(base, requestPath) {
  const cleaned = String(requestPath || "").replace(/^[/\\]+/, "");
  const normalized = path.normalize(cleaned);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) return null;
  const fullPath = path.join(base, normalized);
  const relative = path.relative(base, fullPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return fullPath;
}

function sanitizeFileName(name) {
  const raw = String(name || "upload.bin");
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch (error) {
    decoded = raw;
  }
  const base = path.basename(decoded);
  return base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 180) || "upload.bin";
}

function normalizeCategory(category) {
  const value = String(category || "").toLowerCase();
  if (["image", "video", "audio", "document", "mun", "important"].includes(value)) return value;
  return "document";
}

function parseBooleanHeader(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "on", "private"].includes(normalized);
}

function formatServerBytes(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (value >= 1024 * 1024) return `${Math.round(value / 1024 / 1024)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function isAllowedUploadExtension(extension) {
  const value = String(extension || "").toLowerCase();
  if (!value || dangerousUploadExtensions.has(value)) return false;
  if (allowedExtensions.has(value)) return true;
  return /^\.[a-z0-9]{1,12}$/.test(value);
}

async function validateUploadBytes(filePath, extension, mimeType) {
  const handle = await fsp.open(filePath, "r").catch(() => null);
  if (!handle) return "Could not verify uploaded file";
  try {
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return validateUploadBuffer(buffer.subarray(0, bytesRead), extension, mimeType);
  } finally {
    await handle.close().catch(() => {});
  }
}

function validateUploadBuffer(buffer, extension, mimeType) {
  if (dangerousUploadExtensions.has(extension)) return "Dangerous executable uploads are blocked";
  const head = Buffer.isBuffer(buffer) ? buffer.subarray(0, 16) : Buffer.alloc(0);
  if (!head.length) return "File is empty";
  const hex = head.toString("hex");
  const ascii = head.toString("latin1");
  const expected = {
    ".png": () => hex.startsWith("89504e47"),
    ".jpg": () => hex.startsWith("ffd8ff"),
    ".jpeg": () => hex.startsWith("ffd8ff"),
    ".gif": () => ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a"),
    ".webp": () => ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP",
    ".pdf": () => ascii.startsWith("%PDF"),
    ".zip": () => hex.startsWith("504b0304") || hex.startsWith("504b0506") || hex.startsWith("504b0708"),
    ".mp4": () => ascii.slice(4, 8) === "ftyp",
    ".m4a": () => ascii.slice(4, 8) === "ftyp",
    ".mp3": () => ascii.startsWith("ID3") || hex.startsWith("fffb") || hex.startsWith("fff3") || hex.startsWith("fff2"),
    ".wav": () => ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE",
    ".ogg": () => ascii.startsWith("OggS"),
  };
  if (expected[extension] && !expected[extension]()) return "File content does not match its extension";
  if (String(mimeType || "").includes("x-msdownload")) return "Executable uploads are blocked";
  return "";
}

function classifyFile(extension, mimeType) {
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".heic", ".heif"].includes(extension)) return "image";
  if ([".mp4", ".webm", ".mov", ".avi", ".mkv"].includes(extension)) return "video";
  if ([".mp3", ".wav", ".ogg", ".m4a"].includes(extension)) return "audio";
  if (String(mimeType || "").startsWith("image/")) return "image";
  if (String(mimeType || "").startsWith("video/")) return "video";
  if (String(mimeType || "").startsWith("audio/")) return "audio";
  return "document";
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
