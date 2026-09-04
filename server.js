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
const B2_KEY_ID = firstEnvValue("INNER_B2_KEY_ID", "B2_KEY_ID", "BACKBLAZE_B2_KEY_ID");
const B2_APPLICATION_KEY = firstEnvValue("INNER_B2_APPLICATION_KEY", "B2_APPLICATION_KEY", "BACKBLAZE_B2_APPLICATION_KEY");
const B2_BUCKET_NAME = firstEnvValue("INNER_B2_BUCKET_NAME", "B2_BUCKET_NAME", "BACKBLAZE_B2_BUCKET_NAME");
const B2_BUCKET_ID = firstEnvValue("INNER_B2_BUCKET_ID", "B2_BUCKET_ID", "BACKBLAZE_B2_BUCKET_ID");
const REPORT_EMAILS = splitEnvList(firstEnvValue("INNER_REPORT_EMAILS", "REPORT_EMAILS", "INNER_ADMIN_EMAILS", "ADMIN_EMAILS")).slice(0, 4);
const OWNER_CHECKIN_EMAIL = "dev.s.shah2013@gmail.com";
const EMAIL_WEBHOOK_URL = firstEnvValue("INNER_EMAIL_WEBHOOK_URL", "REPORT_EMAIL_WEBHOOK_URL", "EMAIL_WEBHOOK_URL");
const EMAIL_FROM = firstEnvValue("INNER_EMAIL_FROM", "EMAIL_FROM", "RESEND_FROM", "SENDGRID_FROM", "BREVO_FROM") || "Connectifi <innerservers@gmail.com>";
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
const BLOCK_DUPLICATE_SIGNUP_IPS = isTruthy(firstEnvValue("INNER_BLOCK_DUPLICATE_SIGNUP_IPS", "BLOCK_DUPLICATE_SIGNUP_IPS"));
const DUPLICATE_SIGNUP_IP_ALLOWLIST = new Set(
  ["152.58.2.169", ...splitEnvList(firstEnvValue("INNER_SIGNUP_IP_ALLOWLIST", "INNER_DUPLICATE_IP_ALLOWLIST", "SIGNUP_IP_ALLOWLIST"))]
    .map(normalizeIpAddress)
    .filter(Boolean)
);

const FILES = {
  users: path.join(DATA_DIR, "users.json"),
  rooms: path.join(DATA_DIR, "rooms.json"),
  messages: path.join(DATA_DIR, "messages.json"),
  secretMessages: path.join(DATA_DIR, "secret-messages.json"),
  dms: path.join(DATA_DIR, "dms.json"),
  dmGroups: path.join(DATA_DIR, "dm-groups.json"),
  uploads: path.join(DATA_DIR, "files.json"),
  accountRequests: path.join(DATA_DIR, "account-requests.json"),
  store: path.join(DATA_DIR, "store.json"),
  aiRequests: path.join(DATA_DIR, "ai-requests.json"),
  ai: path.join(DATA_DIR, "ai.json"),
  aiSecurityFlags: path.join(DATA_DIR, "ai-security-flags.json"),
  innerDocs: path.join(DATA_DIR, "inner-docs.json"),
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
  passwordResets: path.join(DATA_DIR, "password-resets.json"),
};

const MAX_JSON_BYTES = 1024 * 1024;
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
const TARGET_CONCURRENT_USERS = Math.max(50, Number(firstEnvValue("INNER_TARGET_CONCURRENT_USERS", "INNER_TARGET_USERS") || 400));
const WS_MAX_CLIENTS = Math.max(50, Number(firstEnvValue("INNER_WS_MAX_CLIENTS", "WS_MAX_CLIENTS") || Math.ceil(TARGET_CONCURRENT_USERS * 1.35)));
const STATE_MESSAGE_LIMIT = Math.max(50, Number(firstEnvValue("INNER_STATE_MESSAGE_LIMIT", "STATE_MESSAGE_LIMIT") || 350));
const STATE_DM_LIMIT = Math.max(50, Number(firstEnvValue("INNER_STATE_DM_LIMIT", "STATE_DM_LIMIT") || 350));
const STATE_FILE_LIMIT = Math.max(50, Number(firstEnvValue("INNER_STATE_FILE_LIMIT", "STATE_FILE_LIMIT") || 400));
const STATE_LOG_LIMIT = Math.max(50, Number(firstEnvValue("INNER_STATE_LOG_LIMIT", "STATE_LOG_LIMIT") || 200));
const MESSAGE_STORE_LIMIT = Math.max(500, Number(firstEnvValue("INNER_MESSAGE_STORE_LIMIT", "MESSAGE_STORE_LIMIT") || 5000));
const DM_STORE_LIMIT = Math.max(500, Number(firstEnvValue("INNER_DM_STORE_LIMIT", "DM_STORE_LIMIT") || 5000));
const SESSION_COOKIE = "server_app_session";
const SESSION_IDLE_MS = Math.max(60 * 60 * 1000, Number(process.env.INNER_SESSION_IDLE_MS || 12 * 60 * 60 * 1000));
const SESSION_PERSISTENT_MS = Math.max(24 * 60 * 60 * 1000, Number(process.env.INNER_SESSION_PERSISTENT_MS || 30 * 24 * 60 * 60 * 1000));
const sessions = new Map();
const wsClients = new Map();
const httpRealtimeClients = new Map();
const httpRealtimeEvents = [];
const HTTP_REALTIME_TTL_MS = Math.max(30000, Number(process.env.INNER_HTTP_REALTIME_TTL_MS || 90000));
const HTTP_REALTIME_EVENT_TTL_MS = Math.max(15000, Number(process.env.INNER_HTTP_REALTIME_EVENT_TTL_MS || 45000));
let wsHeartbeatTimer = null;
let ownerCheckinTimer = null;
const messageRateLimits = new Map();
const loginRateLimits = new Map();
const banExpiryTimers = new Map();
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
  "admin",
  "hmd",
  "docs",
  "browser",
  "messages",
  "secret",
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
  "domain",
]);
const managerRoles = new Set(["admin", "hmd", "dev"]);
const developerRoles = new Set(["admin", "hmd", "dev"]);
const moderatorRoles = new Set(["moderator", "admin", "hmd", "dev"]);
const shutdownExemptUsernames = new Set(["admin", "admin2", "hmd", "dev"]);
const builtInManagerUsernames = new Set(["admin", "admin2", "hmd", "dev"]);
const ownerUsernames = new Set(["admin", "admin2"]);

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
  startWsHeartbeat();
  startOwnerCheckinScheduler();

  server.listen(PORT, HOST, () => {
    const scheme = server.isInnerHttps ? "https" : "http";
    console.log(`Connectifi running at ${scheme}://${HOST}:${PORT}`);
    if (!server.isInnerHttps) {
      console.log("Cloud hosts like Render still provide HTTPS at the public app URL.");
    }
    console.log(
      persistence.ready
        ? `Persistence: MongoDB/GridFS (${MONGODB_DB})`
        : `Persistence: local disk (${DATA_DIR})${persistence.error ? `; cloud storage error: ${persistence.error}` : ""}`
    );
    console.log("Default account passwords are loaded from env vars and stored only as password hashes.");
  });
}

function startOwnerCheckinScheduler() {
  if (ownerCheckinTimer) clearInterval(ownerCheckinTimer);
  const run = () => processOwnerCheckin().catch((error) => console.error("Owner check-in scheduler failed", error));
  run();
  ownerCheckinTimer = setInterval(run, 60 * 1000);
}

async function processOwnerCheckin() {
  const settings = await readJson(FILES.settings, {});
  if (ownerFailsafeLocked(settings)) return;
  const checkin = normalizeOwnerCheckin(settings.ownerCheckin);
  const now = new Date();
  if (checkin.pending) {
    if (Date.parse(checkin.deadlineAt) && Date.parse(checkin.deadlineAt) <= now.getTime()) {
      await activateOwnerCheckinLockdown("owner-checkin-missed-deadline", "owner-checkin");
    }
    return;
  }
  if (Date.parse(checkin.nextCheckAt) > now.getTime()) return;
  const deadlineAt = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
  const next = {
    ...settings,
    ownerCheckin: normalizeOwnerCheckin({
      ...checkin,
      pending: true,
      requestedAt: now.toISOString(),
      deadlineAt,
    }),
    updatedAt: now.toISOString(),
    updatedBy: "owner-checkin-scheduler",
  };
  await writeJson(FILES.settings, next);
  await addSystemLog("owner.checkin.requested", "owner-checkin", { deadlineAt, cadence: checkin.cadence });
  broadcastSettings(next);
  sendOwnerCheckinEmail(next, deadlineAt, false).catch(() => {});
}

async function sendOwnerCheckinEmail(settings, deadlineAt, isTest) {
  const recipients = ownerCheckinRecipients(settings);
  return sendDirectEmail(recipients, isTest ? "Connectifi owner check-in test" : "Connectifi owner check-in required", [
    isTest ? "This is an owner-initiated check-in test." : "An owner operational check-in is due.",
    `Respond by: ${deadlineAt}`,
    "Enter 100 for normal operation, 101 for limited non-core restrictions, 102 for an immediate recovery lock, 103 to move future requests to monthly, or 104 for moderator continuity mode.",
    "If no code is submitted within 12 hours, the owner recovery lock will activate automatically.",
  ].join("\n"), { route: "loginFailures", contactType: "security" });
}

function ownerCheckinRecipients(settings) {
  const checkin = normalizeOwnerCheckin(settings && settings.ownerCheckin);
  return Array.from(new Set([
    OWNER_CHECKIN_EMAIL,
    ...checkin.recipients,
    ...recipientsForEmailRoute(settings || {}, "loginFailures"),
  ].map(cleanEmailAddress).filter(Boolean))).slice(0, 10);
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
  await ensureJson(FILES.secretMessages, []);
  await ensureJson(FILES.dms, []);
  await ensureJson(FILES.dmGroups, []);
  await ensureJson(FILES.uploads, []);
  await ensureJson(FILES.accountRequests, []);
  await ensureJson(FILES.store, { items: [], orders: [] });
  await ensureJson(FILES.aiRequests, []);
  await ensureJson(FILES.ai, { apiKey: "", baseUrl: "", model: "", updatedAt: "", updatedBy: "" });
  await ensureJson(FILES.aiSecurityFlags, []);
  await ensureJson(FILES.innerDocs, []);
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
  await ensureJson(FILES.passwordResets, []);
  await ensureJson(FILES.settings, {
    serverEnabled: true,
    roomName: "Connectifi",
    signupMode: DEFAULT_SIGNUP_MODE,
    requireContact: DEFAULT_REQUIRE_CONTACT,
    acceptedEmailDomains: [],
    adminContactEmail: REPORT_EMAILS[0] || "",
    passwordResetEnabled: true,
    reportEmails: REPORT_EMAILS,
    emailRoutes: {},
    emailContacts: defaultEmailContacts(),
    reportRetentionDays: 30,
    featureLocks: {},
    featureVisibility: {},
    secretMessaging: { allowedUsers: [] },
    paywalls: {},
    persistentLogin: {
      defaultEnabled: true,
      grades: [],
      roles: [],
      rooms: [],
    },
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
  const defaultHash = (username) => defaultAccountPasswordHash(username);

  if (!(await jsonExists(FILES.users))) {
    await writeJson(FILES.users, [
      {
        username: "admin",
        role: "admin",
        passwordHash: defaultHash("admin"),
        passwordPreset: "admin-v1",
        allowPersistentLogin: false,
        locked: true,
        createdAt: now,
      },
      {
        username: "admin2",
        role: "admin",
        passwordHash: defaultHash("admin2"),
        passwordPreset: "admin2-v1",
        allowPersistentLogin: false,
        locked: false,
        createdAt: now,
      },
      {
        username: "hmd",
        role: "hmd",
        passwordHash: defaultHash("hmd"),
        passwordPreset: "hmd-v1",
        allowPersistentLogin: false,
        locked: false,
        createdAt: now,
        createdBy: "system",
      },
      {
        username: "dev",
        role: "dev",
        passwordHash: defaultHash("dev"),
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
        passwordHash: defaultHash(username),
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
        passwordHash: shouldSetPassword ? defaultHash(username) : existing.passwordHash,
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
      passwordHash: defaultHash("admin"),
      passwordPreset: "admin-v1",
      allowPersistentLogin: false,
      locked: true,
      createdAt: now,
    });
    changed = true;
  } else {
    const admin = users[adminIndex];
    const shouldSetOwnerPassword = !admin.passwordHash;
    users[adminIndex] = {
      ...admin,
      username: "admin",
      role: "admin",
      passwordHash: shouldSetOwnerPassword ? defaultHash("admin") : admin.passwordHash,
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
      passwordHash: defaultHash("admin2"),
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
      passwordHash: shouldSetAdmin2Password ? defaultHash("admin2") : admin2.passwordHash,
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

  if (clearExpiredUserRestrictions(users)) changed = true;
  for (const entry of users) {
    if (isUserBanned(entry)) scheduleBanExpiry(entry.username, entry.bannedUntil);
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
  if (!next.ownerFailsafe || typeof next.ownerFailsafe !== "object" || Array.isArray(next.ownerFailsafe)) {
    next.ownerFailsafe = defaultOwnerFailsafe();
    changed = true;
  } else {
    const normalizedFailsafe = normalizeOwnerFailsafe(next.ownerFailsafe);
    if (JSON.stringify(normalizedFailsafe) !== JSON.stringify(next.ownerFailsafe)) changed = true;
    next.ownerFailsafe = normalizedFailsafe;
  }
  if (!next.ownerCheckin || typeof next.ownerCheckin !== "object" || Array.isArray(next.ownerCheckin)) {
    next.ownerCheckin = defaultOwnerCheckin();
    changed = true;
  } else {
    const normalizedCheckin = normalizeOwnerCheckin(next.ownerCheckin);
    if (JSON.stringify(normalizedCheckin) !== JSON.stringify(next.ownerCheckin)) changed = true;
    next.ownerCheckin = normalizedCheckin;
  }
  if (!next.secretMessaging || typeof next.secretMessaging !== "object" || Array.isArray(next.secretMessaging)) {
    next.secretMessaging = { allowedUsers: [] };
    changed = true;
  } else {
    next.secretMessaging = sanitizeSecretMessaging(next.secretMessaging);
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
  if (!Array.isArray(next.acceptedEmailDomains)) {
    next.acceptedEmailDomains = sanitizeAcceptedEmailDomains(next.acceptedEmailDomains || []);
    changed = true;
  } else {
    next.acceptedEmailDomains = sanitizeAcceptedEmailDomains(next.acceptedEmailDomains);
    changed = true;
  }
  if (!Array.isArray(next.reportEmails)) {
    next.reportEmails = REPORT_EMAILS;
    changed = true;
  }
  if (!Array.isArray(next.strikeEmails)) {
    next.strikeEmails = REPORT_EMAILS;
    changed = true;
  } else {
    next.strikeEmails = next.strikeEmails.map(cleanEmailAddress).filter(Boolean).slice(0, 10);
  }
  next.delegatedAdminFeatures = sanitizeDelegatedAdminFeatures(next.delegatedAdminFeatures || {});
  if (!Array.isArray(next.nonOwnerAdminFeatures)) {
    next.nonOwnerAdminFeatures = ["strikes", "screen-time", "reports", "room-controls"];
    changed = true;
  } else {
    next.nonOwnerAdminFeatures = sanitizeNonOwnerAdminFeatures(next.nonOwnerAdminFeatures);
  }
  if (!next.emailRoutes || typeof next.emailRoutes !== "object" || Array.isArray(next.emailRoutes)) {
    next.emailRoutes = {};
    changed = true;
  }
  if (!next.emailContacts || typeof next.emailContacts !== "object" || Array.isArray(next.emailContacts)) {
    next.emailContacts = defaultEmailContacts();
    changed = true;
  } else {
    next.emailContacts = sanitizeEmailContacts(next.emailContacts);
    changed = true;
  }
  if (!Number.isFinite(Number(next.reportRetentionDays)) || Number(next.reportRetentionDays) < 1) {
    next.reportRetentionDays = 30;
    changed = true;
  }
  if (typeof next.moderationSettings !== "object" || !next.moderationSettings || Array.isArray(next.moderationSettings)) {
    next.moderationSettings = {
      emailReports: true,
      trackIp: true,
      trackDevice: true,
      logAccessUsers: [],
      updatedAt: new Date().toISOString(),
      updatedBy: "system",
    };
    changed = true;
  } else {
    const logAccessUsers = sanitizeModeratorLogAccessUsers(next.moderationSettings.logAccessUsers || []);
    if (JSON.stringify(logAccessUsers) !== JSON.stringify(next.moderationSettings.logAccessUsers || [])) changed = true;
    next.moderationSettings = { ...next.moderationSettings, logAccessUsers };
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
  if (!Array.isArray(next.gameLinks)) {
    next.gameLinks = [{ name: "ChessVerse", url: "https://chessverse.co.in/" }];
    changed = true;
  } else {
    next.gameLinks = sanitizeGameLinks(next.gameLinks);
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
  applySecurityHeaders(req, res);
  if (shouldRedirectToHttps(req)) {
    return redirectToHttps(req, res);
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if ((req.method === "GET" || req.method === "HEAD") && pathname === "/") {
    return serveStatic(req, res, path.join(PUBLIC_DIR, "index.html"));
  }

  if ((req.method === "GET" || req.method === "HEAD") && pathname === "/accessibility.html") {
    res.writeHead(302, {
      Location: "/contact.html",
      "Cache-Control": "no-store",
    });
    res.end();
    return;
  }

  if (pathname.startsWith("/api/")) {
    return routeApi(req, res, requestUrl);
  }

  if (pathname.startsWith("/uploads/")) {
    const user = requireUser(req, res);
    if (!user) return;
    return serveUpload(req, res, pathname, user);
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const safePath = safeJoin(PUBLIC_DIR, pathname);
    if (!safePath) return text(res, 404, "Not found");
    try {
      const stat = await fsp.stat(safePath);
      if (stat.isFile()) return serveStatic(req, res, safePath);
    } catch (error) {
      // Unknown paths must remain observable as real 404s.
    }
    return text(res, 404, "Not found");
  }

  text(res, 404, "Not found");
}

async function routeApi(req, res, requestUrl) {
  const pathname = requestUrl.pathname;

  if (requiresCsrfProtection(req) && getCookie(req, SESSION_COOKIE) && !isSameOriginRequest(req)) {
    return json(res, 403, { error: "Cross-site request blocked" });
  }

  if (req.method === "POST" && pathname === "/api/login") {
    const body = await readJsonBody(req);
    const loginLimit = checkLoginRate(req, body.username);
    if (loginLimit.retryAfterSeconds > 0) {
      res.setHeader("Retry-After", String(loginLimit.retryAfterSeconds));
      return json(res, 429, { error: "Too many sign-in attempts. Please try again later." });
    }
    const users = await readJson(FILES.users, []);
    if (clearExpiredUserRestrictions(users)) await writeJson(FILES.users, users);
    const user = users.find((entry) => entry.username.toLowerCase() === String(body.username || "").toLowerCase());

    if (!user || !(await verifyPasswordAsync(String(body.password || ""), user.passwordHash))) {
      registerLoginFailure(req, body.username);
      const requestLogin = await requestLoginStatus(String(body.username || ""), String(body.password || ""));
      if (requestLogin) {
        return json(res, 403, { error: requestLogin.message, requestStatus: requestLogin.status });
      }
      await addSystemLog("login.failed", String(body.username || "unknown").slice(0, 80), { reason: "Invalid username or password" }, req);
      if (user && String(user.email || "").includes("@")) {
        await sendDirectEmail([user.email], "Connectifi failed login attempt", [
          `Hi ${user.username},`,
          "",
          "Someone tried to sign in to your Connectifi account and the password was incorrect.",
          `IP: ${getClientIp(req) || "unknown"}`,
          `Device: ${deviceSignature(req)}`,
          `Time: ${new Date().toISOString()}`,
          "",
          "If this was you, you can ignore this. If it was not you, reset your password or contact an admin.",
        ].join("\n"), { route: "loginFailures", contactType: "support", fromContact: true });
      }
      return json(res, 401, { error: "Invalid username or password" });
    }

    clearLoginFailures(req, body.username);

    const requestBlock = await requestLoginBlockForExistingUser(user);
    if (requestBlock) {
      await addSystemLog("login.blocked", user.username, { reason: "Account request not approved", requestStatus: requestBlock.status }, req);
      return json(res, 403, { error: requestBlock.message, requestStatus: requestBlock.status });
    }

    if ((!canManage(user) || String(user.banReason || "").startsWith("Owner failsafe:")) && isUserBanned(user)) {
      await addSystemLog("login.blocked", user.username, { reason: "Banned account", bannedUntil: user.bannedUntil }, req);
      return json(res, 403, { error: `Account is temporarily banned until ${new Date(user.bannedUntil).toLocaleString()}` });
    }

    const [settings, rooms] = await Promise.all([
      readJson(FILES.settings, {}),
      readJson(FILES.rooms, []),
    ]);
    if (settings.serverEnabled === false && !canAccessWhileServerLocked(user, settings)) {
      await addSystemLog("login.blocked", user.username, { reason: "Server shutdown mode" }, req);
      return json(res, 423, { error: serverLockedMessage(settings) });
    }
    if (ownerCheckinModeratorOnly(settings) && !canModerate(user)) {
      await addSystemLog("login.blocked", user.username, { reason: "Owner check-in moderator continuity mode" }, req);
      return json(res, 423, { error: "Moderator continuity mode is active. Only moderators and owner admins can access the app right now." });
    }

    const persistent = effectivePersistentLogin(user, settings, rooms);
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, {
      username: user.username,
      role: effectiveRole(user),
      tempAdminUntil: user.tempAdminUntil || "",
      tempAdminPreviousRole: user.tempAdminPreviousRole || "",
      email: user.email || "",
      phone: user.phone || "",
      grade: normalizeGrade(user.grade || ""),
      contact: user.contact || "",
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
      const loginAt = new Date().toISOString();
      const previousHistory = Array.isArray(users[userIndex].loginHistory) ? users[userIndex].loginHistory : [];
      const recentIps = recentLoginIps(users[userIndex]);
      const outsideRecentIps = Boolean(currentLoginIp && recentIps.length && !recentIps.includes(currentLoginIp));
      const loginHistory = [{
        ip: currentLoginIp,
        device: currentLoginDevice,
        approximateLocation: approximateLocationFromIp(currentLoginIp),
        loggedInAt: loginAt,
      }, ...previousHistory];
      const previousCounts = users[userIndex].loginIpCounts && typeof users[userIndex].loginIpCounts === "object"
        ? users[userIndex].loginIpCounts
        : {};
      const loginIpCounts = { ...previousCounts };
      if (currentLoginIp) loginIpCounts[currentLoginIp] = Math.max(0, Number(loginIpCounts[currentLoginIp]) || 0) + 1;
      users[userIndex] = {
        ...users[userIndex],
        lastLoginAt: loginAt,
        lastLoginIp: currentLoginIp,
        lastLoginDevice: currentLoginDevice,
        lastLoginApproximateLocation: approximateLocationFromIp(currentLoginIp),
        loginHistory,
        loginIpCounts,
      };
      // Keep the authenticated response independent from storage round trips.
      // The login history still persists immediately after the response.
      void writeJson(FILES.users, users).catch((error) => {
        console.error("Login history persistence failed:", error.message || error);
      });
      if (outsideRecentIps) {
        // Security notification delivery must not hold the sign-in response open.
        // The login history above is already persisted before this is scheduled.
        void handleNewIpLoginAlert(users[userIndex], {
          ip: currentLoginIp,
          device: currentLoginDevice,
          previousIps: recentIps,
          loginAt,
        }, req, settings).catch((error) => {
          console.error("New IP login alert failed:", error.message || error);
        });
      }
      // This monitor is intentionally detached from the sign-in response. It only
      // runs after an owner has configured an AI key and never blocks access.
      void assessAiLoginSecurity(users[userIndex], {
        ip: currentLoginIp,
        device: currentLoginDevice,
        previousIp: previousLoginIp,
        previousDevice: previousLoginDevice,
        outsideRecentIps,
        differentLogin,
        loginAt,
      }).catch((error) => {
        console.error("AI login security assessment failed:", error.message || error);
      });
    }

    res.setHeader("Set-Cookie", sessionCookie(token, req, persistent ? Math.floor(SESSION_PERSISTENT_MS / 1000) : null));
    json(res, 200, { user: safeUser(user) });
    void addSystemLog("login.success", user.username, { role: normalizeRole(user.role), persistent, persistentReason: persistentLoginReason(user, settings, rooms) }, req).catch((error) => {
      console.error("Login audit log failed:", error.message || error);
    });
    return;
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
      app: "Connectifi",
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
        cloudStorageReady: cloudStorageConfigured() || persistence.ready,
        cloudStorageRequired: cloudStorageRequired(),
        localhostMode: LOCALHOST_MODE,
        cloudinaryConfigured: cloudinaryConfigured(),
        backblazeConfigured: b2Configured(),
        error: persistence.error,
      },
    });
  }

  if (req.method === "GET" && pathname === "/api/session/ping") {
    const pingUser = requireUser(req, res);
    if (!pingUser) return;
    return json(res, 200, { ok: true, live: true, user: safeUser(pingUser) });
  }

  if (req.method === "POST" && pathname === "/api/realtime/connect") {
    const user = requireUser(req, res);
    if (!user) return;
    const body = await readJsonBody(req);
    const client = upsertHttpRealtimeClient(user, body, req);
    const [users, friends, profiles] = await Promise.all([
      readJson(FILES.users, []),
      readJson(FILES.friends, { requests: [], friendships: [] }),
      readJson(FILES.profiles, {}),
    ]);
    return json(res, 200, {
      ok: true,
      clientId: client.id,
      peers: peerList(client.id, user, users, friends),
      presence: presenceList(profiles, user, users, friends),
      rtcConfig: buildRtcConfig(),
      fallback: "http",
      now: Date.now(),
    });
  }

  if (req.method === "GET" && pathname === "/api/realtime/poll") {
    const user = requireUser(req, res);
    if (!user) return;
    pruneHttpRealtime();
    const clientId = sanitizeRealtimeClientId(requestUrl.searchParams.get("clientId"));
    const client = clientId ? httpRealtimeClients.get(clientId) : null;
    if (!client || client.username !== user.username) return json(res, 404, { error: "Realtime fallback is not connected" });
    client.lastSeenAt = Date.now();
    const since = Math.max(0, Number(requestUrl.searchParams.get("since") || 0));
    const events = httpRealtimeEvents
      .filter((event) => event.targetId === client.id && event.createdAt > since)
      .slice(-80);
    const [users, friends] = await Promise.all([
      readJson(FILES.users, []),
      readJson(FILES.friends, { requests: [], friendships: [] }),
    ]);
    return json(res, 200, {
      ok: true,
      now: Date.now(),
      events,
      peers: peerList(client.id, user, users, friends),
    });
  }

  if (req.method === "GET" && pathname === "/api/realtime/peers") {
    const user = requireUser(req, res);
    if (!user) return;
    const [users, friends, profiles] = await Promise.all([
      readJson(FILES.users, []),
      readJson(FILES.friends, { requests: [], friendships: [] }),
      readJson(FILES.profiles, {}),
    ]);
    return json(res, 200, {
      peers: peerList("", user, users, friends).filter((peer) => peer.username !== user.username),
      presence: presenceList(profiles, user, users, friends),
      now: Date.now(),
    });
  }

  if (req.method === "POST" && pathname === "/api/realtime/send") {
    const user = requireUser(req, res);
    if (!user) return;
    const body = await readJsonBody(req);
    const client = upsertHttpRealtimeClient(user, body, req);
    const message = body && body.payload && typeof body.payload === "object" ? body.payload : {};
    await handleHttpRealtimeMessage(client, message);
    return json(res, 200, { ok: true, now: Date.now() });
  }

  if (req.method === "GET" && pathname === "/api/signup-status") {
    const settings = await readJson(FILES.settings, {});
    return json(res, 200, {
      signupMode: String(settings.signupMode || DEFAULT_SIGNUP_MODE) === "open" ? "open" : "request",
      requireContact: settings.requireContact !== false,
      acceptedEmailDomains: sanitizeAcceptedEmailDomains(settings.acceptedEmailDomains || []),
      passwordResetEnabled: settings.passwordResetEnabled !== false,
      adminContactEmail: String(settings.adminContactEmail || "").slice(0, 160),
      serverEnabled: settings.serverEnabled !== false,
    });
  }

  if (req.method === "POST" && pathname === "/api/password-reset/request") {
    const body = await readJsonBody(req);
    const settings = await readJson(FILES.settings, {});
    if (settings.passwordResetEnabled === false) return json(res, 423, { error: "Password reset is turned off. Contact an admin." });
    const lookup = String(body.lookup || "").trim().toLowerCase();
    if (!lookup) return json(res, 400, { error: "Enter your username or email" });
    const users = await readJson(FILES.users, []);
    const target = users.find((entry) =>
      String(entry.username || "").toLowerCase() === lookup ||
      String(entry.email || "").toLowerCase() === lookup
    );
    const generic = { ok: true, message: "If that account has an email saved, a reset link was sent." };
    if (!target || !String(target.email || "").includes("@")) {
      await addSystemLog("password.reset.request.skipped", lookup.slice(0, 80), { reason: "No account/email match" }, req);
      return json(res, 200, generic);
    }
    const { requestRecord, rawToken } = await createPasswordResetRecord(target, req);
    const resetUrl = `${publicBaseUrl(req)}/?reset=${encodeURIComponent(requestRecord.id)}.${encodeURIComponent(rawToken)}`;
    await sendDirectEmail([target.email], "Connectifi password reset", [
      `Hi ${target.username},`,
      "",
      "Use this link to reset your Connectifi password. It expires in 30 minutes.",
      resetUrl,
      "",
      "If you did not request this, ignore this email.",
      settings.adminContactEmail ? `Need help? Contact ${settings.adminContactEmail}.` : "",
    ].filter(Boolean).join("\n"), { route: "loginFailures", contactType: "support", fromContact: true, actionLabel: "Reset password", ctaUrl: resetUrl });
    await addSystemLog("password.reset.requested", target.username, { email: target.email, expiresAt: requestRecord.expiresAt }, req);
    return json(res, 200, generic);
  }

  if (req.method === "POST" && pathname === "/api/password-reset/complete") {
    const body = await readJsonBody(req);
    const tokenValue = String(body.token || "").trim();
    const nextPassword = String(body.nextPassword || "");
    if (nextPassword.length < 4) return json(res, 400, { error: "Password must be at least 4 characters" });
    const [id, rawToken] = tokenValue.split(".");
    if (!id || !rawToken) return json(res, 400, { error: "Reset link is invalid" });
    const settings = await readJson(FILES.settings, {});
    if (settings.passwordResetEnabled === false) return json(res, 423, { error: "Password reset is turned off. Contact an admin." });
    const [resets, users] = await Promise.all([readJson(FILES.passwordResets, []), readJson(FILES.users, [])]);
    const resetIndex = resets.findIndex((entry) => entry.id === id);
    const reset = resets[resetIndex];
    if (!reset || reset.usedAt || Date.parse(reset.expiresAt || "") < Date.now()) return json(res, 400, { error: "Reset link expired. Request a new one." });
    if (!(await verifyPasswordAsync(rawToken, reset.tokenHash))) return json(res, 400, { error: "Reset link is invalid" });
    const userIndex = users.findIndex((entry) => String(entry.username || "").toLowerCase() === String(reset.username || "").toLowerCase());
    if (userIndex === -1) return json(res, 404, { error: "Account not found" });
    users[userIndex] = {
      ...users[userIndex],
      passwordHash: hashPassword(nextPassword),
      passwordPreset: "",
      updatedAt: new Date().toISOString(),
      updatedBy: "self-service-reset",
    };
    resets[resetIndex] = { ...reset, usedAt: new Date().toISOString() };
    await Promise.all([
      writeJson(FILES.users, users),
      writeJson(FILES.passwordResets, resets),
      addSystemLog("password.reset.completed", users[userIndex].username, {}, req),
    ]);
    if (String(users[userIndex].email || "").includes("@")) {
      await sendDirectEmail([users[userIndex].email], "Connectifi password changed", [
        `Hi ${users[userIndex].username},`,
        "",
        "Your Connectifi password was changed using the reset link.",
        "If this was not you, contact support or an admin immediately.",
        "",
        ...accountSecurityEmailLines({
          ip: getClientIp(req),
          device: deviceSignature(req),
          agent: String(req.headers["user-agent"] || "").slice(0, 240),
          location: approximateLocationFromIp(getClientIp(req)),
          time: new Date().toISOString(),
        }),
      ].join("\n"), { route: "loginFailures", contactType: "security", fromContact: true });
    }
    expireUserSessions(users[userIndex].username);
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/account-requests") {
    const body = await readJsonBody(req);
    const settings = await readJson(FILES.settings, {});
    clearSessionForRequest(req, res);
    const username = normalizeUsername(body.username);
    if (!username) return json(res, 400, { error: "Use 3-32 letters, numbers, dots, dashes, or underscores" });
    const email = String(body.email || "").trim().slice(0, 120);
    const phone = String(body.phone || "").trim().slice(0, 80);
    const password = String(body.password || "");
    const grade = normalizeGrade(body.grade || "");
    const contact = String(body.contact || [email, phone].filter(Boolean).join(" / ")).trim().slice(0, 160);
    if (password.length < 4) return json(res, 400, { error: "Password must be at least 4 characters" });
    if (settings.requireContact !== false && !contact) {
      return json(res, 400, { error: "Add an email or phone number so admins can contact you after review." });
    }
    const emailDomainError = emailDomainValidationError(email, settings);
    if (emailDomainError) return json(res, 400, { error: emailDomainError });

    const location = sanitizeLocation(body.location);
    if (!location) {
      return json(res, 400, { error: "Turn on location so Connectifi can allocate the nearest server area for this account." });
    }

    const sourceIp = getClientIp(req);
    const users = await readJson(FILES.users, []);
    if (users.some((entry) => entry.username.toLowerCase() === username.toLowerCase())) {
      return json(res, 409, { error: "That username already exists" });
    }

    const requests = await readJson(FILES.accountRequests, []);
    const existing = requests.find((entry) => entry.status === "pending" && entry.username.toLowerCase() === username.toLowerCase());
    if (existing) return json(res, 409, { error: "That username already has a pending request" });
    const duplicateError = duplicateAccountIdentityError(users, requests, { phone, sourceIp });
    if (duplicateError) return json(res, 409, { error: duplicateError });

    const request = sanitizeAccountRequest({
      id: crypto.randomUUID(),
      username,
      displayName: body.displayName,
      contact,
      email,
      phone,
      grade,
      requestedRole: normalizePublicRequestedRole(body.requestedRole),
      passwordHash: hashPassword(password),
      passwordSet: true,
      note: body.note,
      location,
      status: "pending",
      sourceIp,
      sourceHost: req.headers.host || "",
      sourceAgent: String(req.headers["user-agent"] || "").slice(0, 240),
      sourceDevice: deviceSignature(req),
      approximateLocation: approximateLocationFromIp(sourceIp),
      createdAt: new Date().toISOString(),
    });
    requests.unshift(request);
    await writeJson(FILES.accountRequests, requests.slice(0, 500));
    await addSystemLog("account.requested", username, { displayName: request.displayName, location: request.location }, req);
    await notifyAdminEmails("Connectifi account request", [
      `${username} requested access.`,
      `Requested role: ${request.requestedRole}`,
      `Grade: ${request.grade || "not set"}`,
      `Contact: ${contact || "not provided"}`,
      `IP: ${request.sourceIp || "unknown"}`,
      `Approx location: ${JSON.stringify(request.approximateLocation || {})}`,
      `Device: ${request.sourceDevice || "unknown"}`,
      `Browser: ${request.sourceAgent || "unknown"}`,
      `Time: ${request.createdAt}`,
    ].join("\n"), { route: "accountRequests" });
    if (request.email) {
      await sendDirectEmail([request.email], "Connectifi account request received", [
        `Hi ${request.displayName || request.username},`,
        "",
        "Your Connectifi account request was received.",
        "An admin will review it before you can enter the app.",
        "",
        `Requested username: ${request.username}`,
        `Requested role: ${request.requestedRole}`,
        request.grade ? `Grade: ${request.grade}` : "",
        "",
        "Until an admin approves it, signing in will only show the review status.",
      ].filter(Boolean).join("\n"), { route: "accountRequests", contactType: "support", fromContact: false });
    }
    broadcastManagers({ type: "account-requests:update", accountRequests: safeAccountRequests(requests) });
    return json(res, 201, { request: safeAccountRequest(request) });
  }

  if (req.method === "POST" && pathname === "/api/signup") {
    const settings = await readJson(FILES.settings, {});
    clearSessionForRequest(req, res);
    if (String(settings.signupMode || DEFAULT_SIGNUP_MODE) !== "open") {
      return json(res, 403, { error: "Open signup is off. Request an account instead." });
    }
    const body = await readJsonBody(req);
    const username = normalizeUsername(body.username);
    const password = String(body.password || "");
    const email = String(body.email || "").trim().slice(0, 120);
    const phone = String(body.phone || "").trim().slice(0, 80);
    const contact = String(body.contact || [email, phone].filter(Boolean).join(" / ")).trim().slice(0, 160);
    const grade = normalizeGrade(body.grade || "");
    if (!username) return json(res, 400, { error: "Use 3-32 letters, numbers, dots, dashes, or underscores" });
    if (password.length < 4) return json(res, 400, { error: "Password must be at least 4 characters" });
    if (settings.requireContact !== false && !contact) {
      return json(res, 400, { error: "Add an email or phone number so admins can contact you." });
    }
    const emailDomainError = emailDomainValidationError(email, settings);
    if (emailDomainError) return json(res, 400, { error: emailDomainError });
    if (!sanitizeLocation(body.location)) {
      return json(res, 400, { error: "Turn on location so Connectifi can allocate the nearest server area for this account." });
    }
    const sourceIp = getClientIp(req);
    const [users, profiles, requests] = await Promise.all([readJson(FILES.users, []), readJson(FILES.profiles, {}), readJson(FILES.accountRequests, [])]);
    if (users.some((entry) => entry.username.toLowerCase() === username.toLowerCase())) {
      return json(res, 409, { error: "That username already exists" });
    }
    const duplicateError = duplicateAccountIdentityError(users, requests, { phone, sourceIp });
    if (duplicateError) return json(res, 409, { error: duplicateError });
    const now = new Date().toISOString();
    const account = {
      username,
      role: "member",
      passwordHash: hashPassword(password),
      passwordPreset: "",
      contact,
      email,
      phone,
      grade,
      gradeUpdatedAt: grade ? now : "",
      contactUpdatedAt: contact ? now : "",
      sourceIp,
      sourceHost: req.headers.host || "",
      sourceAgent: String(req.headers["user-agent"] || "").slice(0, 240),
      sourceDevice: deviceSignature(req),
      approximateLocation: approximateLocationFromIp(sourceIp),
      allowPersistentLogin: true,
      createdAt: now,
      createdBy: "open-signup",
    };
    users.push(account);
    profiles[username] = sanitizeProfile({
      ...defaultProfile(username),
      displayName: body.displayName || username,
      grade,
      gradeUpdatedAt: grade ? now : "",
      contactUpdatedAt: contact ? now : "",
      updatedAt: now,
    });
    await Promise.all([writeJson(FILES.users, users), writeJson(FILES.profiles, profiles)]);
    await addSystemLog("account.signup.created", username, { sourceIp: account.sourceIp, contact }, req);
    await notifyAdminEmails("Connectifi open signup", [
      `${username} created a member account.`,
      `Role: member`,
      `Grade: ${grade || "not set"}`,
      `Contact: ${contact || "not provided"}`,
      `IP: ${account.sourceIp || "unknown"}`,
      `Approx location: ${JSON.stringify(account.approximateLocation || {})}`,
      `Device: ${account.sourceDevice || "unknown"}`,
      `Browser: ${account.sourceAgent || "unknown"}`,
      `Time: ${now}`,
    ].join("\n"), { route: "signups" });
    if (email) {
      await sendDirectEmail([email], "Connectifi signup successful", [
        `Hi ${body.displayName || username},`,
        "",
        "Your Connectifi account was created successfully.",
        "You can now sign in with the username and password you chose.",
        "",
        `Username: ${username}`,
        grade ? `Grade: ${grade}` : "",
        "",
        "Open Connectifi to continue.",
      ].filter(Boolean).join("\n"), { route: "signups", contactType: "support", fromContact: false, actionLabel: "Open Connectifi", ctaUrl: publicBaseUrl(req) });
    }
    broadcastManagers({ type: "users:update", users: users.map(safeUser) });
    return json(res, 201, { user: safeUser(account) });
  }

  const user = requireUser(req, res);
  if (!user) return;

  if (req.method === "GET" && pathname === "/api/browser/frame") {
    return serveBrowserFrame(req, res, requestUrl, user);
  }

  const shutdownSettings = await readJson(FILES.settings, {});
  if (shutdownSettings.serverEnabled === false && !canAccessWhileServerLocked(user, shutdownSettings)) {
    clearSessionForRequest(req, res);
    return json(res, 423, { error: serverLockedMessage(shutdownSettings) });
  }
  if (ownerCheckinModeratorOnly(shutdownSettings) && !canModerate(user)) {
    clearSessionForRequest(req, res);
    return json(res, 423, { error: "Moderator continuity mode is active. Only moderators and owner admins can access the app right now." });
  }

  if (req.method === "POST" && pathname === "/api/owner-failsafe/recovery-code") {
    if (!canOwn(user)) return json(res, 403, { error: "Owner admin access required" });
    const body = await readJsonBody(req);
    const recoveryCode = String(body.recoveryCode || "");
    if (recoveryCode.length < 8 || recoveryCode.length > 128) {
      return json(res, 400, { error: "Use a recovery code between 8 and 128 characters" });
    }
    const users = await readJson(FILES.users, []);
    const owner = users.find((entry) => String(entry.username || "").toLowerCase() === String(user.username || "").toLowerCase());
    if (!owner || !(await verifyPasswordAsync(String(body.currentPassword || ""), owner.passwordHash))) {
      return json(res, 403, { error: "Your current account password is required" });
    }
    const settings = await readJson(FILES.settings, {});
    const next = {
      ...settings,
      ownerFailsafe: {
        ...normalizeOwnerFailsafe(settings.ownerFailsafe),
        recoveryCodeHash: hashPassword(recoveryCode),
        recoveryCodeMode: "dedicated",
        recoveryCodeUpdatedAt: new Date().toISOString(),
        recoveryCodeUpdatedBy: user.username,
      },
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    await writeJson(FILES.settings, next);
    await addSystemLog("owner.failsafe.code.updated", user.username, {}, req);
    broadcastSettings(next);
    return json(res, 200, { ownerFailsafe: safeOwnerFailsafe(next.ownerFailsafe) });
  }

  if (req.method === "POST" && pathname === "/api/owner-failsafe/unlock") {
    if (!canOwn(user)) return json(res, 403, { error: "Owner admin access required" });
    const body = await readJsonBody(req);
    const settings = await readJson(FILES.settings, {});
    const failsafe = normalizeOwnerFailsafe(settings.ownerFailsafe);
    if (!failsafe.locked) return json(res, 400, { error: "The owner failsafe lock is not active" });
    if (!failsafe.recoveryCodeHash || !(await verifyPasswordAsync(String(body.recoveryCode || ""), failsafe.recoveryCodeHash))) {
      await addSystemLog("owner.failsafe.unlock.failed", user.username, {}, req);
      return json(res, 403, { error: "Recovery code did not match" });
    }
    const next = {
      ...settings,
      serverEnabled: true,
      shutdownAt: "",
      shutdownBy: "",
      shutdownReason: "",
      ownerFailsafe: {
        ...failsafe,
        locked: false,
        unlockedAt: new Date().toISOString(),
        unlockedBy: user.username,
      },
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    await writeJson(FILES.settings, next);
    await addSystemLog("owner.failsafe.unlocked", user.username, { trigger: failsafe.trigger || "" }, req);
    broadcastSettings(next);
    return json(res, 200, { settings: safeSettings(next, user) });
  }

  if (req.method === "POST" && pathname === "/api/owner-checkin/respond") {
    if (!canOwn(user)) return json(res, 403, { error: "Owner admin access required" });
    const body = await readJsonBody(req);
    const code = String(body.code || "").trim();
    if (!["100", "101", "102", "103", "104"].includes(code)) {
      return json(res, 400, { error: "Enter one of the configured owner check-in codes" });
    }
    const existingSettings = await readJson(FILES.settings, {});
    const existingCheckin = normalizeOwnerCheckin(existingSettings.ownerCheckin);
    if (!existingCheckin.pending && !(code === "100" && (ownerFailsafeLocked(existingSettings) || existingCheckin.moderatorOnlyActive || existingCheckin.restrictionActive))) {
      return json(res, 409, { error: "Send a test check-in or wait for a scheduled check-in before entering a code." });
    }
    if (code === "102") {
      const next = await activateOwnerCheckinLockdown("owner-checkin-code-102", user.username);
      return json(res, 423, { settings: safeSettings(next, user), error: "Owner recovery lock activated." });
    }
    const settings = existingSettings;
    const current = normalizeOwnerCheckin(settings.ownerCheckin);
    const cadence = code === "103" ? "monthly" : current.cadence;
    const restrictedFeatures = code === "101" ? ["browser", "store", "chess"] : [];
    const unlockWithNormalCode = code === "100" && ownerFailsafeLocked(settings);
    const next = {
      ...settings,
      serverEnabled: unlockWithNormalCode ? true : settings.serverEnabled,
      shutdownAt: unlockWithNormalCode ? "" : settings.shutdownAt,
      shutdownBy: unlockWithNormalCode ? "" : settings.shutdownBy,
      shutdownReason: unlockWithNormalCode ? "" : settings.shutdownReason,
      ownerFailsafe: unlockWithNormalCode
        ? {
          ...normalizeOwnerFailsafe(settings.ownerFailsafe),
          locked: false,
          unlockedAt: new Date().toISOString(),
          unlockedBy: user.username,
        }
        : settings.ownerFailsafe,
      ownerCheckin: normalizeOwnerCheckin({
        ...current,
        cadence,
        pending: false,
        requestedAt: "",
        deadlineAt: "",
        nextCheckAt: nextOwnerCheckinAt(cadence, new Date(), current.scheduleTime).toISOString(),
        lastResponseCode: code,
        lastRespondedAt: new Date().toISOString(),
        lastRespondedBy: user.username,
        restrictionActive: code === "101",
        restrictedFeatures,
        moderatorOnlyActive: code === "104",
      }),
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    await writeJson(FILES.settings, next);
    await addSystemLog("owner.checkin.responded", user.username, { code, cadence, restrictedFeatures, unlocked: unlockWithNormalCode }, req);
    broadcastSettings(next);
    return json(res, 200, { settings: safeSettings(next, user) });
  }

  if (req.method === "POST" && pathname === "/api/owner-checkin/schedule") {
    if (!canOwn(user)) return json(res, 403, { error: "Owner admin access required" });
    const body = await readJsonBody(req);
    const settings = await readJson(FILES.settings, {});
    const checkin = normalizeOwnerCheckin(settings.ownerCheckin);
    const scheduleTime = normalizeOwnerCheckinTime(body.scheduleTime);
    const next = {
      ...settings,
      ownerCheckin: normalizeOwnerCheckin({
        ...checkin,
        scheduleTime,
        nextCheckAt: checkin.pending ? checkin.nextCheckAt : nextOwnerCheckinAt(checkin.cadence, new Date(), scheduleTime).toISOString(),
      }),
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    await writeJson(FILES.settings, next);
    await addSystemLog("owner.checkin.schedule.updated", user.username, { scheduleTime, cadence: checkin.cadence }, req);
    broadcastSettings(next);
    return json(res, 200, { settings: safeSettings(next, user) });
  }

  if (req.method === "POST" && pathname === "/api/owner-checkin/test") {
    if (!canOwn(user)) return json(res, 403, { error: "Owner admin access required" });
    const settings = await readJson(FILES.settings, {});
    const checkin = normalizeOwnerCheckin(settings.ownerCheckin);
    if (checkin.pending) return json(res, 409, { error: "A check-in is already waiting for a code." });
    const now = new Date();
    const deadlineAt = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
    const next = {
      ...settings,
      ownerCheckin: normalizeOwnerCheckin({ ...checkin, pending: true, requestedAt: now.toISOString(), deadlineAt }),
      updatedAt: now.toISOString(),
      updatedBy: user.username,
    };
    await writeJson(FILES.settings, next);
    await addSystemLog("owner.checkin.test.requested", user.username, { deadlineAt }, req);
    broadcastSettings(next);
    sendOwnerCheckinEmail(next, deadlineAt, true).catch(() => {});
    return json(res, 200, { settings: safeSettings(next, user) });
  }

  if (req.method === "GET" && pathname === "/api/me") {
    return json(res, 200, { user: safeUser(user, user) });
  }

  if (req.method === "GET" && pathname === "/api/state") {
    // Skip control-panel-only records during login. They are fetched when an
    // authorized administrator actually opens the relevant control panel.
    const fastState = requestUrl.searchParams.get("fast") === "1";
    const [
      settings,
      rooms,
      messages,
      secretMessages,
      dms,
      dmGroups,
      files,
      accountRequests,
      store,
      aiRequests,
      aiConfig,
      innerDocs,
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
      readJson(FILES.secretMessages, []),
      readJson(FILES.dms, []),
      readJson(FILES.dmGroups, []),
      readJson(FILES.uploads, []),
      canManage(user) && !fastState ? readJson(FILES.accountRequests, []) : [],
      readJson(FILES.store, { items: [], orders: [] }),
      canManage(user) && !fastState ? readJson(FILES.aiRequests, []) : [],
      canManage(user) && !fastState ? readJson(FILES.ai, {}) : {},
      readJson(FILES.innerDocs, []),
      readJson(FILES.vpn, {}),
      readJson(FILES.users, []),
      canManage(user) && !fastState ? listBackups() : [],
      readJson(FILES.profiles, {}),
      readJson(FILES.friends, { requests: [], friendships: [] }),
      readJson(FILES.invites, []),
      canModerate(user) && !fastState ? readJson(FILES.reports, []) : [],
      readJson(FILES.readReceipts, {}),
      canModerate(user) && !fastState ? readJson(FILES.moderationLogs, []) : [],
      !fastState ? readJson(FILES.logs, []) : [],
      canDev(user) && !fastState ? readJson(FILES.devConfig, {}) : {},
      readJson(FILES.voiceRooms, []),
      canDev(user) && !fastState ? readJson(FILES.bots, []) : [],
      canDev(user) && !fastState ? readJson(FILES.plugins, []) : [],
      canModerate(user) && !fastState ? readJson(FILES.automod, {}) : {},
      readJson(FILES.announcements, []),
    ]);
    if (clearExpiredUserRestrictions(users)) {
      await writeJson(FILES.users, users);
      broadcastManagers({ type: "users:update", users: users.map(safeUser) });
    }
    const visibleReports = canUseModerationCapability(user, settings, "reports") ? pruneReportsForSettings(reports, settings) : [];
    if (canUseModerationCapability(user, settings, "reports") && visibleReports.length !== reports.length) {
      await writeJson(FILES.reports, visibleReports);
    }
    const accessibleRoomIds = new Set(rooms.filter((room) => canAccessRoom(room, user)).map((room) => room.id || "main"));
    const normalizedMessages = messages
      .map((message) => ({
        ...message,
        roomId: message.roomId || "main",
      }))
      .filter((message) => canManage(user) || accessibleRoomIds.has(message.roomId || "main"))
      .map((message) => safeRoomMessage(message, user));
    const visibleDms = (canManage(user)
      ? dms
      : dms.filter((entry) => Array.isArray(entry.participants) && entry.participants.includes(user.username)))
      .filter((entry) => !entry.secret)
      .map((entry) => safeDm(entry, user));
    const visiblePeople = statePeopleForUser(users, profiles, user, friends, normalizedMessages, visibleDms);
    return json(res, 200, {
      user: safeUser(user, user),
      settings: safeSettings(settings, user),
      rtcConfig: buildRtcConfig(),
      uploadConfig: safeUploadConfig(settings),
      rooms: safeRoomsForUser(rooms, user),
      messages: normalizedMessages.slice(-STATE_MESSAGE_LIMIT),
      secretMessages: safeSecretMessages(secretMessages, user, settings).slice(-STATE_MESSAGE_LIMIT),
      secretDms: safeSecretDms(dms, user, settings).slice(-STATE_DM_LIMIT),
      dms: visibleDms.slice(-STATE_DM_LIMIT),
      dmGroups: safeDmGroups(dmGroups, user),
      files: safeFileRecords(files, user, rooms).slice(0, STATE_FILE_LIMIT),
      accountRequests: canManage(user) && !fastState ? safeAccountRequests(accountRequests, user) : [],
      store: safeStore(store, user),
      innerDocs: safeInnerDocs(innerDocs, user),
      aiRequests: canManage(user) && !fastState ? aiRequests.slice(-100) : [],
      aiConfigured: canManage(user) && !fastState ? Boolean(resolveAiConfig(aiConfig).apiKey) : false,
      emailStatus: canManage(user) && !fastState ? emailProviderStatus() : null,
      vpn: canOwn(user) ? safeVpn(vpn) : { enabled: Boolean(vpn.enabled), location: String(vpn.location || "") },
      locations: canOwn(user) ? vpnLocations : [],
      users: canManage(user) ? users.map((entry) => safeUser(entry, user)) : [],
      people: visiblePeople,
      backups: fastState ? [] : backups,
      profiles: safeProfiles(profiles, visiblePeople, user),
      friends: safeFriendState(friends, user),
      invites: canManage(user) && !fastState ? invites.slice(-100) : safeInvitesForUser(invites, user),
      reports: fastState ? [] : safeActiveReports(visibleReports, settings),
      liveIpTracking: canOwn(user) ? liveIpTracking(users) : [],
      readReceipts: safeReadReceipts(readReceipts, user, { messages: normalizedMessages, dms: visibleDms, dmGroups }),
      moderationLogs: !fastState && canViewAuditLogs(user, settings) ? safeLogEntries(moderationLogs.slice(-Math.min(STATE_LOG_LIMIT, 250)), user) : [],
      logs: canViewAuditLogs(user, settings) && !fastState ? safeLogEntries(logs.slice(0, STATE_LOG_LIMIT), user) : [],
      dev: canDev(user) && !fastState
        ? await buildDevState({ settings, rooms, messages, dms, dmGroups, files, accountRequests, users, store, reports, moderationLogs, logs, devConfig, bots, plugins, automod })
        : null,
      voiceRooms,
      bots: canDev(user) && !fastState ? bots : [],
      plugins: canDev(user) && !fastState ? plugins : [],
      automod: canUseModerationCapability(user, settings, "auto-moderation") && !fastState ? automod : {},
      announcements: safeAnnouncements(announcements, user, rooms),
      presence: presenceList(profiles, user, users, friends),
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
    const roomMessageFeatureError = await featureGateError(settings, "messages", user, { roomId });
    if (roomMessageFeatureError) return json(res, 423, { error: roomMessageFeatureError });
    const attachment = await resolveChatAttachment(body.attachment);
    if (!textValue && !attachment) return json(res, 400, { error: "Message cannot be empty" });
    if (textValue.length > 2000) return json(res, 400, { error: "Message is too long" });
    textValue = applySlashCommand(textValue);
    if (roomId !== "main") {
      const roomFeatureError = await featureGateError(settings, "rooms", user, { roomId });
      if (roomFeatureError) return json(res, 423, { error: roomFeatureError });
    }

    const rooms = await readJson(FILES.rooms, []);
    const room = rooms.find((entry) => entry.id === roomId);
    if (!room) return json(res, 404, { error: "Room not found" });
    if (!canAccessRoom(room, user)) return json(res, 403, { error: "You do not have access to this room" });
    const automodError = await checkAutomod(textValue, user, req);
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
    await writeJson(FILES.messages, messages.slice(-MESSAGE_STORE_LIMIT));
    await addSystemLog("message.sent", user.username, { roomId, hasAttachment: Boolean(attachment), mentions: message.mentions }, req);
    await broadcastRoomMessage(message, rooms);
    return json(res, 201, { message: safeRoomMessage(message, user) });
  }

  if (req.method === "GET" && pathname === "/api/secret-messages") {
    const settings = await readJson(FILES.settings, {});
    if (!canAccessSecretMessaging(settings, user)) return json(res, 403, { error: "Secret messaging is not enabled for this account" });
    const secretMessages = await readJson(FILES.secretMessages, []);
    return json(res, 200, { secretMessages: safeSecretMessages(secretMessages, user, settings).slice(-STATE_MESSAGE_LIMIT) });
  }

  if (req.method === "POST" && pathname === "/api/secret-messages") {
    const settings = await readJson(FILES.settings, {});
    if (!settings.serverEnabled && !canManage(user)) return json(res, 423, { error: "Server room is off" });
    if (!canAccessSecretMessaging(settings, user)) return json(res, 403, { error: "Secret messaging is not enabled for this account" });
    const rateError = await checkMessageRate(user);
    if (rateError) return json(res, 429, { error: rateError });
    const body = await readJsonBody(req);
    const textValue = String(body.text || "").trim().slice(0, 2000);
    const attachment = await resolveChatAttachment(body.attachment);
    if (!textValue && !attachment) return json(res, 400, { error: "Message cannot be empty" });
    const automodError = await checkAutomod(textValue, user, req);
    if (automodError) return json(res, 400, { error: automodError });
    const secretMessages = await readJson(FILES.secretMessages, []);
    const message = {
      id: crypto.randomUUID(),
      text: textValue,
      attachment,
      reactions: {},
      user: user.username,
      sourceIp: getClientIp(req),
      sourceHost: req.headers.host || "",
      sourceAgent: String(req.headers["user-agent"] || "").slice(0, 240),
      sourceDevice: deviceSignature(req),
      approximateLocation: approximateLocationFromIp(getClientIp(req)),
      createdAt: new Date().toISOString(),
    };
    secretMessages.push(message);
    await writeJson(FILES.secretMessages, secretMessages.slice(-MESSAGE_STORE_LIMIT));
    await addSystemLog("secret-message.sent", user.username, { hasAttachment: Boolean(attachment) }, req);
    broadcastSecretMessage({ type: "secret-message:new", message }, settings);
    return json(res, 201, { message: safeSecretMessages([message], user, settings)[0] });
  }

  if (req.method === "POST" && pathname === "/api/upload") {
    const settings = await readJson(FILES.settings, {});
    if (!settings.serverEnabled && !canManage(user)) return json(res, 423, { error: "Server room is off" });
    const featureError = await featureGateError(settings, "files", user, { roomId: String(req.headers["x-file-release-room"] || "").trim().slice(0, 80) });
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
    await notifyAdminEmails("Connectifi announcement posted", [
      `${user.username} posted an announcement.`,
      `Title: ${title}`,
      `Scope: ${scope === "room" ? `Room ${room ? room.name : roomId}` : "Whole platform"}`,
      "",
      message,
    ].join("\n"), { route: "announcements" });
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
    const [files, rooms] = await Promise.all([readJson(FILES.uploads, []), readJson(FILES.rooms, [])]);
    return json(res, 200, { files: safeFileRecords(files, user, rooms) });
  }

  const fileDownloadMatch = pathname.match(/^\/api\/files\/([^/]+)\/download$/);
  if (req.method === "GET" && fileDownloadMatch) {
    const id = decodeURIComponent(fileDownloadMatch[1]);
    const [files, rooms] = await Promise.all([readJson(FILES.uploads, []), readJson(FILES.rooms, [])]);
    const record = files.find((entry) => entry.id === id);
    if (!record) return text(res, 404, "File not found");
    if (!canAccessFileRecord(record, user, rooms)) return text(res, 403, "Private or unreleased file");
    return serveFileRecord(req, res, record);
  }

  if (req.method === "POST" && pathname === "/api/profile") {
    const body = await readJsonBody(req);
    const profiles = await readJson(FILES.profiles, {});
    const previous = profiles[user.username] || defaultProfile(user.username);
    const now = new Date().toISOString();
    const submittedGrade = normalizeGrade(body.grade || "");
    const submittedEmail = String(body.email || "").trim().slice(0, 120);
    const submittedPhone = String(body.phone || "").trim().slice(0, 40);
    const submittedContact = [submittedEmail, submittedPhone].filter(Boolean).join(" / ");
    const next = sanitizeProfile({
      ...previous,
      displayName: body.displayName,
      bio: body.bio,
      avatarUrl: body.avatarUrl,
      bannerUrl: body.bannerUrl,
      badges: body.badges,
      customStatus: body.customStatus,
      grade: body.grade,
      gradeUpdatedAt: submittedGrade ? now : previous.gradeUpdatedAt,
      contactUpdatedAt: submittedContact ? now : previous.contactUpdatedAt,
      status: body.status,
      invisible: Boolean(body.invisible),
      theme: body.theme,
      visualStyle: body.visualStyle,
      themeImageUrl: body.themeImageUrl,
      schedules: body.schedules,
      customTheme: body.customTheme,
      updatedAt: now,
    });
    profiles[user.username] = next;
    const users = await readJson(FILES.users, []);
    const userIndex = users.findIndex((entry) => entry.username.toLowerCase() === user.username.toLowerCase());
    if (userIndex !== -1) {
      const nextEmail = submittedEmail || String(users[userIndex].email || "").trim().slice(0, 120);
      const nextPhone = submittedPhone || String(users[userIndex].phone || "").trim().slice(0, 40);
      const contactParts = [nextEmail, nextPhone].filter(Boolean);
      users[userIndex] = {
        ...users[userIndex],
        grade: next.grade,
        gradeUpdatedAt: next.grade ? now : users[userIndex].gradeUpdatedAt,
        email: nextEmail,
        phone: nextPhone,
        contact: contactParts.length ? contactParts.join(" / ") : users[userIndex].contact || "",
        contactUpdatedAt: contactParts.length ? now : users[userIndex].contactUpdatedAt,
        updatedAt: now,
        updatedBy: user.username,
      };
      await writeJson(FILES.users, users);
      broadcastManagers({ type: "users:update", users: users.map(safeUser) });
    }
    await writeJson(FILES.profiles, profiles);
    await broadcastProfileUpdate(profiles, users);
    return json(res, 200, { profile: next, profiles: safeProfiles(profiles, users, user), user: safeUser(users[userIndex] || user, user) });
  }

  if (req.method === "POST" && pathname === "/api/friends/request") {
    const settings = await readJson(FILES.settings, {});
    const featureError = await featureGateError(settings, "friends", user);
    if (featureError) return json(res, 423, { error: featureError });
    const body = await readJsonBody(req);
    const to = String(body.to || "").trim();
    const searchProof = String(body.search || body.to || "").trim();
    if (!to || to.toLowerCase() === user.username.toLowerCase()) return json(res, 400, { error: "Choose another user" });
    const users = await readJson(FILES.users, []);
    const recipient = users.find((entry) => entry.username.toLowerCase() === to.toLowerCase());
    if (!recipient) return json(res, 404, { error: "Account not found" });
    if (!canOwn(user) && !friendGradeAllowed(user, recipient, searchProof)) {
      return json(res, 403, { error: "You can only add people in your grade unless you search their exact username." });
    }
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

  if (req.method === "GET" && pathname === "/api/friends/candidates") {
    const settings = await readJson(FILES.settings, {});
    const featureError = await featureGateError(settings, "friends", user);
    if (featureError) return json(res, 423, { error: featureError });
    const query = String(requestUrl.searchParams.get("q") || "").trim();
    const users = await readJson(FILES.users, []);
    const profiles = await readJson(FILES.profiles, {});
    const friends = await readJson(FILES.friends, { requests: [], friendships: [] });
    const currentFriends = new Set((friends.friendships || [])
      .filter((entry) => Array.isArray(entry.users) && entry.users.includes(user.username))
      .flatMap((entry) => entry.users)
      .map((name) => String(name).toLowerCase()));
    const people = users
      .filter((entry) => entry.username.toLowerCase() !== user.username.toLowerCase())
      .filter((entry) => !currentFriends.has(entry.username.toLowerCase()))
      .filter((entry) => canOwn(user) || friendCandidateAllowed(user, entry, query, profiles[entry.username]))
      .slice(0, 25)
      .map((entry) => publicUser(entry, profiles[entry.username]));
    return json(res, 200, { people });
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
    const [settings, reports, messages, dms, users] = await Promise.all([
      readJson(FILES.settings, {}),
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
      reporterContact: userContactSnapshot(users, user.username, user),
      targetType,
      targetId,
      targetSender: target ? String(target.user || target.from || "").slice(0, 80) : "",
      targetSenderContact: target ? userContactSnapshot(users, String(target.user || target.from || ""), user) : null,
      targetText: target ? String(target.text || "").slice(0, 1000) : "",
      reason: String(body.reason || "").trim().slice(0, 500),
      status: "open",
      createdAt: new Date().toISOString(),
    };
    if (!report.reason) return json(res, 400, { error: "Report reason is required" });
    const nextReports = pruneReportsForSettings([report, ...reports], settings);
    await writeJson(FILES.reports, nextReports);
    await addModerationLog(user.username, "report:create", `${report.targetType}:${report.targetId}`, report.reason);
    await notifyAdminEmails("Connectifi report", [
      `${user.username} reported ${report.targetType}:${report.targetId}`,
      `Reporter contact: ${formatContactSnapshot(report.reporterContact)}`,
      `Sender: ${report.targetSender || "unknown"}`,
      `Sender contact: ${formatContactSnapshot(report.targetSenderContact)}`,
      `Message: ${report.targetText || "(not found)"}`,
      `Reason: ${report.reason}`,
    ].join("\n"), { route: "reports" });
    broadcastManagers({ type: "reports:update", reports: safeActiveReports(nextReports, settings) });
    return json(res, 201, { report });
  }

  if (req.method === "POST" && pathname === "/api/reports/update") {
    const body = await readJsonBody(req);
    const [settings, reports] = await Promise.all([readJson(FILES.settings, {}), readJson(FILES.reports, [])]);
    if (!canUseModerationCapability(user, settings, "reports")) return json(res, 403, { error: "Owner admin has not granted report access" });
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
    const activeReports = safeActiveReports(pruneReportsForSettings(reports, settings), settings);
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
    await broadcastReceiptContext(payload, context, targetId, user);
    return json(res, 200, { readReceipts: { [key]: receipts[key] } });
  }

  if (req.method === "POST" && pathname === "/api/logs/wipe") {
    const settings = await readJson(FILES.settings, {});
    if (!canViewAuditLogs(user, settings)) return json(res, 403, { error: "Selected moderator access required" });
    if (!canOwn(user)) return ownerFailsafeTriggeredResponse(req, res, user, "system-and-moderation-logs-wipe");
    const body = await readJsonBody(req);
    if (String(body.confirm || "").toUpperCase() !== "WIPE") return json(res, 400, { error: "Type WIPE to clear logs" });
    await Promise.all([writeJson(FILES.logs, []), writeJson(FILES.moderationLogs, [])]);
    await addSystemLog("logs.wiped", user.username, { note: String(body.note || "").slice(0, 160) }, req);
    const logs = await readJson(FILES.logs, []);
    broadcastManagerLogs("logs:update", "logs", logs);
    broadcastManagerLogs("moderation:update", "moderationLogs", []);
    return json(res, 200, { logs: safeLogEntries(logs, user), moderationLogs: [] });
  }

  if (req.method === "POST" && pathname === "/api/browser/history/wipe") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    if (!canOwn(user)) return ownerFailsafeTriggeredResponse(req, res, user, "browser-history-log-wipe");
    const body = await readJsonBody(req);
    if (String(body.confirm || "").toUpperCase() !== "WIPE") return json(res, 400, { error: "Type WIPE to clear browser history" });
    const targetUsername = String(body.username || "").trim().toLowerCase();
    if (!targetUsername) return json(res, 400, { error: "Choose a user" });
    const logs = await readJson(FILES.logs, []);
    const next = logs.filter((entry) => !(String(entry.actor || "").toLowerCase() === targetUsername && String(entry.action || "") === "browser.open"));
    await writeJson(FILES.logs, next);
    await addSystemLog("browser.history.wiped", user.username, { username: targetUsername }, req);
    const updated = await readJson(FILES.logs, []);
    broadcastManagerLogs("logs:update", "logs", updated.slice(0, 300));
    return json(res, 200, { logs: safeLogEntries(updated.slice(0, 300), user) });
  }

  if (req.method === "POST" && pathname === "/api/wipe/reports") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    if (String(body.confirm || "").toUpperCase() !== "WIPE") return json(res, 400, { error: "Type WIPE to clear reports" });
    const targetUsername = normalizeUsername(body.username || "");
    if (targetUsername) {
      const reports = await readJson(FILES.reports, []);
      const next = reports.filter((report) => !reportTouchesUser(report, targetUsername));
      await writeJson(FILES.reports, next);
      await addSystemLog("reports.user.wiped", user.username, { username: targetUsername, count: reports.length - next.length }, req);
      const settings = await readJson(FILES.settings, {});
      const activeReports = safeActiveReports(next, settings);
      broadcastManagers({ type: "reports:update", reports: activeReports });
      return json(res, 200, { reports: activeReports });
    }
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
    broadcastRoomsUpdate([mainRoom]);
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

  if (req.method === "POST" && pathname === "/api/inner-docs") {
    const body = await readJsonBody(req);
    const docs = await readJson(FILES.innerDocs, []);
    const id = String(body.id || "").trim();
    const now = new Date().toISOString();
    const existingIndex = id ? docs.findIndex((doc) => doc.id === id) : -1;
    if (existingIndex !== -1 && !canAccessInnerDoc(docs[existingIndex], user)) return json(res, 403, { error: "Doc access required" });
    const previous = existingIndex !== -1 ? docs[existingIndex] : {};
    const next = sanitizeInnerDoc({
      ...previous,
      id: previous.id || crypto.randomUUID(),
      title: body.title,
      type: body.type,
      body: sanitizeInnerDocHtml(body.body),
      owner: previous.owner || user.username,
      sharedWith: previous.sharedWith || [],
      createdAt: previous.createdAt || now,
      createdBy: previous.createdBy || user.username,
      updatedAt: now,
      updatedBy: user.username,
    });
    if (!next.title) return json(res, 400, { error: "Doc title is required" });
    if (existingIndex === -1) docs.unshift(next);
    else docs[existingIndex] = next;
    await writeJson(FILES.innerDocs, docs.slice(0, 1000));
    return json(res, 200, { doc: safeInnerDoc(next, user), innerDocs: safeInnerDocs(docs, user) });
  }

  if (req.method === "POST" && pathname === "/api/inner-docs/share") {
    const body = await readJsonBody(req);
    const id = String(body.id || "").trim();
    const target = String(body.target || "").trim();
    const docs = await readJson(FILES.innerDocs, []);
    const index = docs.findIndex((doc) => doc.id === id);
    if (index === -1) return json(res, 404, { error: "Doc not found" });
    if (!canAccessInnerDoc(docs[index], user)) return json(res, 403, { error: "Doc access required" });

    const friends = await readJson(FILES.friends, { requests: [], friendships: [] });
    const sharedUsers = new Set(Array.isArray(docs[index].sharedWith) ? docs[index].sharedWith : []);
    let dmTarget = target;
    let dmGroupId = "";
    if (target.startsWith("group:")) {
      dmGroupId = target.slice(6);
      const groups = await readJson(FILES.dmGroups, []);
      const group = groups.map(sanitizeDmGroup).find((entry) => entry.id === dmGroupId);
      if (!group || !group.participants.includes(user.username)) return json(res, 403, { error: "Group access required" });
      for (const participant of group.participants) {
        if (participant !== user.username && !areFriends(friends, user.username, participant)) {
          return json(res, 403, { error: "Docs can only be shared with accepted friends" });
        }
        sharedUsers.add(participant);
      }
      dmTarget = group.name;
    } else {
      if (!areFriends(friends, user.username, target)) return json(res, 403, { error: "Docs can only be shared with accepted friends" });
      sharedUsers.add(target);
    }
    docs[index] = sanitizeInnerDoc({
      ...docs[index],
      sharedWith: Array.from(sharedUsers),
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    });
    await writeJson(FILES.innerDocs, docs);

    const dms = await readJson(FILES.dms, []);
    const dm = {
      id: crypto.randomUUID(),
      from: user.username,
      to: dmGroupId ? dmTarget : target,
      groupId: dmGroupId,
      groupName: dmGroupId ? dmTarget : "",
      participants: dmGroupId ? Array.from(sharedUsers) : [user.username, target],
      text: `Inner Doc: ${docs[index].title}\nOpen the Docs tab to edit the shared doc.`,
      attachment: null,
      mentions: [],
      sourceIp: getClientIp(req),
      sourceHost: req.headers.host || "",
      sourceAgent: String(req.headers["user-agent"] || "").slice(0, 240),
      sourceDevice: deviceSignature(req),
      createdAt: new Date().toISOString(),
    };
    dms.push(dm);
    await writeJson(FILES.dms, dms.slice(-DM_STORE_LIMIT));
    broadcastDm({ type: "dm:new", dm }, dm);
    return json(res, 200, { doc: safeInnerDoc(docs[index], user), innerDocs: safeInnerDocs(docs, user), dm });
  }

  const innerDocDownloadMatch = pathname.match(/^\/api\/inner-docs\/([^/]+)\/download$/);
  if (req.method === "GET" && innerDocDownloadMatch) {
    const id = decodeURIComponent(innerDocDownloadMatch[1] || "");
    const docs = await readJson(FILES.innerDocs, []);
    const doc = docs.map(sanitizeInnerDoc).find((entry) => entry.id === id);
    if (!doc) return text(res, 404, "Doc not found");
    if (!canAccessInnerDoc(doc, user)) return text(res, 403, "Doc access required");
    const format = String(requestUrl.searchParams.get("format") || "html").toLowerCase() === "txt" ? "txt" : "html";
    const filename = `${downloadSafeName(doc.title || "inner-doc")}.${format}`;
    const body = format === "txt" ? innerDocPlainText(doc) : innerDocHtmlExport(doc);
    res.writeHead(200, {
      "Content-Type": format === "txt" ? "text/plain; charset=utf-8" : "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    });
    return res.end(body);
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/inner-docs/")) {
    const id = decodeURIComponent(pathname.split("/").pop() || "");
    const docs = await readJson(FILES.innerDocs, []);
    const doc = docs.find((entry) => entry.id === id);
    if (!doc) return json(res, 404, { error: "Doc not found" });
    if (doc.owner !== user.username && !canManage(user)) return json(res, 403, { error: "Only the owner can delete this doc" });
    const next = docs.filter((entry) => entry.id !== id);
    await writeJson(FILES.innerDocs, next);
    return json(res, 200, { innerDocs: safeInnerDocs(next, user) });
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
      await writeJson(FILES.ai, { apiKey: "", baseUrl: "", model: "", updatedAt: new Date().toISOString(), updatedBy: user.username });
      return json(res, 200, { aiConfigured: Boolean(resolveAiConfig({}).apiKey) });
    }
    const apiKey = String(body.apiKey || "").trim();
    const baseUrl = sanitizeAiBaseUrl(body.baseUrl || "");
    const model = String(body.model || "").trim().slice(0, 120);
    if (apiKey.length < 8) return json(res, 400, { error: "Paste a valid AI API key" });
    await writeJson(FILES.ai, {
      apiKey,
      baseUrl,
      model,
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    });
    return json(res, 200, { aiConfigured: true });
  }

  if (req.method === "GET" && pathname === "/api/ai/security-flags") {
    if (!canOwn(user)) return json(res, 403, { error: "Owner admin access required" });
    const flags = await readJson(FILES.aiSecurityFlags, []);
    return json(res, 200, { flags: Array.isArray(flags) ? flags.slice(0, 100) : [] });
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
    broadcastManagers({ type: "room:new", room: safeRoom(room) });
    return json(res, 201, { room: safeRoom(room), rooms: safeRoomsForUser(rooms, user) });
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
    broadcastRoomsUpdate(rooms);
    return json(res, 200, { rooms: safeRoomsForUser(rooms, user), room: safeRoom(rooms[index]) });
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
    const requestedCode = String(body.code || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
    if (requestedCode && requestedCode.length < 4) return json(res, 400, { error: "Invite code must be at least 4 characters" });
    if (requestedCode && invites.some((entry) => String(entry.code || "").toLowerCase() === requestedCode.toLowerCase())) {
      return json(res, 409, { error: "Invite code already exists" });
    }
    const invite = {
      id: crypto.randomUUID(),
      code: uniqueInviteCode(invites, requestedCode),
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
    broadcastRoomsUpdate(rooms);
    return json(res, 200, { room: safeRoom(room), rooms: safeRoomsForUser(rooms, user) });
  }

  if (req.method === "POST" && pathname === "/api/rooms/unlock") {
    const body = await readJsonBody(req);
    const roomId = String(body.roomId || "").trim();
    const password = String(body.password || "");
    const rooms = await readJson(FILES.rooms, []);
    const room = rooms.find((entry) => entry.id === roomId);
    if (!room) return json(res, 404, { error: "Room not found" });
    if (!room.passwordHash) return json(res, 200, { room: safeRoom(room), rooms: safeRooms(rooms) });
    if (!(await verifyPasswordAsync(password, room.passwordHash))) return json(res, 403, { error: "Room password is incorrect" });
    if (!Array.isArray(room.allowedUsers)) room.allowedUsers = [];
    if (!room.allowedUsers.includes(user.username)) room.allowedUsers.push(user.username);
    await writeJson(FILES.rooms, rooms);
    await addSystemLog("room.password.unlocked", user.username, { roomId, roomName: room.name }, req);
    broadcastRoomsUpdate(rooms);
    return json(res, 200, { room: safeRoom(room), rooms: safeRoomsForUser(rooms, user) });
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

  const wipeRoomMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/wipe$/);
  if (req.method === "POST" && wipeRoomMatch) {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const id = decodeURIComponent(wipeRoomMatch[1] || "");
    if (!id) return json(res, 400, { error: "Room id required" });
    const body = await readJsonBody(req);
    if (String(body.confirm || "").toUpperCase() !== "WIPE") return json(res, 400, { error: "Type WIPE to clear room messages" });
    const rooms = await readJson(FILES.rooms, []);
    const room = rooms.find((entry) => entry.id === id);
    if (!room) return json(res, 404, { error: "Room not found" });
    const messages = await readJson(FILES.messages, []);
    const nextMessages = messages.filter((entry) => (entry.roomId || "main") !== id);
    await writeJson(FILES.messages, nextMessages);
    await addSystemLog("room.messages.wiped", user.username, { roomId: id, name: room.name }, req);
    broadcast({ type: "room:wipe", id });
    return json(res, 200, { messages: nextMessages.filter((entry) => canManage(user) || canAccessRoom(rooms.find((roomEntry) => roomEntry.id === (entry.roomId || "main")), user)) });
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

    const secret = Boolean(body.secret);
    if (secret) {
      if (!canAccessSecretMessaging(settings, user)) return json(res, 403, { error: "Secret messaging is not enabled for this account" });
      const secretParticipants = group ? participants : [user.username, recipient.username];
      const accounts = new Map(users.map((entry) => [String(entry.username || "").toLowerCase(), entry]));
      const denied = secretParticipants.some((username) => !canAccessSecretMessaging(settings, accounts.get(String(username).toLowerCase())));
      if (denied) return json(res, 403, { error: "Every participant must have secret messaging access for a secret DM" });
    }

    const automodError = await checkAutomod(textValue, user, req);
    if (automodError) return json(res, 400, { error: automodError });

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
      secret,
      sourceIp: getClientIp(req),
      sourceHost: req.headers.host || "",
      sourceAgent: String(req.headers["user-agent"] || "").slice(0, 240),
      sourceDevice: deviceSignature(req),
      approximateLocation: approximateLocationFromIp(getClientIp(req)),
      createdAt: new Date().toISOString(),
    };
    dms.push(dm);
    await writeJson(FILES.dms, dms.slice(-DM_STORE_LIMIT));
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
    const automodError = await checkAutomod(textValue, user, req);
    if (automodError) return json(res, 400, { error: automodError });
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
    if (!canManage(user) && !canModerate(user)) return json(res, 403, { error: "Moderator access required" });
    const settings = await readJson(FILES.settings, {});
    if (normalizeRole(user.role) === "admin" && !canOwn(user) && !canUseModerationCapability(user, settings, "room-controls")) {
      return json(res, 403, { error: "Owner admin has not granted room-control access" });
    }
    const body = await readJsonBody(req);
    const feature = String(body.feature || "").toLowerCase();
    if (!allowedFeatureLocks.has(feature)) return json(res, 400, { error: "Unknown feature" });

    const isManager = canManage(user);
    const roomId = String(body.roomId || "").trim().slice(0, 80);
    const removeScheduleId = String(body.removeScheduleId || "").trim();
    const exemptionGrade = normalizeGrade(body.exemptionGrade || "");
    if (!isManager && !roomId && !removeScheduleId) return json(res, 400, { error: "Moderators must choose a room for feature locks" });
    if (!isManager && roomId) {
      const rooms = await readJson(FILES.rooms, []);
      if (!rooms.some((room) => String(room && room.id || "") === roomId)) {
        return json(res, 404, { error: "Room not found" });
      }
    }
    if (!isManager && ["admin", "hmd", "domain", "vpn", "bots", "plugins"].includes(feature)) {
      return json(res, 403, { error: "Moderators can lock room/member features only" });
    }
    const maxMinutes = isManager ? 525600 : 360;
    const minutes = Math.max(0, Math.min(maxMinutes, Number(body.minutes || 0)));
    const reason = String(body.reason || "").trim().slice(0, 160);
    const requestedStart = Date.parse(body.startAt || "");
    const requestedEnd = Date.parse(body.endAt || "");
    const disabledFrom = Number.isFinite(requestedStart) ? requestedStart : Date.now();
    const disabledUntil = Number.isFinite(requestedEnd)
      ? requestedEnd
      : minutes > 0
        ? Date.now() + minutes * 60 * 1000
        : 0;
    if (disabledUntil && disabledUntil <= disabledFrom) return json(res, 400, { error: "End time must be after start time" });
    const featureLocks = { ...(settings.featureLocks || {}) };
    const previousLock = featureLocks[feature] && typeof featureLocks[feature] === "object" ? featureLocks[feature] : {};
    const existingSchedules = sanitizeFeatureLockSchedules(previousLock.schedules || []);
    const existingExemptions = sanitizeFeatureLockExemptions(previousLock.exemptions || []);
    const scheduleDays = normalizeScheduleDays(body.days);
    const scheduleStartTime = normalizeScheduleTime(body.startTime);
    const scheduleEndTime = normalizeScheduleTime(body.endTime);

    if (exemptionGrade) {
      if (!roomId) return json(res, 400, { error: "Choose a room for temporary class access" });
      const exemptionMinutes = Math.max(1, Math.min(isManager ? 525600 : 360, Number(body.exemptionMinutes || 0)));
      if (!Number.isFinite(exemptionMinutes) || exemptionMinutes < 1) return json(res, 400, { error: "Choose how long class access should last" });
      const exemption = {
        id: crypto.randomUUID(),
        grade: exemptionGrade,
        roomId,
        until: new Date(Date.now() + exemptionMinutes * 60 * 1000).toISOString(),
        exemptedBy: user.username,
        createdAt: new Date().toISOString(),
      };
      const exemptions = [
        ...existingExemptions.filter((entry) => entry.grade !== exemption.grade || entry.roomId !== exemption.roomId),
        exemption,
      ].slice(-96);
      featureLocks[feature] = { ...previousLock, exemptions };
    } else if (removeScheduleId) {
      const existingSchedule = existingSchedules.find((schedule) => schedule.id === removeScheduleId);
      if (!existingSchedule) return json(res, 404, { error: "Screen-time schedule not found" });
      if (!isManager && !existingSchedule.roomId) {
        return json(res, 403, { error: "Moderators can only change room screen-time schedules" });
      }
      const schedules = existingSchedules.filter((schedule) => schedule.id !== removeScheduleId);
      const nextLock = { ...previousLock, schedules };
      if (!nextLock.disabledUntil && !schedules.length && !existingExemptions.length) delete featureLocks[feature];
      else featureLocks[feature] = nextLock;
    } else if (scheduleDays.length || scheduleStartTime || scheduleEndTime) {
      if (!scheduleStartTime || !scheduleEndTime) return json(res, 400, { error: "Choose a schedule start and end time" });
      if (!scheduleDays.length) return json(res, 400, { error: "Choose at least one schedule day" });
      if (scheduleStartTime === scheduleEndTime) return json(res, 400, { error: "Schedule start and end cannot match" });
      const scheduleId = String(body.scheduleId || crypto.randomUUID()).trim().slice(0, 80) || crypto.randomUUID();
      const existingSchedule = existingSchedules.find((schedule) => schedule.id === scheduleId);
      if (!isManager && existingSchedule && !existingSchedule.roomId) {
        return json(res, 403, { error: "Moderators can only change room screen-time schedules" });
      }
      const nextSchedule = {
        id: scheduleId,
        startTime: scheduleStartTime,
        endTime: scheduleEndTime,
        days: scheduleDays,
        repeats: body.repeats !== false,
        disabledBy: user.username,
        reason,
        roomId,
        roles: isManager ? normalizeLockRoles(body.roles) : ["member"],
        updatedAt: new Date().toISOString(),
      };
      const schedules = existingSchedules.some((schedule) => schedule.id === scheduleId)
        ? existingSchedules.map((schedule) => schedule.id === scheduleId ? nextSchedule : schedule)
        : [...existingSchedules, { ...nextSchedule, createdAt: new Date().toISOString() }];
      featureLocks[feature] = {
        ...previousLock,
        schedules: schedules.slice(0, 48),
      };
    } else if (disabledUntil > 0) {
      if (!isManager && previousLock.disabledUntil && !previousLock.roomId) {
        return json(res, 403, { error: "Moderators can only change room screen-time limits" });
      }
      featureLocks[feature] = {
        ...previousLock,
        disabledFrom: new Date(disabledFrom).toISOString(),
        disabledUntil: new Date(disabledUntil).toISOString(),
        disabledBy: user.username,
        reason,
        roomId,
        roles: isManager ? normalizeLockRoles(body.roles) : ["member"],
      };
    } else {
      if (!isManager && previousLock.roomId !== roomId) {
        return json(res, 403, { error: "Moderators can only change room screen-time limits" });
      }
      const nextLock = { ...previousLock };
      delete nextLock.disabledFrom;
      delete nextLock.disabledUntil;
      delete nextLock.disabledBy;
      delete nextLock.reason;
      delete nextLock.roomId;
      delete nextLock.roles;
      if ((!nextLock.schedules || !nextLock.schedules.length) && !existingExemptions.length) delete featureLocks[feature];
      else featureLocks[feature] = nextLock;
    }

    const next = {
      ...settings,
      featureLocks,
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    await writeJson(FILES.settings, next);
    await addSystemLog("feature.lock.updated", user.username, { feature, minutes, reason }, req);
    broadcastSettings(next);
    return json(res, 200, { settings: safeSettings(next, user) });
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
    if (status === "declined" && requests[index].email) {
      await sendDirectEmail([requests[index].email], "Connectifi account request declined", [
        `Hi ${requests[index].displayName || requests[index].username},`,
        "",
        "Your Connectifi account request was declined.",
        "For the next 12 hours, signing in with your requested username and password will show the denied status.",
        "",
        requests[index].adminNote ? `Admin note: ${requests[index].adminNote}` : "",
      ].filter(Boolean).join("\n"), { route: "accountApprovals", contactType: "admin", fromContact: true });
    }
    broadcastManagers({ type: "account-requests:update", accountRequests: safeAccountRequests(requests) });
    return json(res, 200, { accountRequests: safeAccountRequests(requests, user), request: safeAccountRequest(requests[index], user) });
  }

  if (req.method === "POST" && pathname === "/api/account-requests/approve") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const id = String(body.id || "");
    const password = String(body.password || "");
    if (password.length > 0 && password.length < 4) return json(res, 400, { error: "Password must be at least 4 characters" });

    const [requests, users, profiles] = await Promise.all([
      readJson(FILES.accountRequests, []),
      readJson(FILES.users, []),
      readJson(FILES.profiles, {}),
    ]);
    const index = requests.findIndex((entry) => entry.id === id);
    if (index === -1) return json(res, 404, { error: "Account request not found" });
    const request = sanitizeAccountRequest(requests[index]);
    const grantedRole = normalizeRole(body.role || request.requestedRole || "member");
    if (grantedRole === "admin") return json(res, 403, { error: "Creating new admin accounts is locked. Use the existing admin accounts only." });
    if (["hmd", "dev"].includes(grantedRole) && !canDev(user)) return json(res, 403, { error: "HMD/dev access required" });
    if (request.status === "approved") return json(res, 409, { error: "Request already approved" });
    const nextPasswordHash = password.length >= 4 ? hashPassword(password) : request.passwordHash;
    if (!nextPasswordHash) return json(res, 400, { error: "This request has no password. Set one while approving." });
    if (users.some((entry) => entry.username.toLowerCase() === request.username.toLowerCase())) {
      return json(res, 409, { error: "That username already exists" });
    }

    const now = new Date().toISOString();
    const account = {
      username: request.username,
      role: grantedRole,
      passwordHash: nextPasswordHash,
      passwordPreset: "",
      allowPersistentLogin: Boolean(body.allowPersistentLogin) || effectivePersistentLogin({ username: request.username, role: grantedRole, grade: request.grade }, await readJson(FILES.settings, {}), await readJson(FILES.rooms, [])),
      contact: request.contact,
      email: request.email,
      phone: request.phone,
      grade: request.grade,
      gradeUpdatedAt: request.grade ? now : "",
      contactUpdatedAt: request.contact ? now : "",
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
      grade: request.grade,
      gradeUpdatedAt: request.grade ? now : "",
      contactUpdatedAt: request.contact ? now : "",
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
    await addSystemLog("account.request.approved", user.username, { requestUsername: request.username, requestedRole: request.requestedRole, role: grantedRole }, req);
    await notifyAdminEmails("Connectifi account approved", [
      `${request.username} was approved by ${user.username}.`,
      `Requested role: ${request.requestedRole}`,
      `Granted role: ${grantedRole}`,
      `Contact: ${request.contact || "not provided"}`,
      `Original request IP: ${request.sourceIp || "unknown"}`,
      `Original request device: ${request.sourceDevice || "unknown"}`,
      `Time: ${new Date().toISOString()}`,
    ].join("\n"), { route: "accountApprovals" });
    if (request.email) {
      await sendDirectEmail([request.email], "Connectifi account approved", [
        `Hi ${request.displayName || request.username},`,
        "",
        "Your Connectifi account has been approved.",
        "You can now sign in to the app.",
        "",
        `Username: ${request.username}`,
        `Account type: ${grantedRole}`,
        password.length >= 4 ? "Use the password your admin just set." : "Use the password you chose when requesting the account.",
      ].join("\n"), { route: "accountApprovals", contactType: "support", fromContact: false, actionLabel: "Open Connectifi", ctaUrl: publicBaseUrl(req) });
    }
    broadcastManagers({ type: "users:update", users: users.map(safeUser) });
    broadcastManagers({ type: "account-requests:update", accountRequests: safeAccountRequests(requests) });
    return json(res, 201, { users: users.map((entry) => safeUser(entry, user)), accountRequests: safeAccountRequests(requests, user), user: safeUser(account, user) });
  }

  if (req.method === "POST" && pathname === "/api/users") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const username = normalizeUsername(body.username);
    const password = String(body.password || "");
    const role = normalizeRole(body.role);
    const email = String(body.email || "").trim().slice(0, 120);
    const phone = String(body.phone || "").trim().slice(0, 40);
    const grade = normalizeGrade(body.grade || "");
    const contact = [email, phone].filter(Boolean).join(" / ");
    if (!username) return json(res, 400, { error: "Use 3-32 letters, numbers, dots, dashes, or underscores" });
    if (username.toLowerCase() === "admin") return json(res, 400, { error: "The admin account already exists" });
    if (role === "admin" && !canOwn(user)) return json(res, 403, { error: "Only an owner admin can create non-owner admin accounts" });
    if (["hmd", "dev"].includes(role) && !canDev(user)) return json(res, 403, { error: "HMD/dev access required" });
    if (password.length < 4) return json(res, 400, { error: "Password must be at least 4 characters" });

    const users = await readJson(FILES.users, []);
    if (users.some((entry) => entry.username.toLowerCase() === username.toLowerCase())) {
      return json(res, 409, { error: "Username already exists" });
    }

    const now = new Date().toISOString();
    const account = {
      username,
      role,
      passwordHash: hashPassword(password),
      email,
      phone,
      contact,
      grade,
      gradeUpdatedAt: grade ? now : "",
      contactUpdatedAt: contact ? now : "",
      createdAt: now,
      createdBy: user.username,
      allowPersistentLogin: Boolean(body.allowPersistentLogin) || effectivePersistentLogin({ username, role, grade }, await readJson(FILES.settings, {}), await readJson(FILES.rooms, [])),
      bannedUntil: "",
      banReason: "",
    };
    users.push(account);
    await writeJson(FILES.users, users);
    const profiles = await readJson(FILES.profiles, {});
    profiles[username] = sanitizeProfile({ ...defaultProfile(username), grade, gradeUpdatedAt: grade ? now : "", contactUpdatedAt: contact ? now : "", updatedAt: now });
    await writeJson(FILES.profiles, profiles);
    if (username.toLowerCase() === "admin2") await unmarkDeletedDefault("admin2", user.username);
    await addSystemLog("account.created", user.username, { username, role }, req);
    await notifyAdminEmails("Connectifi account created", [
      `${user.username} created an account.`,
      `Username: ${username}`,
      `Role: ${role}`,
      `Persistent login: ${body.allowPersistentLogin ? "yes" : "no"}`,
      `Created from IP: ${getClientIp(req) || "unknown"}`,
      `Created from device: ${deviceSignature(req)}`,
      `Time: ${new Date().toISOString()}`,
    ].join("\n"), { route: "accountCreated" });
    if (email) {
      await sendDirectEmail([email], "Connectifi account created", [
        `Hi ${username},`,
        "",
        "A Connectifi account was created for you.",
        "You can sign in after your admin shares your password, or use password reset if it is enabled for your account.",
        "",
        `Username: ${username}`,
        `Account type: ${role}`,
        grade ? `Grade: ${grade}` : "",
      ].filter(Boolean).join("\n"), { route: "accountCreated", contactType: "support", fromContact: false, actionLabel: "Open Connectifi", ctaUrl: publicBaseUrl(req) });
    }
    broadcastManagers({ type: "users:update", users: users.map(safeUser) });
    return json(res, 201, { users: users.map((entry) => safeUser(entry, user)) });
  }

  if (req.method === "POST" && pathname === "/api/users/update") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();
    if (!username) return json(res, 400, { error: "Choose a user" });

    const [users, profiles, settings] = await Promise.all([
      readJson(FILES.users, []),
      readJson(FILES.profiles, {}),
      readJson(FILES.settings, {}),
    ]);
    const index = users.findIndex((entry) => entry.username.toLowerCase() === username.toLowerCase());
    if (index === -1) return json(res, 404, { error: "User not found" });

    const previous = users[index];
    const tempAdminMinutes = Math.max(0, Math.min(10080, Number(body.tempAdminMinutes || 0)));
    const clearTempAdmin = Boolean(body.clearTempAdmin);
    const wantsTempAdmin = tempAdminMinutes > 0;
    const nextRole = wantsTempAdmin
      ? "admin"
      : username.toLowerCase() === "admin"
        ? "admin"
        : normalizeRole(body.role);
    const nextGrade = body.grade !== undefined ? normalizeGrade(body.grade) : normalizeGrade(previous.grade || "");
    const gradeChanged = nextGrade !== normalizeGrade(previous.grade || "");
    if (wantsTempAdmin && !canOwn(user)) {
      return json(res, 403, { error: "Only the owner admin can grant temporary admin" });
    }
    if (wantsTempAdmin && username.toLowerCase() === "admin") {
      return json(res, 400, { error: "The main admin account is already permanent admin" });
    }
    if (nextRole === "admin" && normalizeRole(previous.role) !== "admin" && !wantsTempAdmin && !canOwn(user)) {
      return json(res, 403, { error: "Only an owner admin can promote an account to admin" });
    }
    if (canOwn(previous) && nextRole !== "admin") {
      return json(res, 403, { error: "Owner admin accounts must remain admin accounts" });
    }
    if (["hmd", "dev"].includes(nextRole) && !canDev(user)) return json(res, 403, { error: "HMD/dev access required" });
    const tempAdminUntil = wantsTempAdmin
      ? new Date(Date.now() + tempAdminMinutes * 60 * 1000).toISOString()
      : clearTempAdmin
        ? ""
        : previous.tempAdminUntil || "";
    const tempAdminPreviousRole = wantsTempAdmin
      ? effectiveRole(previous) === "admin" ? normalizeRole(previous.tempAdminPreviousRole || "moderator") : effectiveRole(previous)
      : clearTempAdmin
        ? ""
        : previous.tempAdminPreviousRole || "";
    users[index] = {
      ...previous,
      role: clearTempAdmin && previous.tempAdminPreviousRole ? normalizeRole(previous.tempAdminPreviousRole) : nextRole,
      grade: nextGrade,
      gradeUpdatedAt: gradeChanged ? new Date().toISOString() : previous.gradeUpdatedAt || "",
      allowPersistentLogin: Boolean(body.allowPersistentLogin),
      tempAdminUntil,
      tempAdminPreviousRole,
      mutedUntil: body.mutedUntil !== undefined ? String(body.mutedUntil || "") : previous.mutedUntil || "",
      shadowMuted: body.shadowMuted !== undefined ? Boolean(body.shadowMuted) : Boolean(previous.shadowMuted),
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    profiles[previous.username] = sanitizeProfile({
      ...defaultProfile(previous.username),
      ...(profiles[previous.username] || {}),
      grade: nextGrade,
      gradeUpdatedAt: users[index].gradeUpdatedAt,
      updatedAt: new Date().toISOString(),
    });
    const permanentPromotion = nextRole === "admin" && normalizeRole(previous.role) !== "admin" && !wantsTempAdmin;
    const promotedFeatures = ["strikes", "room-controls", "reports", "audit-logs", "member-actions", "content-moderation", "account-requests", "account-management", "live-ip-tracking", "announcements", "store-management", "auto-moderation", "voice-management", "service-scaling", "system-logs"];
    const nextSettings = permanentPromotion
      ? {
        ...settings,
        delegatedAdminFeatures: sanitizeDelegatedAdminFeatures({
          ...(settings.delegatedAdminFeatures || {}),
          [normalizeUsername(previous.username)]: promotedFeatures,
        }),
        updatedAt: new Date().toISOString(),
        updatedBy: user.username,
      }
      : settings;
    await Promise.all([writeJson(FILES.users, users), writeJson(FILES.profiles, profiles), permanentPromotion ? writeJson(FILES.settings, nextSettings) : Promise.resolve()]);
    if (previous.role !== users[index].role || previous.allowPersistentLogin !== users[index].allowPersistentLogin || tempAdminMinutes || clearTempAdmin) {
      expireUserSessions(username);
    }
    await broadcastProfileUpdate(profiles, users);
    broadcastManagers({ type: "users:update", users: users.map(safeUser) });
    if (permanentPromotion) broadcastSettings(nextSettings);
    return json(res, 200, { users: users.map((entry) => safeUser(entry, user)), profiles: safeProfiles(profiles, users, user) });
  }

  if (req.method === "GET" && pathname === "/api/users/files") {
    if (!canOwn(user)) return json(res, 403, { error: "Owner admin access required" });
    const username = normalizeUsername(requestUrl.searchParams.get("username") || "");
    if (!username) return json(res, 400, { error: "Choose a user" });
    const [files, rooms] = await Promise.all([readJson(FILES.uploads, []), readJson(FILES.rooms, [])]);
    const userFiles = files.filter((file) => String(file.user || "").toLowerCase() === username.toLowerCase());
    return json(res, 200, { username, files: safeFileRecords(userFiles, user, rooms) });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/users/")) {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const username = decodeURIComponent(pathname.split("/").pop() || "");
    if (username.toLowerCase() === "admin") {
      if (!canOwn(user)) return ownerFailsafeTriggeredResponse(req, res, user, "owner-account-deletion-attempt");
      return json(res, 400, { error: "The owner admin account cannot be deleted" });
    }
    const users = await readJson(FILES.users, []);
    const next = users.filter((entry) => entry.username.toLowerCase() !== username.toLowerCase());
    if (next.length === users.length) return json(res, 404, { error: "User not found" });
    await writeJson(FILES.users, next);
    if (username.toLowerCase() === "admin2") await markDeletedDefault("admin2", user.username);
    expireUserSessions(username);
    broadcastManagers({ type: "users:update", users: next.map(safeUser) });
    return json(res, 200, { users: next.map((entry) => safeUser(entry, user)) });
  }

  if (req.method === "POST" && pathname === "/api/users/ban") {
    const settings = await readJson(FILES.settings, {});
    if (!canUseModerationCapability(user, settings, "member-actions")) return json(res, 403, { error: "Owner admin has not granted member-action access" });
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
    if (minutes > 0) {
      expireUserSessions(username);
      scheduleBanExpiry(username, users[index].bannedUntil);
    } else {
      clearBanExpiry(username);
    }
    broadcastManagers({ type: "users:update", users: users.map(safeUser) });
    return json(res, 200, { users: users.map((entry) => safeUser(entry, user)) });
  }

  if (req.method === "GET" && pathname === "/api/moderation/accounts") {
    const settings = await readJson(FILES.settings, {});
    if (!canUseModerationCapability(user, settings, "strikes") && !canUseModerationCapability(user, settings, "member-actions")) {
      return json(res, 403, { error: "Owner admin has not granted account moderation access" });
    }
    const query = String(requestUrl.searchParams.get("q") || "").trim().toLowerCase();
    if (query.length < 2) return json(res, 200, { users: [] });
    const users = await readJson(FILES.users, []);
    const matches = users
      .filter((entry) => [entry.username, entry.email, entry.displayName].some((value) => String(value || "").toLowerCase().includes(query)))
      .filter((entry) => canOwn(user) || !canOwn(entry))
      .slice(0, 30)
      .map((entry) => safeUser(entry, user));
    return json(res, 200, { users: matches });
  }

  if (req.method === "POST" && pathname === "/api/moderation/strikes") {
    const settings = await readJson(FILES.settings, {});
    if (!canUseModerationCapability(user, settings, "strikes")) return json(res, 403, { error: "Moderator strike access required" });
    const body = await readJsonBody(req);
    const username = normalizeUsername(body.username);
    const reason = String(body.reason || "").trim().slice(0, 240);
    if (!username || !reason) return json(res, 400, { error: "Choose an account and provide a strike reason" });
    const users = await readJson(FILES.users, []);
    const index = users.findIndex((entry) => String(entry.username || "").toLowerCase() === username);
    if (index === -1) return json(res, 404, { error: "Account not found" });
    if (canOwn(users[index]) && !canOwn(user)) return json(res, 403, { error: "Only an owner admin can strike an owner admin account" });
    const strikes = Array.isArray(users[index].strikes) ? users[index].strikes : [];
    const before = strikes.length;
    const strike = { id: crypto.randomUUID(), issuedBy: user.username, reason, createdAt: new Date().toISOString() };
    users[index] = { ...users[index], strikes: [...strikes, strike].slice(-50), updatedAt: strike.createdAt, updatedBy: user.username };
    await addModerationLog(user.username, "user:strike", username, reason);
    await addSystemLog("user.strike.issued", user.username, { username, count: users[index].strikes.length, reason }, req);
    let thresholdReset = false;
    if (before < 3 && users[index].strikes.length >= 3) {
      const recipients = Array.isArray(settings.strikeEmails) ? settings.strikeEmails.map(cleanEmailAddress).filter(Boolean) : [];
      sendDirectEmail(recipients, "Connectifi account reached three strikes", [
        `Account: ${users[index].username}`,
        `Strike count: ${users[index].strikes.length}`,
        `Latest reason: ${reason}`,
        `Issued by: ${user.username}`,
        `Time: ${strike.createdAt}`,
      ].join("\n"), { route: "loginFailures", contactType: "security" }).catch(() => {});
      users[index] = {
        ...users[index],
        strikes: [],
        lastStrikeThresholdAt: strike.createdAt,
        updatedAt: strike.createdAt,
        updatedBy: user.username,
      };
      thresholdReset = true;
      await addModerationLog(user.username, "user:strike-threshold-reset", username, "Third-strike email sent and active strikes reset");
      await addSystemLog("user.strike.threshold.reset", user.username, { username, reason }, req);
    }
    await writeJson(FILES.users, users);
    broadcastManagers({ type: "users:update", users: users.map((entry) => safeUser(entry, user)) });
    return json(res, 200, { user: safeUser(users[index], user), strikes: users[index].strikes, thresholdReset });
  }

  if (req.method === "POST" && pathname === "/api/moderation/strikes/remove") {
    const settings = await readJson(FILES.settings, {});
    if (!canUseModerationCapability(user, settings, "strikes")) return json(res, 403, { error: "Moderator strike access required" });
    const body = await readJsonBody(req);
    const username = normalizeUsername(body.username);
    const removeAll = body.all === true;
    const strikeId = String(body.strikeId || "").trim();
    if (!username || (!removeAll && !strikeId)) return json(res, 400, { error: "Choose a strike to remove" });
    const users = await readJson(FILES.users, []);
    const index = users.findIndex((entry) => String(entry.username || "").toLowerCase() === username);
    if (index === -1) return json(res, 404, { error: "Account not found" });
    if (canOwn(users[index]) && !canOwn(user)) return json(res, 403, { error: "Only an owner admin can change owner admin strikes" });
    const strikes = Array.isArray(users[index].strikes) ? users[index].strikes : [];
    const nextStrikes = removeAll ? [] : strikes.filter((strike) => String(strike.id || "") !== strikeId);
    if (!removeAll && nextStrikes.length === strikes.length) return json(res, 404, { error: "Strike not found" });
    users[index] = { ...users[index], strikes: nextStrikes, updatedAt: new Date().toISOString(), updatedBy: user.username };
    await writeJson(FILES.users, users);
    const detail = removeAll ? `Cleared ${strikes.length} strike${strikes.length === 1 ? "" : "s"}` : "Removed one strike";
    await addModerationLog(user.username, removeAll ? "user:strikes-cleared" : "user:strike-removed", username, detail);
    await addSystemLog(removeAll ? "user.strikes.cleared" : "user.strike.removed", user.username, { username, strikeId: removeAll ? "" : strikeId, removed: removeAll ? strikes.length : 1 }, req);
    broadcastManagers({ type: "users:update", users: users.map((entry) => safeUser(entry, user)) });
    return json(res, 200, { user: safeUser(users[index], user), strikes: users[index].strikes, removed: removeAll ? strikes.length : 1 });
  }

  if (req.method === "POST" && pathname === "/api/delegated-admin-features") {
    if (!canOwn(user)) return json(res, 403, { error: "Owner admin access required" });
    const body = await readJsonBody(req);
    const username = normalizeUsername(body.username);
    const users = await readJson(FILES.users, []);
    const target = users.find((entry) => String(entry.username || "").toLowerCase() === username);
    if (!target || normalizeRole(target.role) !== "admin" || canOwn(target)) return json(res, 400, { error: "Choose a non-owner admin account" });
    const settings = await readJson(FILES.settings, {});
    const features = sanitizeDelegatedAdminFeatureList(body.features || []);
    const delegatedAdminFeatures = sanitizeDelegatedAdminFeatures({ ...(settings.delegatedAdminFeatures || {}), [username]: features });
    const next = { ...settings, delegatedAdminFeatures, updatedAt: new Date().toISOString(), updatedBy: user.username };
    await writeJson(FILES.settings, next);
    await addSystemLog("delegated-admin.features.updated", user.username, { username, features }, req);
    broadcastSettings(next);
    return json(res, 200, { settings: safeSettings(next, user) });
  }

  if (req.method === "POST" && pathname === "/api/users/mute") {
    const settings = await readJson(FILES.settings, {});
    if (!canUseModerationCapability(user, settings, "member-actions")) return json(res, 403, { error: "Owner admin has not granted member-action access" });
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
    return json(res, 200, { users: users.map((entry) => safeUser(entry, user)) });
  }

  if (req.method === "POST" && pathname === "/api/users/kick") {
    const settings = await readJson(FILES.settings, {});
    if (!canUseModerationCapability(user, settings, "member-actions")) return json(res, 403, { error: "Owner admin has not granted member-action access" });
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
    const [messages, rooms] = await Promise.all([readJson(FILES.messages, []), readJson(FILES.rooms, [])]);
    const index = messages.findIndex((entry) => entry.id === id);
    if (index === -1) return json(res, 404, { error: "Message not found" });
    const room = rooms.find((entry) => entry.id === (messages[index].roomId || "main")) || { id: messages[index].roomId || "main" };
    if (!canAccessRoom(room, user)) return json(res, 403, { error: "You do not have access to this message" });
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
    await broadcastRoomPayload({ type: "message:update", message: messages[index] }, messages[index].roomId || "main", rooms, user);
    return json(res, 200, { message: safeRoomMessage(messages[index], user) });
  }

  if (req.method === "POST" && pathname.startsWith("/api/messages/") && pathname.endsWith("/pin")) {
    const id = decodeURIComponent(pathname.split("/")[3] || "");
    const body = await readJsonBody(req);
    const messages = await readJson(FILES.messages, []);
    const index = messages.findIndex((entry) => entry.id === id);
    if (index === -1) return json(res, 404, { error: "Message not found" });
    const [rooms, settings] = await Promise.all([readJson(FILES.rooms, []), readJson(FILES.settings, {})]);
    const room = rooms.find((entry) => entry.id === (messages[index].roomId || "main"));
    if (!room || !canAccessRoom(room, user)) return json(res, 403, { error: "You do not have access to this message" });
    const unpin = body.pinned === false;
    if (unpin && !canUseModerationCapability(user, settings, "content-moderation")) return json(res, 403, { error: "Owner admin has not granted content-moderation access" });
    messages[index] = {
      ...messages[index],
      pinned: !unpin,
      pinnedAt: unpin ? "" : new Date().toISOString(),
      pinnedBy: unpin ? "" : user.username,
    };
    await writeJson(FILES.messages, messages);
    await addSystemLog(unpin ? "message.unpinned" : "message.pinned", user.username, { id, roomId: messages[index].roomId || "main" }, req);
    await broadcastRoomPayload({ type: "message:update", message: messages[index] }, messages[index].roomId || "main", rooms, user);
    return json(res, 200, { message: safeRoomMessage(messages[index], user) });
  }

  if (req.method === "POST" && pathname.startsWith("/api/dms/") && pathname.endsWith("/pin")) {
    const id = decodeURIComponent(pathname.split("/")[3] || "");
    const body = await readJsonBody(req);
    const [dms, settings] = await Promise.all([readJson(FILES.dms, []), readJson(FILES.settings, {})]);
    const index = dms.findIndex((entry) => entry.id === id);
    if (index === -1) return json(res, 404, { error: "DM not found" });
    const dm = dms[index];
    if (!canManage(user) && !(dm.participants || []).includes(user.username)) return json(res, 403, { error: "You do not have access to this DM" });
    const unpin = body.pinned === false;
    if (unpin && !canUseModerationCapability(user, settings, "content-moderation")) return json(res, 403, { error: "Owner admin has not granted content-moderation access" });
    dms[index] = {
      ...dm,
      pinned: !unpin,
      pinnedAt: unpin ? "" : new Date().toISOString(),
      pinnedBy: unpin ? "" : user.username,
    };
    await writeJson(FILES.dms, dms);
    await addSystemLog(unpin ? "dm.unpinned" : "dm.pinned", user.username, { id, secret: Boolean(dm.secret) }, req);
    broadcastDm({ type: "dm:update", dm: dms[index] }, dms[index]);
    return json(res, 200, { dm: dms[index] });
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/messages/")) {
    const id = decodeURIComponent(pathname.split("/").pop() || "");
    const body = await readJsonBody(req);
    const textValue = String(body.text || "").trim().slice(0, 2000);
    if (!textValue) return json(res, 400, { error: "Message cannot be empty" });
    const [messages, rooms] = await Promise.all([readJson(FILES.messages, []), readJson(FILES.rooms, [])]);
    const index = messages.findIndex((entry) => entry.id === id);
    if (index === -1) return json(res, 404, { error: "Message not found" });
    const room = rooms.find((entry) => entry.id === (messages[index].roomId || "main")) || { id: messages[index].roomId || "main" };
    if (!canAccessRoom(room, user)) return json(res, 403, { error: "You do not have access to this message" });
    if (messages[index].user !== user.username && !canModerate(user)) return json(res, 403, { error: "You can edit only your messages" });
    const automodError = await checkAutomod(textValue, user, req);
    if (automodError) return json(res, 400, { error: automodError });
    messages[index] = {
      ...messages[index],
      text: applySlashCommand(textValue),
      editedAt: new Date().toISOString(),
      editedBy: user.username,
    };
    await writeJson(FILES.messages, messages);
    await addSystemLog("message.edited", user.username, { id }, req);
    await broadcastRoomPayload({ type: "message:update", message: messages[index] }, messages[index].roomId || "main", rooms, user);
    return json(res, 200, { message: safeRoomMessage(messages[index], user) });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/messages/")) {
    const settings = await readJson(FILES.settings, {});
    if (!canUseModerationCapability(user, settings, "content-moderation")) return json(res, 403, { error: "Owner admin has not granted content-moderation access" });
    const id = pathname.split("/").pop();
    const [messages, rooms] = await Promise.all([readJson(FILES.messages, []), readJson(FILES.rooms, [])]);
    const removed = messages.find((entry) => entry.id === id);
    if (!removed) return json(res, 404, { error: "Message not found" });
    const room = rooms.find((entry) => entry.id === (removed.roomId || "main")) || { id: removed.roomId || "main" };
    if (!canAccessRoom(room, user)) return json(res, 403, { error: "You do not have access to this message" });
    const next = messages.filter((entry) => entry.id !== id);
    if (next.length === messages.length) return json(res, 404, { error: "Message not found" });
    await writeJson(FILES.messages, next);
    await broadcastRoomPayload({ type: "message:delete", id }, removed.roomId || "main", rooms, user);
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
    if (ownerFailsafeLocked(settings) && body.serverEnabled === true) {
      return json(res, 423, { error: "Use the owner recovery code to unlock the server" });
    }
    const nextServerEnabled =
      typeof body.serverEnabled === "boolean" ? body.serverEnabled : Boolean(settings.serverEnabled);
    const clearProfileUpdate = body.clearProfileUpdate === true;
    const nextRequireProfileUpdate =
      clearProfileUpdate
        ? false
        : typeof body.requireProfileUpdate === "boolean" ? body.requireProfileUpdate : Boolean(settings.requireProfileUpdate);
    const previousProfileUpdateGeneration = String(settings.profileUpdateRequestedAt || "");
    const next = {
      ...settings,
      serverEnabled: nextServerEnabled,
      roomName: String(body.roomName || settings.roomName || "Connectifi").slice(0, 80),
      signupMode: ["open", "request"].includes(String(body.signupMode || settings.signupMode || "").toLowerCase())
        ? String(body.signupMode || settings.signupMode).toLowerCase()
        : DEFAULT_SIGNUP_MODE,
      requireContact: typeof body.requireContact === "boolean" ? body.requireContact : settings.requireContact !== false,
      acceptedEmailDomains: sanitizeAcceptedEmailDomains(body.acceptedEmailDomains !== undefined ? body.acceptedEmailDomains : settings.acceptedEmailDomains || []),
      adminContactEmail: String(body.adminContactEmail || settings.adminContactEmail || "").trim().slice(0, 160),
      passwordResetEnabled: typeof body.passwordResetEnabled === "boolean" ? body.passwordResetEnabled : settings.passwordResetEnabled !== false,
      requireProfileUpdate: nextRequireProfileUpdate,
      profileUpdateRequestedAt: clearProfileUpdate
        ? ""
        : nextRequireProfileUpdate
        ? (body.triggerProfileUpdate || !settings.requireProfileUpdate ? new Date().toISOString() : previousProfileUpdateGeneration || new Date().toISOString())
        : "",
      reportEmails: Array.isArray(body.reportEmails)
        ? body.reportEmails.map((entry) => String(entry || "").trim()).filter(Boolean).slice(0, 4)
        : Array.isArray(settings.reportEmails)
          ? settings.reportEmails.slice(0, 4)
          : REPORT_EMAILS,
      strikeEmails: canOwn(user) && Array.isArray(body.strikeEmails)
        ? body.strikeEmails.map(cleanEmailAddress).filter(Boolean).slice(0, 10)
        : Array.isArray(settings.strikeEmails) ? settings.strikeEmails.map(cleanEmailAddress).filter(Boolean).slice(0, 10) : REPORT_EMAILS,
      nonOwnerAdminFeatures: canOwn(user)
        ? sanitizeNonOwnerAdminFeatures(body.nonOwnerAdminFeatures)
        : sanitizeNonOwnerAdminFeatures(settings.nonOwnerAdminFeatures),
      emailRoutes: sanitizeEmailRoutes(body.emailRoutes && typeof body.emailRoutes === "object" ? body.emailRoutes : settings.emailRoutes || {}),
      emailContacts: sanitizeEmailContacts(body.emailContacts && typeof body.emailContacts === "object" ? body.emailContacts : settings.emailContacts || {}),
      reportRetentionDays: Math.max(1, Math.min(3650, Number(body.reportRetentionDays || settings.reportRetentionDays || 30))),
      chessUrl: sanitizeExternalUrl(body.chessUrl) || sanitizeExternalUrl(settings.chessUrl) || "https://chessverse.co.in/",
      gameLinks: sanitizeGameLinks(body.gameLinks !== undefined ? body.gameLinks : settings.gameLinks || []),
      moderationSettings: {
        ...(settings.moderationSettings || {}),
        ...(body.moderationSettings && typeof body.moderationSettings === "object" ? body.moderationSettings : {}),
        logAccessUsers: canOwn(user)
          ? sanitizeModeratorLogAccessUsers(body.moderationSettings && body.moderationSettings.logAccessUsers)
          : sanitizeModeratorLogAccessUsers(settings.moderationSettings && settings.moderationSettings.logAccessUsers),
        updatedAt: new Date().toISOString(),
        updatedBy: user.username,
      },
      customizations: sanitizeCustomizations({
        ...(settings.customizations || {}),
        ...(body.customizations && typeof body.customizations === "object" ? body.customizations : {}),
        updatedAt: new Date().toISOString(),
        updatedBy: user.username,
      }),
      persistentLogin: sanitizePersistentLogin(body.persistentLogin && typeof body.persistentLogin === "object" ? body.persistentLogin : settings.persistentLogin || {}),
      serviceScale: sanitizeServiceScale(body.serviceScale && typeof body.serviceScale === "object" ? body.serviceScale : settings.serviceScale || {}),
      featureVisibility: sanitizeFeatureVisibility(canOwn(user) && body.featureVisibility && typeof body.featureVisibility === "object" ? body.featureVisibility : settings.featureVisibility || {}),
      secretMessaging: sanitizeSecretMessaging(canOwn(user) && body.secretMessaging && typeof body.secretMessaging === "object" ? body.secretMessaging : settings.secretMessaging || {}),
      paywalls: sanitizePaywalls(canOwn(user) && body.paywalls && typeof body.paywalls === "object" ? body.paywalls : settings.paywalls || {}),
      browserPolicy: sanitizeBrowserPolicy(canOwn(user) && body.browserPolicy && typeof body.browserPolicy === "object" ? body.browserPolicy : settings.browserPolicy || {}),
      shutdownAt: nextServerEnabled ? "" : settings.shutdownAt || new Date().toISOString(),
      shutdownBy: nextServerEnabled ? "" : settings.shutdownBy || user.username,
      shutdownReason: nextServerEnabled ? "" : String(body.shutdownReason || settings.shutdownReason || "Admin shutdown").slice(0, 160),
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    await writeJson(FILES.settings, next);
    broadcastSettings(next);
    let kicked = { sessions: 0, clients: 0 };
    if (!next.serverEnabled) {
      kicked = kickNonShutdownUsers();
      await addSystemLog("server.shutdown", user.username, { kicked, roomName: next.roomName }, req);
    } else if (settings.serverEnabled === false) {
      await addSystemLog("server.restart", user.username, { roomName: next.roomName }, req);
    } else {
      await addSystemLog("server.settings.updated", user.username, { roomName: next.roomName }, req);
    }
    return json(res, 200, { settings: safeSettings(next, user) });
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
    if (index === -1 || !(await verifyPasswordAsync(currentPassword, users[index].passwordHash))) {
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
    return json(res, 200, { users: users.map((entry) => safeUser(entry, user)) });
  }

  if (req.method === "POST" && pathname === "/api/email/test") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const route = sanitizeEmailRouteKey(body.route || "general");
    const contactType = contactTypeForEmailRoute(route);
    const contacts = sanitizeEmailContacts((await readJson(FILES.settings, {})).emailContacts || {});
    const result = await notifyAdminEmails(
      `Connectifi ${emailRouteLabel(route)} test email`,
      [
        `This is a test email from Connectifi for ${emailRouteLabel(route)}.`,
        `Sent by ${user.username} at ${new Date().toISOString()}.`,
        "If you received this, that email route is working.",
      ].join("\n\n"),
      { detailed: true, route, contactType, actionLabel: "Email route test", ctaUrl: publicBaseUrl(req) }
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
  const preferB2 = UPLOAD_PROVIDER === "b2" || UPLOAD_PROVIDER === "backblaze";
  const mustAvoidLocalDisk = cloudStorageRequired() && cloudinaryConfigured() && !preferB2 && UPLOAD_PROVIDER !== "mongodb";
  if (cloudStorageRequired() && !cloudinaryConfigured() && !b2Configured() && !persistence.ready) {
    await addSystemLog("file.upload.fallback", user.username, { name: originalName, reason: "cloud storage missing; using local fallback" }, req);
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

  if (preferB2 && b2Configured()) {
    try {
      const b2File = await uploadLocalFileToB2(storedName, target, fileRecord);
      fileRecord.cloudStorage = "backblaze-b2";
      fileRecord.b2FileId = b2File.fileId || "";
      fileRecord.b2FileName = b2File.fileName || storedName;
      fileRecord.persistence = "disk+backblaze-b2";
      fileRecord.url = `/api/files/${fileRecord.id}/download`;
      inlineEnabled = false;
      inlineChunks = [];
    } catch (error) {
      await addSystemLog("file.upload.failed", user.username, { name: originalName, provider: "backblaze-b2", reason: error.message || "Backblaze B2 upload failed" }, req);
      fileRecord.cloudStorage = "";
      fileRecord.cloudStorageError = error.message || "Backblaze B2 upload failed";
      fileRecord.persistence = inlineEnabled ? "disk+inline" : "disk";
      fileRecord.url = `/uploads/${encodeURIComponent(storedName)}`;
    }
  } else if (cloudinaryConfigured() && UPLOAD_PROVIDER !== "mongodb") {
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
      await addSystemLog("file.upload.failed", user.username, { name: originalName, provider: "cloudinary", reason: error.message || "Cloudinary upload failed" }, req);
      fileRecord.cloudStorage = "";
      fileRecord.cloudStorageError = error.message || "Cloudinary upload failed";
      fileRecord.persistence = inlineEnabled ? "disk+inline" : "disk";
      fileRecord.url = `/uploads/${encodeURIComponent(storedName)}`;
    }
  } else if (persistence.ready) {
    try {
      const cloudFile = await uploadLocalFileToCloud(storedName, target, fileRecord);
      fileRecord.cloudStorage = "mongodb-gridfs";
      fileRecord.cloudFileId = String(cloudFile._id || "");
      fileRecord.persistence = "disk+mongodb-gridfs";
    } catch (error) {
      await addSystemLog("file.upload.failed", user.username, { name: originalName, reason: error.message || "Cloud upload failed" }, req);
      fileRecord.cloudStorage = "";
      fileRecord.cloudStorageError = error.message || "MongoDB/GridFS upload failed";
      fileRecord.persistence = inlineEnabled ? "disk+inline" : "disk";
      fileRecord.url = `/uploads/${encodeURIComponent(storedName)}`;
    }
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
  const releaseAt = canModerate(user) ? normalizeReleaseAt(req.headers["x-file-release-at"]) : "";
  const releaseRoom = canModerate(user) ? String(req.headers["x-file-release-room"] || "").trim().slice(0, 80) : "";
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
    releaseAt,
    releaseRoom,
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

async function authorizeB2() {
  if (!b2Configured()) throw new Error("Backblaze B2 is not configured");
  const auth = Buffer.from(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`).toString("base64");
  const response = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.code || `Backblaze authorization failed (${response.status})`);
  return data;
}

async function resolveB2Bucket(auth) {
  if (B2_BUCKET_ID) return { bucketId: B2_BUCKET_ID, bucketName: B2_BUCKET_NAME };
  const response = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_buckets`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accountId: auth.accountId, bucketName: B2_BUCKET_NAME }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.code || `Backblaze bucket lookup failed (${response.status})`);
  const bucket = (data.buckets || []).find((entry) => entry.bucketName === B2_BUCKET_NAME);
  if (!bucket) throw new Error(`Backblaze bucket "${B2_BUCKET_NAME}" was not found`);
  return bucket;
}

async function getB2UploadUrl(auth, bucketId) {
  const response = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bucketId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.code || `Backblaze upload URL failed (${response.status})`);
  return data;
}

function sha1File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha1");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function uploadLocalFileToB2(storedName, filePath, record) {
  const auth = await authorizeB2();
  const bucket = await resolveB2Bucket(auth);
  const upload = await getB2UploadUrl(auth, bucket.bucketId);
  const stat = await fsp.stat(filePath);
  const sha1 = await sha1File(filePath);
  const fileName = encodeURIComponent(`inner/${storedName}`);
  const uploadUrl = new URL(upload.uploadUrl);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "POST",
        hostname: uploadUrl.hostname,
        path: `${uploadUrl.pathname}${uploadUrl.search}`,
        headers: {
          Authorization: upload.authorizationToken,
          "X-Bz-File-Name": fileName,
          "Content-Type": record.mimeType || "application/octet-stream",
          "Content-Length": stat.size,
          "X-Bz-Content-Sha1": sha1,
          "X-Bz-Info-inner-id": record.id,
          "X-Bz-Info-uploader": encodeURIComponent(record.user || ""),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let data = {};
          try {
            data = JSON.parse(raw || "{}");
          } catch (error) {
            data = {};
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(data.message || data.code || `Backblaze upload failed (${res.statusCode})`));
            return;
          }
          resolve(data);
        });
      }
    );
    req.on("error", reject);
    fs.createReadStream(filePath).on("error", reject).pipe(req);
  });
}

async function uploadBufferToB2(storedName, buffer, record) {
  const tempName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${path.basename(storedName)}`;
  const tempPath = path.join(UPLOAD_DIR, tempName);
  await fsp.writeFile(tempPath, buffer);
  try {
    return await uploadLocalFileToB2(storedName, tempPath, record);
  } finally {
    await fsp.rm(tempPath, { force: true }).catch(() => {});
  }
}

async function proxyB2Upload(req, res, record) {
  if (!record || record.cloudStorage !== "backblaze-b2" || !record.b2FileName) return false;
  const auth = await authorizeB2().catch(() => null);
  if (!auth) return false;
  const b2Url = new URL(`${auth.downloadUrl}/file/${encodeURIComponent(B2_BUCKET_NAME)}/${String(record.b2FileName || "").split("/").map(encodeURIComponent).join("/")}`);
  const requestHeaders = { Authorization: auth.authorizationToken };
  if (req.headers.range) requestHeaders.Range = req.headers.range;
  const upstream = await fetch(b2Url, { headers: requestHeaders }).catch(() => null);
  if (!upstream || !upstream.ok) return false;
  const requestUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const dispositionType = requestUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  const headers = {
    "Content-Type": upstream.headers.get("content-type") || record.mimeType || "application/octet-stream",
    "Content-Disposition": `${dispositionType}; filename="${String(record.originalName || "upload").replaceAll('"', "")}"`,
    "Accept-Ranges": upstream.headers.get("accept-ranges") || "bytes",
    "Cache-Control": record.private ? "no-store" : "private, max-age=60",
  };
  const length = upstream.headers.get("content-length");
  const range = upstream.headers.get("content-range");
  if (length) headers["Content-Length"] = length;
  if (range) headers["Content-Range"] = range;
  res.writeHead(upstream.status === 206 ? 206 : 200, headers);
  if (upstream.body && typeof Readable.fromWeb === "function") Readable.fromWeb(upstream.body).pipe(res);
  else res.end(Buffer.from(await upstream.arrayBuffer()));
  return true;
}

async function deleteB2Upload(record) {
  if (!record || record.cloudStorage !== "backblaze-b2" || !record.b2FileId || !record.b2FileName) return;
  const auth = await authorizeB2();
  const response = await fetch(`${auth.apiUrl}/b2api/v2/b2_delete_file_version`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileName: record.b2FileName, fileId: record.b2FileId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.code || `Backblaze delete failed (${response.status})`);
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

function b2Configured() {
  return Boolean(B2_KEY_ID && B2_APPLICATION_KEY && B2_BUCKET_NAME);
}

function cloudStorageConfigured() {
  return cloudinaryConfigured() || b2Configured();
}

function storageModeLabel() {
  if (b2Configured() && persistence.ready) return "backblaze-b2+mongodb-gridfs";
  if (b2Configured()) return "backblaze-b2";
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
  return REQUIRE_CLOUD_STORAGE;
}

async function handleUpgrade(req, socket) {
  socket.on("error", () => {});
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
  if (settings.serverEnabled === false && !canAccessWhileServerLocked(user, settings)) {
    socket.write("HTTP/1.1 423 Locked\r\n\r\n");
    socket.destroy();
    return;
  }

  if (wsClients.size >= WS_MAX_CLIENTS && !canManage(user)) {
    socket.write("HTTP/1.1 503 Service Unavailable\r\nRetry-After: 10\r\n\r\n");
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
  if (socket.setNoDelay) socket.setNoDelay(true);
  if (socket.setKeepAlive) socket.setKeepAlive(true, 30000);
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
    lastPongAt: Date.now(),
    missedHeartbeats: 0,
  };
  wsClients.set(id, client);
  socket.removeAllListeners("error");
  socket.on("error", () => removeClient(id));

  sendWs(client, {
    type: "hello",
    clientId: id,
    user: safeUser(user),
    peers: peerList(id, user, await readJson(FILES.users, []), await readJson(FILES.friends, { requests: [], friendships: [] })),
    presence: presenceList(await readJson(FILES.profiles, {}), user, await readJson(FILES.users, []), await readJson(FILES.friends, { requests: [], friendships: [] })),
  });
  await broadcastPeerJoined(client, id);

  socket.on("data", (chunk) => handleWsData(client, chunk));
  socket.on("close", () => removeClient(id));
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
      if (!sendFrame(client.socket, Buffer.alloc(0), 0xA, client)) closeWs(client);
      continue;
    }

    if (opcode === 0xA) {
      client.lastPongAt = Date.now();
      client.missedHeartbeats = 0;
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
      closeWs(client);
      return;
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
    return broadcastPresenceUpdate(profiles);
  }

  if (message.type === "typing") {
    client.typingRoomId = message.active ? String(message.roomId || "main").slice(0, 80) : "";
    return broadcastRoomPayload({
      type: "typing",
      roomId: client.typingRoomId,
      username: client.username,
      active: Boolean(message.active),
    }, client.typingRoomId || "main", await readJson(FILES.rooms, []), client, client.id);
  }

  const settings = await readJson(FILES.settings, {});
  if (
    settings.serverEnabled === false &&
    !canAccessWhileServerLocked(client, settings) &&
    (message.type === "signal" ||
      message.type === "screen:status" ||
      message.type === "screen:viewer-ready" ||
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
  if (screenFeatureError && (message.type === "signal" || message.type === "screen:status" || message.type === "screen:viewer-ready" || message.type === "screen:request")) {
    return sendWs(client, { type: "error", error: screenFeatureError });
  }

  if (message.type === "signal") {
    const roomInfo = await resolveRealtimeRoom(message.roomId || "screen:global", client);
    const target = getRealtimeClient(String(message.target || ""));
    if (!target) return;
    if (!canTargetRealtimeRoom(roomInfo, target)) return sendWs(client, { type: "error", error: "Target is not in this call" });
    return deliverRealtime(target, {
      type: "signal",
      from: client.id,
      fromUser: client.username,
      roomId: roomInfo.roomId,
      signal: message.signal,
    });
  }

  if (message.type === "screen:request" || message.type === "location:request") {
    if (!canManage(client)) return sendWs(client, { type: "error", error: "Admin access required" });
    const target = getRealtimeClient(String(message.target || ""));
    if (!target) return sendWs(client, { type: "error", error: "User is not online" });
    return deliverRealtime(target, {
      type: message.type,
      from: client.id,
      fromUser: client.username,
    });
  }

  if (message.type === "location:share") {
    const target = getRealtimeClient(String(message.target || ""));
    if (!target) return;
    return deliverRealtime(target, {
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
    const target = getRealtimeClient(String(message.target || ""));
    if (!target) return;
    if (!canTargetRealtimeRoom(roomInfo, target) || target.voiceRoomId !== roomInfo.roomId) {
      return sendWs(client, { type: "error", error: "Target is not in this call" });
    }
    return deliverRealtime(target, {
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

  if (message.type === "screen:viewer-ready") {
    const roomInfo = await resolveRealtimeRoom(message.roomId || "screen:global", client);
    const target = getRealtimeClient(String(message.target || ""));
    if (!target || !canTargetRealtimeRoom(roomInfo, target) || target.screenRoomId !== roomInfo.roomId) return;
    return deliverRealtime(target, {
      type: "screen:viewer-ready",
      from: client.id,
      fromUser: client.username,
      roomId: roomInfo.roomId,
    });
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

async function handleHttpRealtimeMessage(client, message) {
  if (!message || typeof message !== "object") return;
  client.lastSeenAt = Date.now();

  if (message.type === "ping") {
    return deliverRealtime(client, { type: "pong", at: Date.now() });
  }

  if (message.type === "client:network") {
    client.network = sanitizeClientNetwork(message.network);
    await addSystemLog("client.network", client.username, { network: client.network, transport: "http" });
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
    return broadcastPresenceUpdate(profiles);
  }

  if (message.type === "typing") {
    client.typingRoomId = message.active ? String(message.roomId || "main").slice(0, 80) : "";
    return broadcastRoomPayload({
      type: "typing",
      roomId: client.typingRoomId,
      username: client.username,
      active: Boolean(message.active),
    }, client.typingRoomId || "main", await readJson(FILES.rooms, []), client, client.id);
  }

  const settings = await readJson(FILES.settings, {});
  if (
    settings.serverEnabled === false &&
    !canAccessWhileServerLocked(client, settings) &&
    (message.type === "signal" ||
      message.type === "screen:status" ||
      message.type === "screen:viewer-ready" ||
      message.type === "screen:request" ||
      message.type === "call:invite" ||
      message.type === "soundboard:play" ||
      message.type === "voice:join" ||
      message.type === "voice:state" ||
      message.type === "voice:leave" ||
      message.type === "voice:signal")
  ) {
    return deliverRealtime(client, { type: "error", error: "Server is shut down. Only admin, HMD, and dev access is open right now." });
  }

  const screenFeatureError = await featureGateError(settings, "screen", client);
  if (screenFeatureError && (message.type === "signal" || message.type === "screen:status" || message.type === "screen:viewer-ready" || message.type === "screen:request")) {
    return deliverRealtime(client, { type: "error", error: screenFeatureError });
  }

  if (message.type === "signal") {
    const roomInfo = await resolveRealtimeRoom(message.roomId || "screen:global", client);
    const target = getRealtimeClient(String(message.target || ""));
    if (!target) return;
    if (!canTargetRealtimeRoom(roomInfo, target)) return deliverRealtime(client, { type: "error", error: "Target is not in this call" });
    return deliverRealtime(target, {
      type: "signal",
      from: client.id,
      fromUser: client.username,
      roomId: roomInfo.roomId,
      signal: message.signal,
    });
  }

  if (message.type === "voice:join") {
    const voiceFeatureError = await featureGateError(settings, "voice", client);
    if (voiceFeatureError) return deliverRealtime(client, { type: "error", error: voiceFeatureError });
    const roomInfo = await resolveRealtimeRoom(message.roomId || "lobby", client);
    client.voiceRoomId = roomInfo.roomId;
    client.muted = Boolean(message.muted);
    client.deafened = Boolean(message.deafened);
    client.videoEnabled = Boolean(message.videoEnabled);
    client.cameraOff = Boolean(message.cameraOff);
    await addSystemLog("voice.join", client.username, { roomId: client.voiceRoomId, videoEnabled: client.videoEnabled, transport: "http" });
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
    await addSystemLog("voice.leave", client.username, { roomId: previousRoom, transport: "http" });
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
    const target = getRealtimeClient(String(message.target || ""));
    if (!target) return;
    if (!canTargetRealtimeRoom(roomInfo, target) || target.voiceRoomId !== roomInfo.roomId) {
      return deliverRealtime(client, { type: "error", error: "Target is not in this call" });
    }
    return deliverRealtime(target, {
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
    if (voiceFeatureError) return deliverRealtime(client, { type: "error", error: voiceFeatureError });
    const roomInfo = await resolveRealtimeRoom(message.roomId || client.voiceRoomId || "lobby", client);
    const mode = message.mode === "video" ? "video" : "voice";
    await addSystemLog("call.invite", client.username, { roomId: roomInfo.roomId, mode, transport: "http" });
    return broadcastRealtimeRoom({
      type: "call:invite",
      roomId: roomInfo.roomId,
      roomLabel: String(message.roomLabel || roomInfo.label || "call").slice(0, 120),
      mode,
      from: client.id,
      fromUser: client.username,
    }, roomInfo, client.id);
  }

  if (message.type === "screen:viewer-ready") {
    const roomInfo = await resolveRealtimeRoom(message.roomId || "screen:global", client);
    const target = getRealtimeClient(String(message.target || ""));
    if (!target || !canTargetRealtimeRoom(roomInfo, target) || target.screenRoomId !== roomInfo.roomId) return;
    return deliverRealtime(target, {
      type: "screen:viewer-ready",
      from: client.id,
      fromUser: client.username,
      roomId: roomInfo.roomId,
    });
  }

  if (message.type === "screen:status") {
    const roomInfo = await resolveRealtimeRoom(message.roomId || "screen:global", client);
    client.sharing = Boolean(message.sharing);
    client.screenRoomId = client.sharing ? roomInfo.roomId : "";
    await addSystemLog(client.sharing ? "screen.share.started" : "screen.share.stopped", client.username, { roomId: roomInfo.roomId, transport: "http" });
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

function startWsHeartbeat() {
  clearInterval(wsHeartbeatTimer);
  wsHeartbeatTimer = setInterval(() => {
    const now = Date.now();
    for (const client of Array.from(wsClients.values())) {
      if (!client.socket || client.socket.destroyed) {
        removeClient(client.id);
        continue;
      }
      if (now - Number(client.lastPongAt || client.connectedAt || now) > 90000) {
        client.missedHeartbeats = Number(client.missedHeartbeats || 0) + 1;
      }
      if (client.missedHeartbeats >= 3) {
        closeWs(client);
        continue;
      }
      if (!sendFrame(client.socket, Buffer.alloc(0), 0x9, client)) {
        closeWs(client);
      }
    }
  }, 20000);
  if (typeof wsHeartbeatTimer.unref === "function") wsHeartbeatTimer.unref();
}

function realtimeClients() {
  return [...wsClients.values(), ...httpRealtimeClients.values()];
}

function getRealtimeClient(id) {
  return wsClients.get(id) || httpRealtimeClients.get(id) || null;
}

function deliverRealtime(client, payload) {
  if (!client || !payload) return;
  if (wsClients.has(client.id)) return sendWs(client, payload);
  enqueueHttpRealtimeEvent(client.id, payload);
}

function enqueueHttpRealtimeEvent(targetId, payload) {
  pruneHttpRealtime();
  httpRealtimeEvents.push({
    id: crypto.randomUUID(),
    targetId,
    createdAt: Date.now(),
    payload,
  });
  while (httpRealtimeEvents.length > 2000) httpRealtimeEvents.shift();
}

function pruneHttpRealtime() {
  const now = Date.now();
  for (const [id, client] of httpRealtimeClients) {
    if (now - Number(client.lastSeenAt || 0) > HTTP_REALTIME_TTL_MS) {
      httpRealtimeClients.delete(id);
      if (client.voiceRoomId) {
        resolveRealtimeRoom(client.voiceRoomId, client, { allowAfterLeave: true })
          .then((roomInfo) => broadcastRealtimeRoom({ type: "voice:update", roomId: client.voiceRoomId, peers: voicePeers(client.voiceRoomId) }, roomInfo))
          .catch(() => {});
      }
    }
  }
  const cutoff = now - HTTP_REALTIME_EVENT_TTL_MS;
  while (httpRealtimeEvents.length && httpRealtimeEvents[0].createdAt < cutoff) httpRealtimeEvents.shift();
}

function upsertHttpRealtimeClient(user, body = {}, req) {
  pruneHttpRealtime();
  const requestedId = sanitizeRealtimeClientId(body.clientId);
  const id = requestedId || `http_${crypto.randomUUID()}`;
  const existing = httpRealtimeClients.get(id);
  const nowIso = new Date().toISOString();
  const client = existing && existing.username === user.username ? existing : {
    id,
    username: user.username,
    role: user.role,
    ip: getClientIp(req),
    device: deviceSignature(req),
    network: {},
    connectedAt: nowIso,
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
    httpFallback: true,
  };
  client.role = user.role;
  client.ip = getClientIp(req);
  client.device = deviceSignature(req);
  client.lastSeenAt = Date.now();
  httpRealtimeClients.set(id, client);
  return client;
}

function sanitizeRealtimeClientId(value) {
  const id = String(value || "").trim();
  return /^[a-zA-Z0-9:_-]{8,100}$/.test(id) ? id : "";
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

function peerList(exceptId, viewer, users = [], friends = { friendships: [] }) {
  pruneHttpRealtime();
  return realtimeClients()
    .filter((client) => client.id !== exceptId)
    .filter((client) => canSeeOnlineUser(viewer, client, users, friends))
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
  pruneHttpRealtime();
  return realtimeClients()
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
  pruneHttpRealtime();
  for (const client of realtimeClients()) {
    if (client.id !== exceptId) deliverRealtime(client, payload);
  }
}

async function broadcastRoomMessage(message, rooms = []) {
  const roomId = String(message && message.roomId || "main");
  await broadcastRoomPayload({ type: "message:new", message }, roomId, rooms);
}

async function broadcastRoomPayload(payload, roomId, rooms = [], actor = null, exceptId = "") {
  const cleanRoomId = String(roomId || "main");
  const room = (rooms || []).find((entry) => String(entry.id || "main") === cleanRoomId) || { id: cleanRoomId };
  if (actor && !canManage(actor) && !canAccessRoom(room, actor)) return;
  pruneHttpRealtime();
  for (const client of realtimeClients()) {
    if (client.id === exceptId) continue;
    if (!canManage(client) && !canAccessRoom(room, client)) continue;
    const safePayload = payload && payload.message
      ? { ...payload, message: safeRoomMessage(payload.message, client) }
      : payload;
    deliverRealtime(client, safePayload);
  }
}

async function broadcastPeerJoined(joinedClient, exceptId) {
  const [users, friends] = await Promise.all([
    readJson(FILES.users, []),
    readJson(FILES.friends, { requests: [], friendships: [] }),
  ]);
  for (const client of realtimeClients()) {
    if (client.id === exceptId) continue;
    if (canSeeOnlineUser(client, joinedClient, users, friends)) {
      deliverRealtime(client, { type: "peer:joined", peer: peerSummary(joinedClient) });
    }
  }
}

async function broadcastPresenceUpdate(profiles) {
  const [users, friends] = await Promise.all([
    readJson(FILES.users, []),
    readJson(FILES.friends, { requests: [], friendships: [] }),
  ]);
  for (const client of realtimeClients()) {
    deliverRealtime(client, { type: "presence:update", presence: presenceList(profiles, client, users, friends) });
  }
}

async function broadcastProfileUpdate(profiles, users) {
  const [friends, rooms, messages, dms] = await Promise.all([
    readJson(FILES.friends, { requests: [], friendships: [] }),
    readJson(FILES.rooms, []),
    readJson(FILES.messages, []),
    readJson(FILES.dms, []),
  ]);
  for (const client of realtimeClients()) {
    const accessibleRoomIds = new Set((rooms || []).filter((room) => canAccessRoom(room, client)).map((room) => room.id || "main"));
    const visibleMessages = (messages || [])
      .map((message) => ({ ...message, roomId: message.roomId || "main" }))
      .filter((message) => canManage(client) || accessibleRoomIds.has(message.roomId || "main"))
      .map((message) => safeRoomMessage(message, client));
    const visibleDms = (canManage(client)
      ? dms
      : (dms || []).filter((entry) => Array.isArray(entry.participants) && entry.participants.includes(client.username)))
      .filter((entry) => !entry.secret)
      .map((entry) => safeDm(entry, client));
    const visiblePeople = statePeopleForUser(users, profiles, client, friends, visibleMessages, visibleDms);
    deliverRealtime(client, { type: "profiles:update", profiles: safeProfiles(profiles, visiblePeople, client) });
  }
}

function broadcastRoomsUpdate(rooms) {
  for (const client of wsClients.values()) {
    sendWs(client, {
      type: "rooms:update",
      rooms: safeRoomsForUser(rooms, client),
    });
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
  pruneHttpRealtime();
  for (const client of realtimeClients()) {
    if (client.id === exceptId) continue;
    if (roomInfo.participants.has(client.username) || canManage(client)) deliverRealtime(client, payload);
  }
}

function broadcastManagers(payload) {
  for (const client of wsClients.values()) {
    if (canManage(client)) sendWs(client, payload);
  }
}

function broadcastManagerLogs(type, field, entries) {
  for (const client of wsClients.values()) {
    if (canManage(client)) sendWs(client, { type, [field]: safeLogEntries(entries, client) });
  }
}

function broadcastSettings(settings) {
  pruneHttpRealtime();
  for (const client of realtimeClients()) {
    deliverRealtime(client, { type: "state:update", settings: safeSettings(settings, client) });
  }
}

function broadcastSecretMessage(payload, settings) {
  const allowed = new Set(sanitizeSecretMessaging(settings.secretMessaging || {}).allowedUsers);
  const sender = String(payload && payload.message && payload.message.user || "").toLowerCase();
  for (const client of realtimeClients()) {
    const username = String(client.username || "").toLowerCase();
    if (canOwn(client) || username === sender || allowed.has(username)) {
      deliverRealtime(client, {
        ...payload,
        message: safeSecretMessages([payload.message], client, settings)[0],
      });
    }
  }
}

function broadcastDm(payload, dm) {
  const participants = new Set(Array.isArray(dm.participants) ? dm.participants : [dm.from, dm.to]);
  for (const client of wsClients.values()) {
    if ((dm.secret ? canOwn(client) : canManage(client)) || participants.has(client.username)) sendWs(client, payload);
  }
}

async function broadcastReceiptContext(payload, context, targetId, user) {
  if (context === "messages") {
    const rooms = await readJson(FILES.rooms, []);
    await broadcastRoomPayload(payload, targetId || "main", rooms, user);
    return;
  }
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
  try {
    if (!sendFrame(client.socket, Buffer.from(JSON.stringify(payload), "utf8"), 0x1, client)) {
      closeWs(client);
    }
  } catch (error) {
    closeWs(client);
  }
}

function sendFrame(socket, payload, opcode, client) {
  if (!socket || socket.destroyed || !socket.writable || socket.writableEnded) return false;
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
  try {
    return safeWriteSocket(socket, Buffer.concat([header, payload]), client);
  } catch (error) {
    if (client) closeWs(client);
    return false;
  }
}

function safeWriteSocket(socket, data, client) {
  if (!socket || socket.destroyed || !socket.writable || socket.writableEnded) return false;
  const onError = (error) => {
    if (client) closeWs(client);
  };
  try {
    socket.write(data, (error) => {
      if (error) onError(error);
    });
    return !socket.destroyed;
  } catch (error) {
    onError(error);
    return false;
  }
}

function closeWs(client) {
  if (client.socket && !client.socket.destroyed) {
    try {
      client.socket.end();
    } catch (error) {
      client.socket.destroy();
    }
  }
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

function kickNonOwnerFailsafeUsers() {
  let sessionsKicked = 0;
  let clientsKicked = 0;

  for (const [token, session] of sessions) {
    if (!canOwn(session)) {
      sessions.delete(token);
      sessionsKicked += 1;
    }
  }

  for (const client of Array.from(wsClients.values())) {
    if (!canOwn(client)) {
      sendWs(client, {
        type: "server:shutdown",
        error: "The owner recovery lock is active.",
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
  return {
    username: session.username,
    role: effectiveRole(session),
    tempAdminUntil: session.tempAdminUntil || "",
    tempAdminPreviousRole: session.tempAdminPreviousRole || "",
    email: session.email || "",
    phone: session.phone || "",
    grade: normalizeGrade(session.grade || ""),
    contact: session.contact || "",
  };
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

function applySecurityHeaders(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(self), camera=(self), microphone=(self), display-capture=(self), payment=()");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'self' ws: wss: https:; frame-src 'self' https: http:");
  if (isHttpsRequest(req)) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}

function requiresCsrfProtection(req) {
  return !["GET", "HEAD", "OPTIONS"].includes(String(req.method || "").toUpperCase());
}

function isSameOriginRequest(req) {
  const requestHost = String(req.headers.host || "").toLowerCase();
  const source = String(req.headers.origin || req.headers.referer || "").trim();
  if (!source) return true;
  try {
    return new URL(source).host.toLowerCase() === requestHost;
  } catch (error) {
    return false;
  }
}

function loginRateKey(req, username) {
  return `${normalizeIpAddress(getClientIp(req)) || "unknown"}:${normalizeUsername(username) || "unknown"}`;
}

function checkLoginRate(req, username) {
  const entry = loginRateLimits.get(loginRateKey(req, username));
  const now = Date.now();
  if (!entry || entry.blockedUntil <= now) return { retryAfterSeconds: 0 };
  return { retryAfterSeconds: Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000)) };
}

function registerLoginFailure(req, username) {
  const key = loginRateKey(req, username);
  const now = Date.now();
  const previous = loginRateLimits.get(key);
  const withinWindow = previous && now - previous.firstAttemptAt <= 15 * 60 * 1000;
  const failures = (withinWindow ? previous.failures : 0) + 1;
  const cooldownMs = failures >= 8 ? 15 * 60 * 1000 : failures >= 5 ? 60 * 1000 : 0;
  loginRateLimits.set(key, { firstAttemptAt: withinWindow ? previous.firstAttemptAt : now, failures, blockedUntil: now + cooldownMs });
}

function clearLoginFailures(req, username) {
  loginRateLimits.delete(loginRateKey(req, username));
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

function safeUser(user, viewer = null) {
  const ownerView = canOwn(viewer);
  const selfView = Boolean(viewer && String(viewer.username || "").toLowerCase() === String(user.username || "").toLowerCase());
  const safe = {
    username: user.username,
    role: effectiveRole(user),
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
    contact: ownerView || selfView ? user.contact || "" : "",
    email: ownerView || selfView ? user.email || "" : "",
    phone: ownerView || selfView ? user.phone || "" : "",
    grade: normalizeGrade(user.grade || ""),
    gradeUpdatedAt: user.gradeUpdatedAt || "",
    contactUpdatedAt: user.contactUpdatedAt || "",
    mutedUntil: user.mutedUntil || "",
    muted: isUserMuted(user),
    shadowMuted: Boolean(user.shadowMuted),
    strikeCount: Array.isArray(user.strikes) ? user.strikes.length : 0,
    strikes: canModerate(viewer) || ownerView
      ? (Array.isArray(user.strikes) ? user.strikes.slice(-20).map((strike) => ({
        id: String(strike.id || ""),
        issuedBy: String(strike.issuedBy || ""),
        reason: String(strike.reason || ""),
        createdAt: String(strike.createdAt || ""),
      })) : [])
      : [],
    tempAdminUntil: user.tempAdminUntil || "",
    tempAdminPreviousRole: user.tempAdminPreviousRole || "",
  };
  if (ownerView) {
    safe.lastLoginAt = user.lastLoginAt || "";
    safe.lastLoginIp = user.lastLoginIp || "";
    safe.lastLoginDevice = user.lastLoginDevice || "";
    safe.lastLoginApproximateLocation = user.lastLoginApproximateLocation || null;
    safe.sourceIp = user.sourceIp || "";
    safe.sourceDevice = user.sourceDevice || "";
    safe.loginHistory = Array.isArray(user.loginHistory) ? user.loginHistory.slice(0, 10) : [];
    safe.mostLoggedInIp = mostLoggedInIp(user.loginIpCounts, safe.loginHistory);
  }
  return safe;
}

function mostLoggedInIp(counts, history) {
  const entries = counts && typeof counts === "object" ? Object.entries(counts) : [];
  if (entries.length) {
    entries.sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0));
    return String(entries[0][0] || "");
  }
  return history && history[0] ? String(history[0].ip || "") : "";
}

function publicUser(user, profile = {}) {
  return {
    username: user.username,
    role: effectiveRole(user),
    banned: isUserBanned(user),
    displayName: profile.displayName || user.username,
    avatarUrl: profile.avatarUrl || "",
    bannerUrl: profile.bannerUrl || "",
    badges: normalizeBadgeList(profile.badges),
    customStatus: profile.customStatus || "",
    status: profile.invisible ? "offline" : normalizePresenceStatus(profile.status || "offline"),
    grade: normalizeGrade(user.grade || profile.grade || ""),
  };
}

function statePeopleForUser(users, profiles, viewer, friends = { friendships: [] }, messages = [], dms = []) {
  if (canOwn(viewer)) return (users || []).map((entry) => publicUser(entry, profiles[entry.username]));
  const visible = new Set([normalizeUsername(viewer && viewer.username)]);
  for (const friendship of friends.friendships || []) {
    if (friendPair(friendship, viewer.username, friendship.from)) visible.add(normalizeUsername(friendship.from));
    if (friendPair(friendship, viewer.username, friendship.to)) visible.add(normalizeUsername(friendship.to));
  }
  for (const message of messages || []) {
    visible.add(normalizeUsername(message.user));
  }
  for (const dm of dms || []) {
    for (const participant of dm.participants || []) visible.add(normalizeUsername(participant));
    visible.add(normalizeUsername(dm.from));
    visible.add(normalizeUsername(dm.to));
  }
  return (users || [])
    .filter((entry) => {
      const username = normalizeUsername(entry && entry.username);
      if (!username) return false;
      if (visible.has(username)) return true;
      return friendCandidateAllowed(viewer, entry, "", profiles[entry.username]);
    })
    .map((entry) => publicUser(entry, profiles[entry.username]));
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
    grade: "",
    gradeUpdatedAt: "",
    contactUpdatedAt: "",
    theme: "system",
    visualStyle: "forest",
    themeImageUrl: "",
    schedules: [],
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
    grade: normalizeGrade(profile.grade || ""),
    gradeUpdatedAt: profile.gradeUpdatedAt || "",
    contactUpdatedAt: profile.contactUpdatedAt || "",
    status: normalizePresenceStatus(profile.status),
    invisible: Boolean(profile.invisible),
    theme: normalizeRoomTheme(profile.theme),
    visualStyle: normalizeVisualStyle(profile.visualStyle),
    themeImageUrl: normalizeOptionalUrl(profile.themeImageUrl),
    schedules: sanitizeProfileSchedules(profile.schedules),
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
    const ownProfile = viewer && viewer.username === user.username;
    if (ownProfile || canOwn(viewer)) {
      result[user.username] = {
        ...profile,
        status: profile.invisible && !ownProfile ? "offline" : profile.status,
        invisible: ownProfile ? profile.invisible : false,
      };
      continue;
    }
    result[user.username] = {
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bannerUrl: profile.bannerUrl,
      badges: profile.badges,
      customStatus: profile.customStatus,
      status: profile.invisible ? "offline" : profile.status,
      grade: profile.grade,
    };
  }
  return result;
}

function safeLogEntries(entries, viewer) {
  if (canOwn(viewer)) return Array.isArray(entries) ? entries : [];
  return (Array.isArray(entries) ? entries : []).map((entry) => safeLogEntry(entry));
}

function safeLogEntry(entry = {}) {
  const safe = {};
  for (const field of ["id", "actor", "action", "target", "note", "createdAt"]) {
    if (entry[field] !== undefined) safe[field] = entry[field];
  }
  if (entry.details && typeof entry.details === "object") {
    const details = {};
    for (const [key, value] of Object.entries(entry.details)) {
      const lower = String(key || "").toLowerCase();
      if (
        lower.includes("email") ||
        lower.includes("phone") ||
        lower.includes("ip") ||
        lower.includes("device") ||
        lower.includes("token") ||
        lower.includes("password") ||
        lower.includes("secret") ||
        lower.includes("authorization") ||
        lower.includes("cookie") ||
        lower.includes("location")
      ) {
        details[key] = "[redacted]";
      } else if (Array.isArray(value)) {
        details[key] = value.slice(0, 20).map((item) => typeof item === "string" ? item.slice(0, 120) : item);
      } else if (value && typeof value === "object") {
        details[key] = "[object]";
      } else {
        details[key] = typeof value === "string" ? value.slice(0, 180) : value;
      }
    }
    safe.details = details;
  }
  return safe;
}

function presenceList(profiles, viewer, users = [], friends = { friendships: [] }) {
  const online = new Map();
  for (const client of realtimeClients()) {
    if (client.invisible && (!viewer || viewer.username !== client.username)) continue;
    if (!canSeeOnlineUser(viewer, client, users, friends)) continue;
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

function friendGradeAllowed(user, recipient, query) {
  const userGrade = normalizeGrade(user.grade || "");
  const recipientGrade = normalizeGrade(recipient.grade || "");
  if (userGrade && recipientGrade && userGrade === recipientGrade) return true;
  return exactFriendUsernameMatch(recipient, query);
}

function friendCandidateAllowed(user, candidate, query, profile = {}) {
  const userGrade = normalizeGrade(user.grade || "");
  const candidateGrade = normalizeGrade(candidate.grade || profile.grade || "");
  const gradeSearch = String(query || "").trim().toLowerCase().match(/^grade:([\w-]+)$/);
  if (gradeSearch) {
    const requestedGrade = normalizeGrade(gradeSearch[1]);
    if (!requestedGrade || candidateGrade !== requestedGrade) return false;
    return canOwn(user) || (userGrade && userGrade === candidateGrade);
  }
  if (userGrade && candidateGrade && userGrade === candidateGrade) {
    if (!query) return true;
    const haystack = [
      candidate.username,
      profile.displayName,
      candidate.role,
      candidateGrade,
    ].join(" ").toLowerCase();
    return haystack.includes(String(query).trim().toLowerCase());
  }
  return exactFriendUsernameMatch(candidate, query);
}

function exactFriendUsernameMatch(candidate, query) {
  const text = String(query || "").trim().toLowerCase();
  if (!text) return false;
  const username = String(candidate.username || "").trim().toLowerCase();
  return text === username;
}

function canSeeOnlineUser(viewer, target, users = [], friends = { friendships: [] }) {
  if (!viewer || !target) return false;
  if (String(viewer.username || "").toLowerCase() === String(target.username || "").toLowerCase()) return true;
  if (canManage(viewer)) return true;
  const targetUser = users.find((entry) => String(entry.username || "").toLowerCase() === String(target.username || "").toLowerCase()) || target;
  const viewerGrade = normalizeGrade(viewer.grade || "");
  const targetGrade = normalizeGrade(targetUser.grade || "");
  if (viewerGrade && targetGrade && viewerGrade === targetGrade) return true;
  return areFriends(friends, viewer.username, target.username);
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

function uniqueInviteCode(invites, requestedCode) {
  const requested = String(requestedCode || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 40);
  const existing = new Set((invites || []).map((invite) => String(invite.code || "").toLowerCase()));
  if (requested.length >= 4 && !existing.has(requested.toLowerCase())) return requested;
  let code = "";
  do {
    code = crypto.randomBytes(8).toString("hex");
  } while (existing.has(code.toLowerCase()));
  return code;
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

function safeRoomsForUser(rooms, user) {
  return (rooms || []).filter((room) => canAccessRoom(room, user)).map(safeRoom);
}

function effectivePersistentLogin(user, settings, rooms = []) {
  return persistentLoginReason(user, settings, rooms) !== "not matched";
}

function persistentLoginReason(user, settings, rooms = []) {
  if (!user) return "not matched";
  if (user.allowPersistentLogin) return "per-account enabled";
  const rules = sanitizePersistentLogin((settings || {}).persistentLogin || {});
  if (rules.defaultEnabled) return "default enabled";
  const grade = normalizeGrade(user.grade || "");
  const role = normalizeRole(user.role || "member");
  if (grade && rules.grades.includes(grade)) return `grade ${grade}`;
  if (role && rules.roles.includes(role)) return `role ${role}`;
  const roomRules = new Set(rules.rooms);
  const inMatchedRoom = (rooms || []).some((room) => {
    const names = [room.id, room.name, room.category].map((entry) => String(entry || "").toLowerCase()).filter(Boolean);
    if (!names.some((name) => roomRules.has(name))) return false;
    return room.createdBy === user.username ||
      normalizeUsernameList(room.allowedUsers).includes(user.username) ||
      normalizeUsernameList(room.moderators).includes(user.username);
  });
  return inMatchedRoom ? "room rule" : "not matched";
}

function canAccessRoom(room, user) {
  if (!room || !user) return false;
  if (room.id === "main" || canManage(user) || canModerate(user)) return true;
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

function canAccessFileRecord(file, user, rooms = []) {
  if (!file || !user) return !file || !file.private;
  if (canManage(user) || file.user === user.username) return true;
  const releaseAt = Date.parse(file.releaseAt || "");
  if (Number.isFinite(releaseAt) && releaseAt > Date.now()) return false;
  if (file.private) return false;
  if (!file.releaseRoom) return true;
  const room = (rooms || []).find((entry) => entry.id === file.releaseRoom || entry.name === file.releaseRoom);
  return room ? canAccessRoom(room, user) : false;
}

function canAccessSecretMessaging(settings, user) {
  if (!user) return false;
  if (canOwn(user)) return true;
  const allowed = sanitizeSecretMessaging(settings.secretMessaging || {}).allowedUsers;
  return allowed.includes(String(user.username || "").toLowerCase());
}

function safeSecretMessages(messages, user, settings = {}) {
  if (!user) return [];
  const allowed = canAccessSecretMessaging(settings, user);
  return (messages || [])
    .filter((message) => canOwn(user) || allowed || message.user === user.username)
    .map((message) => ({
      id: message.id,
      text: message.text,
      user: message.user,
      attachment: message.attachment || null,
      reactions: message.reactions || {},
      createdAt: message.createdAt || "",
      ...(canOwn(user) ? { sourceIp: message.sourceIp || "", sourceAgent: message.sourceAgent || "" } : {}),
    }));
}

function safeSecretDms(dms, user, settings = {}) {
  if (!user) return [];
  return (dms || [])
    .filter((dm) => Boolean(dm && dm.secret))
    .filter((dm) => canOwn(user) || (Array.isArray(dm.participants) && dm.participants.includes(user.username)))
    .map((dm) => safeDm(dm, user));
}

function safeDm(dm, viewer) {
  const safe = {
    id: String(dm.id || ""),
    kind: String(dm.kind || "direct"),
    from: String(dm.from || ""),
    to: String(dm.to || ""),
    groupId: String(dm.groupId || ""),
    groupName: String(dm.groupName || ""),
    participants: Array.isArray(dm.participants) ? dm.participants.map((entry) => String(entry || "")).filter(Boolean).slice(0, 100) : [],
    text: String(dm.text || ""),
    attachment: dm.attachment || null,
    reactions: dm.reactions && typeof dm.reactions === "object" ? dm.reactions : {},
    pinned: Boolean(dm.pinned),
    pinnedAt: String(dm.pinnedAt || ""),
    pinnedBy: String(dm.pinnedBy || ""),
    createdAt: String(dm.createdAt || ""),
    editedAt: String(dm.editedAt || ""),
    status: String(dm.status || ""),
    localId: String(dm.localId || ""),
    secret: Boolean(dm.secret),
  };
  if (canOwn(viewer)) {
    safe.sourceIp = String(dm.sourceIp || "");
    safe.sourceHost = String(dm.sourceHost || "");
    safe.sourceAgent = String(dm.sourceAgent || "");
    safe.sourceDevice = String(dm.sourceDevice || "");
    safe.approximateLocation = dm.approximateLocation || null;
  }
  return safe;
}

function safeFileRecords(files, user, rooms = []) {
  return (files || [])
    .filter((file) => canAccessFileRecord(file, user, rooms))
    .map((file) => safeFileRecord(file, user));
}

function safeRoomMessage(message, viewer) {
  const safe = {
    id: String(message.id || ""),
    roomId: String(message.roomId || "main"),
    parentId: String(message.parentId || ""),
    text: String(message.text || ""),
    attachment: message.attachment || null,
    mentions: Array.isArray(message.mentions) ? message.mentions.map((entry) => String(entry || "")).filter(Boolean).slice(0, 50) : [],
    reactions: message.reactions && typeof message.reactions === "object" ? message.reactions : {},
    user: String(message.user || ""),
    status: String(message.status || ""),
    localId: String(message.localId || ""),
    pinned: Boolean(message.pinned),
    pinnedAt: String(message.pinnedAt || ""),
    pinnedBy: String(message.pinnedBy || ""),
    createdAt: String(message.createdAt || ""),
    editedAt: String(message.editedAt || ""),
  };
  if (canOwn(viewer)) {
    safe.sourceIp = String(message.sourceIp || "");
    safe.sourceHost = String(message.sourceHost || "");
    safe.sourceAgent = String(message.sourceAgent || "");
    safe.sourceDevice = String(message.sourceDevice || "");
    safe.approximateLocation = message.approximateLocation || null;
  }
  return safe;
}

function sanitizeInnerDoc(doc) {
  return {
    id: String(doc.id || crypto.randomUUID()).slice(0, 80),
    title: String(doc.title || "Untitled doc").trim().slice(0, 120),
    type: normalizeInnerDocType(doc.type),
    body: sanitizeInnerDocHtml(doc.body),
    owner: String(doc.owner || "").slice(0, 80),
    sharedWith: Array.from(new Set((Array.isArray(doc.sharedWith) ? doc.sharedWith : []).map((name) => String(name || "").trim()).filter(Boolean))).slice(0, 200),
    createdAt: doc.createdAt || new Date().toISOString(),
    createdBy: String(doc.createdBy || "").slice(0, 80),
    updatedAt: doc.updatedAt || "",
    updatedBy: String(doc.updatedBy || "").slice(0, 80),
  };
}

function sanitizeInnerDocHtml(value) {
  return String(value || "")
    .slice(0, 120000)
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"]?)\s*javascript:[^'"\s>]*/gi, "");
}

function innerDocHtmlExport(doc) {
  const title = escapeHtml(doc.title || "Inner Doc");
  const isSlides = doc.type === "slides";
  const body = sanitizeInnerDocHtml(doc.body || "");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body{margin:0;background:#f3f3ef;color:#151515;font-family:Inter,system-ui,sans-serif}
    main{max-width:${isSlides ? "1100px" : "860px"};margin:0 auto;padding:32px}
    .doc{background:white;border:1px solid #ddd;border-radius:6px;box-shadow:0 18px 48px rgba(0,0,0,.08);padding:48px;line-height:1.65}
    .slide,.inner-slide{aspect-ratio:16/9;background:white;border:1px solid #ddd;border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,.08);padding:48px;margin:0 0 28px;display:flex;flex-direction:column;justify-content:center}
    h1{font-size:2.1rem;margin:0 0 16px} h2{font-size:1.5rem} p,li{font-size:1.05rem}
    @media print{body{background:white}main{padding:0}.doc,.slide,.inner-slide{box-shadow:none;break-after:page;border:0}}
  </style>
</head>
<body><main>${isSlides ? normalizeSlideExport(body) : `<article class="doc">${body}</article>`}</main></body>
</html>`;
}

function normalizeSlideExport(html) {
  if (/<section\b[^>]*class=["'][^"']*inner-slide/i.test(html)) return html;
  const parts = String(html || "").split(/<hr\s*\/?>/i).map((part) => part.trim()).filter(Boolean);
  return (parts.length ? parts : [html]).map((part) => `<section class="inner-slide">${part}</section>`).join("\n");
}

function innerDocPlainText(doc) {
  return `${doc.title || "Inner Doc"}\n${doc.type || "doc"}\n\n${htmlToPlainText(doc.body || "")}`;
}

function htmlToPlainText(html) {
  return String(html || "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/(p|div|h1|h2|h3|li|section|blockquote)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function downloadSafeName(value) {
  return String(value || "inner-doc").replace(/[^\w.\- ]+/g, "_").trim().slice(0, 80) || "inner-doc";
}

function safeInnerDoc(doc, user) {
  const safe = sanitizeInnerDoc(doc);
  return {
    ...safe,
    editable: canAccessInnerDoc(safe, user),
    sharedWith: canManage(user) || safe.owner === user.username ? safe.sharedWith : [],
  };
}

function safeInnerDocs(docs, user) {
  return (docs || [])
    .map(sanitizeInnerDoc)
    .filter((doc) => canAccessInnerDoc(doc, user))
    .map((doc) => safeInnerDoc(doc, user));
}

function canAccessInnerDoc(doc, user) {
  if (!doc || !user) return false;
  if (canManage(user)) return true;
  return doc.owner === user.username || (Array.isArray(doc.sharedWith) && doc.sharedWith.includes(user.username));
}

function safeFileRecord(file, viewer) {
  const showAdminMeta = viewer && canOwn(viewer);
  const safe = {
    id: file.id,
    originalName: file.originalName,
    category: file.category,
    kind: file.kind,
    mimeType: file.mimeType,
    size: file.size,
    user: file.user,
    private: Boolean(file.private),
    releaseAt: file.releaseAt || "",
    releaseRoom: file.releaseRoom || "",
    createdAt: file.createdAt,
    url: `/api/files/${encodeURIComponent(file.id)}/download`,
  };
  if (showAdminMeta) {
    Object.assign(safe, {
      storedName: file.storedName,
      sourceIp: file.sourceIp || "",
      sourceHost: file.sourceHost || "",
      sourceAgent: file.sourceAgent || "",
      sourceDevice: file.sourceDevice || "",
      approximateLocation: file.approximateLocation || null,
      persistence: file.persistence || (file.inlineData ? "disk+inline" : "disk"),
      cloudStorage: file.cloudStorage || "",
      externalBacked: Boolean(file.cloudinarySecureUrl || file.cloudFileId || file.b2FileId),
      cloudinaryPublicId: file.cloudinaryPublicId || "",
      b2FileId: file.b2FileId || "",
      b2FileName: file.b2FileName || "",
      inlineBacked: Boolean(file.inlineData),
      inlineSize: Number(file.inlineSize || 0),
    });
  }
  return safe;
}

function sanitizeAccountRequest(request) {
  return {
    id: String(request.id || crypto.randomUUID()),
    username: normalizeUsername(request.username),
    displayName: String(request.displayName || request.username || "").trim().slice(0, 80),
    contact: String(request.contact || "").trim().slice(0, 160),
    email: String(request.email || "").trim().slice(0, 120),
    phone: String(request.phone || "").trim().slice(0, 80),
    grade: normalizeGrade(request.grade || ""),
    requestedRole: normalizeRole(request.requestedRole || "member"),
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

function normalizePublicRequestedRole(role) {
  const raw = String(role || "member").toLowerCase();
  if (raw === "teacher") return "moderator";
  const value = normalizeRole(raw);
  return value === "moderator" ? "moderator" : "member";
}

function safeAccountRequest(request, viewer = null) {
  const safe = sanitizeAccountRequest(request);
  const ownerView = canOwn(viewer);
  delete safe.passwordHash;
  const result = {
    ...safe,
    location: ownerView && safe.location
      ? {
          latitude: safe.location.latitude,
          longitude: safe.location.longitude,
          accuracy: safe.location.accuracy,
          sharedAt: safe.location.sharedAt,
        }
      : null,
  };
  if (!ownerView) {
    result.sourceIp = "";
    result.sourceAgent = "";
    result.sourceDevice = "";
    result.approximateLocation = null;
  }
  return result;
}

function safeAccountRequests(requests, viewer = null) {
  return (requests || [])
    .map((request) => safeAccountRequest(request, viewer))
    .filter((request) => {
      if (request.status === "declined") return false;
      if (request.status === "approved") {
        const approvedAt = Date.parse(request.approvedAt || request.updatedAt || request.createdAt);
        return Number.isFinite(approvedAt) ? Date.now() - approvedAt < 48 * 60 * 60 * 1000 : true;
      }
      if (request.status === "pending" || request.status === "reviewing") {
        const createdAt = Date.parse(request.createdAt || request.updatedAt);
        return Number.isFinite(createdAt) ? Date.now() - createdAt < 7 * 24 * 60 * 60 * 1000 : true;
      }
      return true;
    })
    .slice(0, 500);
}

function activeAccountRequestForIdentity(request) {
  const safe = sanitizeAccountRequest(request);
  if (safe.status === "declined") return false;
  if (safe.status === "approved") {
    const approvedAt = Date.parse(safe.approvedAt || safe.updatedAt || safe.createdAt);
    return Number.isFinite(approvedAt) ? Date.now() - approvedAt < 48 * 60 * 60 * 1000 : true;
  }
  if (safe.status === "pending" || safe.status === "reviewing") {
    const createdAt = Date.parse(safe.createdAt || safe.updatedAt);
    return Number.isFinite(createdAt) ? Date.now() - createdAt < 7 * 24 * 60 * 60 * 1000 : true;
  }
  return false;
}

function duplicateAccountIdentityError(users = [], requests = [], identity = {}) {
  const phone = normalizePhoneNumber(identity.phone);
  const sourceIp = normalizeIpAddress(identity.sourceIp);
  if (phone) {
    const phoneUsedByUser = users.some((entry) => normalizePhoneNumber(entry && entry.phone) === phone);
    if (phoneUsedByUser) return "That phone number is already connected to an account.";
    const phoneUsedByRequest = requests.some((entry) =>
      activeAccountRequestForIdentity(entry) && normalizePhoneNumber(entry && entry.phone) === phone
    );
    if (phoneUsedByRequest) return "That phone number already has an active account request.";
  }
  if (BLOCK_DUPLICATE_SIGNUP_IPS && sourceIp && !DUPLICATE_SIGNUP_IP_ALLOWLIST.has(sourceIp)) {
    const ipUsedByUser = users.some((entry) => normalizeIpAddress(entry && (entry.sourceIp || entry.lastLoginIp)) === sourceIp);
    if (ipUsedByUser) return "An account has already been created from this IP address.";
    const ipUsedByRequest = requests.some((entry) =>
      activeAccountRequestForIdentity(entry) && normalizeIpAddress(entry && entry.sourceIp) === sourceIp
    );
    if (ipUsedByRequest) return "This IP address already has an active account request.";
  }
  return "";
}

async function requestLoginStatus(usernameValue, passwordValue) {
  const username = normalizeUsername(usernameValue);
  if (!username) return null;
  const requests = await readJson(FILES.accountRequests, []);
  const request = requests
    .map(sanitizeAccountRequest)
    .find((entry) => entry.username.toLowerCase() === username.toLowerCase());
  if (!request || !request.passwordHash || !(await verifyPasswordAsync(passwordValue, request.passwordHash))) return null;
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

async function requestLoginBlockForExistingUser(user) {
  if (!user || !user.accountRequestId) return null;
  const requests = await readJson(FILES.accountRequests, []);
  const request = requests
    .map(sanitizeAccountRequest)
    .find((entry) =>
      entry.id === user.accountRequestId ||
      entry.username.toLowerCase() === String(user.username || "").toLowerCase()
    );
  if (!request) return null;
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

function accountSecurityEmailLines(details = {}) {
  const ip = String(details.ip || "").trim();
  const device = String(details.device || "").trim();
  const agent = String(details.agent || "").trim();
  const location = details.location;
  const locationText = location && typeof location === "object"
    ? (location.note || location.ip || JSON.stringify(location))
    : String(location || "");
  const time = details.time || new Date().toISOString();
  return [
    "Security details:",
    `IP: ${ip || "unknown"}`,
    `Device: ${device || "unknown"}`,
    locationText ? `Approx location: ${locationText}` : "",
    agent ? `Browser: ${agent}` : "",
    `Time: ${time}`,
  ].filter(Boolean);
}

function reportRetentionMs(settings) {
  const days = Math.max(1, Math.min(3650, Number(settings && settings.reportRetentionDays || 30)));
  return days * 24 * 60 * 60 * 1000;
}

function pruneReportsForSettings(reports, settings) {
  const cutoff = Date.now() - reportRetentionMs(settings);
  return (reports || []).filter((report) => {
    const createdAt = Date.parse(report && report.createdAt);
    return !Number.isFinite(createdAt) || createdAt >= cutoff;
  });
}

function safeActiveReports(reports, settings = {}) {
  return pruneReportsForSettings(reports, settings)
    .filter((report) => !["done", "closed", "resolved", "dismissed"].includes(String(report.status || "").toLowerCase()))
    .slice(0, 250);
}

function reportTouchesUser(report, username) {
  const target = String(username || "").toLowerCase();
  if (!target || !report) return false;
  return [
    report.reporter,
    report.targetSender,
    report.updatedBy,
  ].some((value) => String(value || "").toLowerCase() === target);
}

function recentLoginIps(user, limit = 10) {
  const ips = [];
  const addIp = (value) => {
    const ip = String(value || "").trim();
    if (ip && !ips.includes(ip)) ips.push(ip);
  };
  addIp(user.lastLoginIp);
  addIp(user.sourceIp);
  (Array.isArray(user.loginHistory) ? user.loginHistory : []).forEach((entry) => addIp(entry && entry.ip));
  return ips.slice(0, limit);
}

async function createPasswordResetRecord(target, req) {
  const resets = await readJson(FILES.passwordResets, []);
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const requestRecord = {
    id: crypto.randomUUID(),
    username: target.username,
    email: target.email,
    tokenHash: hashPassword(rawToken),
    usedAt: "",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    sourceIp: getClientIp(req),
    sourceDevice: deviceSignature(req),
  };
  const next = [requestRecord, ...resets.filter((entry) => Date.parse(entry.expiresAt || "") > Date.now()).slice(0, 500)];
  await writeJson(FILES.passwordResets, next);
  return { requestRecord, rawToken };
}

async function handleNewIpLoginAlert(user, login, req, settings = {}) {
  await addSystemLog("login.new_ip", user.username, {
    ip: login.ip,
    device: login.device,
    previousIps: login.previousIps,
    loginAt: login.loginAt,
  }, req);
  if (!String(user.email || "").includes("@")) return;

  const resetEnabled = settings.passwordResetEnabled !== false;
  let resetUrl = "";
  if (resetEnabled) {
    const { requestRecord, rawToken } = await createPasswordResetRecord(user, req);
    resetUrl = `${publicBaseUrl(req)}/?reset=${encodeURIComponent(requestRecord.id)}.${encodeURIComponent(rawToken)}`;
  }

  const support = sanitizeEmailContacts(settings.emailContacts || {}).support || settings.adminContactEmail || "support@connectifi.in";
  await sendDirectEmail([user.email], "Connectifi new login from a new IP", [
    `Hi ${user.username},`,
    "",
    "A successful login to your Connectifi account came from an IP address that is not in your recent login history.",
    `New IP: ${login.ip || "unknown"}`,
    `Device: ${login.device || "unknown"}`,
    `Time: ${login.loginAt || new Date().toISOString()}`,
    login.previousIps && login.previousIps.length ? `Recent IPs on record: ${login.previousIps.join(", ")}` : "",
    "",
    resetEnabled
      ? "If this was not you, reset your password using the button/link in this email."
      : `Password reset is currently disabled. If this was not you, contact ${support}.`,
    resetUrl,
  ].filter(Boolean).join("\n"), {
    route: "loginFailures",
    contactType: "support",
    fromContact: true,
    actionLabel: resetEnabled ? "Reset password" : "Contact support",
    ctaUrl: resetEnabled ? resetUrl : "",
  });
}

function userContactSnapshot(users, username, viewer = null) {
  const target = (users || []).find((entry) => entry.username.toLowerCase() === String(username || "").toLowerCase());
  if (!target) return null;
  const ownerView = canOwn(viewer);
  return {
    username: target.username,
    contact: String(target.contact || "").slice(0, 160),
    email: String(target.email || "").slice(0, 120),
    phone: String(target.phone || "").slice(0, 80),
    sourceIp: ownerView ? String(target.sourceIp || "").slice(0, 80) : "",
    lastLoginIp: ownerView ? String(target.lastLoginIp || "").slice(0, 80) : "",
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
  const messageTargets = new Set(
    (Array.isArray(options.messages) ? options.messages : [])
      .map((message) => String(message && message.roomId || "main"))
      .filter(Boolean)
  );
  for (const [key, value] of Object.entries(receipts)) {
    const [context, ...rest] = key.split(":");
    const targetId = rest.join(":");
    if (context === "messages") {
      if (messageTargets.has(targetId || "main")) result[key] = value;
    } else if (context === "dm") {
      const participants = targetId.split("|").map(normalizeUsername).filter(Boolean);
      if (participants.includes(normalizeUsername(user && user.username))) result[key] = value;
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

function safeSettings(settings, viewer = null) {
  const source = { ...(settings || {}) };
  if (!canOwn(viewer)) {
    [
      "ownerFailsafe", "ownerCheckin", "emailRoutes", "emailContacts", "adminContactEmail",
      "delegatedAdminFeatures", "ai", "aiConfig", "apiKey", "smtp", "smtpConfig",
      "backup", "backups", "storage", "storageConfig", "serviceScale", "devConfig",
      "reportEmails", "strikeEmails", "moderationSettings", "nonOwnerAdminFeatures",
    ].forEach((key) => delete source[key]);
  }
  return {
    ...source,
    ownerFailsafe: canOwn(viewer) ? safeOwnerFailsafe(settings.ownerFailsafe) : undefined,
    ownerCheckin: canOwn(viewer) ? safeOwnerCheckin(settings.ownerCheckin, viewer) : undefined,
    emailRoutes: canOwn(viewer) ? sanitizeEmailRoutes(settings.emailRoutes || {}) : undefined,
    emailContacts: canOwn(viewer) ? sanitizeEmailContacts(settings.emailContacts || {}) : undefined,
    acceptedEmailDomains: sanitizeAcceptedEmailDomains(settings.acceptedEmailDomains || []),
    gameLinks: sanitizeGameLinks(settings.gameLinks || []),
    customizations: sanitizeCustomizations(settings.customizations || {}),
    serviceScale: canOwn(viewer) ? sanitizeServiceScale(settings.serviceScale || {}) : undefined,
    persistentLogin: sanitizePersistentLogin(settings.persistentLogin || {}),
    featureLocks: visibleFeatureLocks(settings.featureLocks || {}),
    featureVisibility: sanitizeFeatureVisibility(settings.featureVisibility || {}),
    secretMessaging: safeSecretMessagingSettings(settings.secretMessaging || {}, viewer),
    paywalls: sanitizePaywalls(settings.paywalls || {}),
    browserPolicy: sanitizeBrowserPolicy(settings.browserPolicy || {}),
    reportRetentionDays: Math.max(1, Math.min(3650, Number(settings.reportRetentionDays || 30))),
    shutdownMode: settings.serverEnabled === false,
    shutdownAt: settings.serverEnabled === false ? String(settings.shutdownAt || "") : "",
    shutdownBy: settings.serverEnabled === false ? String(settings.shutdownBy || "") : "",
    shutdownReason: settings.serverEnabled === false ? String(settings.shutdownReason || "") : "",
    delegatedAdminFeatures: canOwn(viewer) ? sanitizeDelegatedAdminFeatures(settings.delegatedAdminFeatures || {}) : undefined,
    moderationCapabilities: canModerate(viewer)
      ? ["strikes", "room-controls", "reports", "audit-logs", "member-actions", "content-moderation", "account-requests", "account-management", "live-ip-tracking", "announcements", "store-management", "auto-moderation", "voice-management", "service-scaling", "system-logs"].filter((capability) => canUseModerationCapability(viewer, settings, capability))
      : [],
  };
}

function defaultOwnerCheckin() {
  return normalizeOwnerCheckin({
    cadence: "weekly",
    scheduleTime: "12:00",
    nextCheckAt: nextOwnerCheckinAt("weekly", new Date(), "12:00").toISOString(),
    recipients: [OWNER_CHECKIN_EMAIL],
  });
}

function normalizeOwnerCheckin(source = {}) {
  const value = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  const cadence = String(value.cadence || "weekly").toLowerCase() === "monthly" ? "monthly" : "weekly";
  const scheduleTime = normalizeOwnerCheckinTime(value.scheduleTime);
  const restrictedFeatures = Array.from(new Set((Array.isArray(value.restrictedFeatures) ? value.restrictedFeatures : [])
    .map((feature) => String(feature || "").trim().toLowerCase())
    .filter((feature) => ["browser", "store", "chess"].includes(feature))));
  const nextCheckAt = Date.parse(value.nextCheckAt) ? String(value.nextCheckAt) : nextOwnerCheckinAt(cadence, new Date(), scheduleTime).toISOString();
  return {
    cadence,
    scheduleTime,
    recipients: Array.from(new Set([OWNER_CHECKIN_EMAIL, ...(Array.isArray(value.recipients) ? value.recipients : [])]
      .map(cleanEmailAddress).filter(Boolean))).slice(0, 10),
    nextCheckAt,
    pending: Boolean(value.pending),
    requestedAt: String(value.requestedAt || ""),
    deadlineAt: String(value.deadlineAt || ""),
    lastResponseCode: ["100", "101", "102", "103", "104"].includes(String(value.lastResponseCode || "")) ? String(value.lastResponseCode) : "",
    lastRespondedAt: String(value.lastRespondedAt || ""),
    lastRespondedBy: String(value.lastRespondedBy || "").slice(0, 80),
    restrictionActive: Boolean(value.restrictionActive) && restrictedFeatures.length > 0,
    restrictedFeatures,
    moderatorOnlyActive: Boolean(value.moderatorOnlyActive),
  };
}

function safeOwnerCheckin(source = {}, viewer = null) {
  const checkin = normalizeOwnerCheckin(source);
  if (canOwn(viewer)) return checkin;
  return {
    cadence: checkin.cadence,
    pending: checkin.pending,
    restrictionActive: checkin.restrictionActive,
    restrictedFeatures: checkin.restrictedFeatures,
    moderatorOnlyActive: checkin.moderatorOnlyActive,
  };
}

function normalizeOwnerCheckinTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "")) ? String(value) : "12:00";
}

function nextOwnerCheckinAt(cadence, now = new Date(), scheduleTime = "12:00") {
  const indiaOffsetMs = 5.5 * 60 * 60 * 1000;
  const indiaNow = new Date(now.getTime() + indiaOffsetMs);
  const [hourText, minuteText] = normalizeOwnerCheckinTime(scheduleTime).split(":");
  const scheduledMinutes = Number(hourText) * 60 + Number(minuteText);
  let year = indiaNow.getUTCFullYear();
  let month = indiaNow.getUTCMonth();
  let day = indiaNow.getUTCDate();
  const scheduledTimePassed = (indiaNow.getUTCHours() * 60 + indiaNow.getUTCMinutes()) >= scheduledMinutes;
  if (cadence === "monthly") {
    const firstSunday = (targetYear, targetMonth) => {
      const first = new Date(Date.UTC(targetYear, targetMonth, 1));
      return 1 + ((7 - first.getUTCDay()) % 7);
    };
    let targetDay = firstSunday(year, month);
    if (day > targetDay || (day === targetDay && scheduledTimePassed)) {
      month += 1;
      if (month > 11) { month = 0; year += 1; }
      targetDay = firstSunday(year, month);
    }
    day = targetDay;
  } else {
    const daysUntilSunday = (7 - indiaNow.getUTCDay()) % 7;
    const addDays = daysUntilSunday || (scheduledTimePassed ? 7 : 0);
    const target = new Date(Date.UTC(year, month, day + addDays));
    year = target.getUTCFullYear();
    month = target.getUTCMonth();
    day = target.getUTCDate();
  }
  return new Date(Date.UTC(year, month, day, Number(hourText), Number(minuteText), 0) - indiaOffsetMs);
}

function defaultOwnerFailsafe() {
  const configuredCode = firstEnvValue("INNER_OWNER_FAILSAFE_CODE", "OWNER_FAILSAFE_CODE");
  return normalizeOwnerFailsafe({
    recoveryCodeHash: configuredCode ? hashPassword(String(configuredCode)) : "",
    recoveryCodeMode: configuredCode ? "dedicated" : "",
    recoveryCodeUpdatedAt: configuredCode ? new Date().toISOString() : "",
    recoveryCodeUpdatedBy: configuredCode ? "environment" : "",
  });
}

function normalizeOwnerFailsafe(source = {}) {
  const value = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  const codeHash = String(value.recoveryCodeHash || "");
  return {
    recoveryCodeHash: codeHash.includes(":") ? codeHash : "",
    recoveryCodeMode: ["dedicated", "owner-password-bootstrap"].includes(String(value.recoveryCodeMode || ""))
      ? String(value.recoveryCodeMode)
      : "",
    recoveryCodeUpdatedAt: String(value.recoveryCodeUpdatedAt || ""),
    recoveryCodeUpdatedBy: String(value.recoveryCodeUpdatedBy || "").slice(0, 80),
    locked: Boolean(value.locked),
    lockedAt: String(value.lockedAt || ""),
    lockedBy: String(value.lockedBy || "").slice(0, 80),
    trigger: String(value.trigger || "").slice(0, 120),
    unlockedAt: String(value.unlockedAt || ""),
    unlockedBy: String(value.unlockedBy || "").slice(0, 80),
  };
}

function safeOwnerFailsafe(source = {}) {
  const failsafe = normalizeOwnerFailsafe(source);
  return {
    recoveryCodeConfigured: Boolean(failsafe.recoveryCodeHash),
    dedicatedRecoveryCode: failsafe.recoveryCodeMode === "dedicated",
    locked: failsafe.locked,
    lockedAt: failsafe.lockedAt,
    lockedBy: failsafe.lockedBy,
    trigger: failsafe.trigger,
    unlockedAt: failsafe.unlockedAt,
    unlockedBy: failsafe.unlockedBy,
  };
}

function ownerFailsafeLocked(settings = {}) {
  return Boolean(normalizeOwnerFailsafe(settings.ownerFailsafe).locked);
}

function ownerCheckinModeratorOnly(settings = {}) {
  return Boolean(normalizeOwnerCheckin(settings.ownerCheckin).moderatorOnlyActive);
}

function canAccessWhileServerLocked(user, settings = {}) {
  return ownerFailsafeLocked(settings) ? canOwn(user) : canBypassShutdown(user);
}

function serverLockedMessage(settings = {}) {
  return ownerFailsafeLocked(settings)
    ? "The owner recovery lock is active. Only the owner admin can unlock the server with the recovery code."
    : "Server is shut down. Only admin, HMD, and dev access is open right now.";
}

function safeSecretMessagingSettings(source = {}, viewer = null) {
  const clean = sanitizeSecretMessaging(source);
  if (canOwn(viewer)) return { ...clean, enabled: true };
  const username = String(viewer && viewer.username || "").toLowerCase();
  const enabled = Boolean(username && clean.allowedUsers.includes(username));
  return { allowedUsers: enabled ? [username] : [], enabled };
}

function sanitizeSecretMessaging(source = {}) {
  return {
    allowedUsers: normalizeUsernameList(source.allowedUsers || source.users || source.enabledUsers || []).slice(0, 200),
  };
}

function sanitizePersistentLogin(source = {}) {
  const cleanList = (value, limit = 80) =>
    Array.from(new Set((Array.isArray(value) ? value : String(value || "").split(/[\n,]+/))
      .map((entry) => String(entry || "").trim().toLowerCase())
      .filter(Boolean)))
      .slice(0, limit);
  return {
    defaultEnabled: source.defaultEnabled !== false,
    grades: cleanList(source.grades).map(normalizeGrade).filter(Boolean),
    roles: cleanList(source.roles).filter((entry) => ["member", "moderator", "admin", "hmd", "dev"].includes(entry)),
    rooms: cleanList(source.rooms, 200),
  };
}

function sanitizeGameLinks(source = []) {
  const entries = Array.isArray(source) ? source : [];
  const fallback = [{ name: "ChessVerse", url: "https://chessverse.co.in/" }];
  const cleaned = entries
    .map((entry) => {
      const raw = entry && typeof entry === "object" ? entry : {};
      const url = sanitizeExternalUrl(raw.url || "");
      const host = (() => {
        try {
          return new URL(url).hostname.replace(/^www\./, "");
        } catch (error) {
          return "";
        }
      })();
      return {
        name: String(raw.name || host || "Game").trim().slice(0, 80),
        url,
        allowedUsers: normalizeUsernameList(raw.allowedUsers || raw.users || raw.visibleTo || []).slice(0, 80),
      };
    })
    .filter((entry) => entry.name && entry.url);
  const withDefault = [
    { name: "ChessVerse", url: "https://chessverse.co.in/", allowedUsers: [] },
    ...cleaned,
  ];
  const seen = new Set();
  return withDefault.filter((entry) => {
    const key = entry.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 24) || fallback;
}

function sanitizeBrowserPolicy(policy = {}) {
  return {
    allowOnly: Boolean(policy.allowOnly),
    allowedSites: sanitizeDomainList(policy.allowedSites),
    blockedSites: sanitizeDomainList(policy.blockedSites),
  };
}

function sanitizeDomainList(list) {
  return Array.from(new Set((Array.isArray(list) ? list : String(list || "").split(/[\n,]+/))
    .map((entry) => String(entry || "").trim().toLowerCase())
    .map((entry) => entry.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .map((entry) => entry.replace(/^\*\./, ""))
    .filter((entry) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(entry))))
    .slice(0, 200);
}

function safeUploadConfig(settings) {
  const maxBytes = Math.round(MAX_UPLOAD_BYTES * serviceScaleMultiplier(settings || {}, "uploads"));
  return {
    maxBytes,
    maxLabel: formatServerBytes(maxBytes),
    directCloudinary: cloudinaryConfigured() && !["b2", "backblaze", "mongodb"].includes(UPLOAD_PROVIDER),
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
    appName: "Connectifi",
    connectedLabel: "",
    disconnectedLabel: "",
    serverOnLabel: "",
    serverOffLabel: "",
    versionLabel: "",
    updateTitle: "",
    updateNote: "",
    notice: "",
    globalTheme: "",
    globalVisualStyle: "",
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
    updateTitle: String(customizations.updateTitle || "").trim().slice(0, 100),
    updateNote: String(customizations.updateNote || "").trim().slice(0, 800),
    notice: String(customizations.notice || "").trim().slice(0, 240),
    globalTheme: normalizeGlobalTheme(customizations.globalTheme || ""),
    globalVisualStyle: customizations.globalVisualStyle ? normalizeVisualStyle(customizations.globalVisualStyle) : "",
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

function normalizeIpAddress(value) {
  return String(value || "")
    .trim()
    .replace(/^::ffff:/, "")
    .replace(/^\[|\]$/g, "");
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
    const candidates = activeFeatureLockCandidates(lock, new Date(now));
    if (candidates.length) active[feature] = candidates[0];
  }
  return active;
}

function activeFeatureLockCandidates(lock, now = new Date()) {
  const nowMs = now.getTime();
  const schedules = sanitizeFeatureLockSchedules(lock && lock.schedules || [])
    .filter((schedule) => featureScheduleActive(schedule, now))
    .map((schedule) => ({
      ...schedule,
      disabledFrom: now.toISOString(),
      disabledUntil: scheduleWindowEnd(schedule, now).toISOString(),
    }));
  const disabledFrom = Date.parse(lock && lock.disabledFrom);
  const disabledUntil = Date.parse(lock && lock.disabledUntil);
  if (Number.isFinite(disabledUntil) && disabledUntil > nowMs && (!Number.isFinite(disabledFrom) || disabledFrom <= nowMs)) {
    schedules.push({
      disabledFrom: Number.isFinite(disabledFrom) ? new Date(disabledFrom).toISOString() : "",
      disabledUntil: new Date(disabledUntil).toISOString(),
      disabledBy: String(lock.disabledBy || ""),
      reason: String(lock.reason || "").slice(0, 160),
      roomId: String(lock.roomId || "").slice(0, 80),
      roles: normalizeLockRoles(lock.roles),
    });
  }
  return schedules;
}

function visibleFeatureLocks(featureLocks) {
  const visible = {};
  const now = Date.now();
  for (const [feature, lock] of Object.entries(featureLocks || {})) {
    if (!allowedFeatureLocks.has(feature)) continue;
    const schedules = sanitizeFeatureLockSchedules(lock && lock.schedules || []);
    const exemptions = sanitizeFeatureLockExemptions(lock && lock.exemptions || []);
    const disabledFrom = Date.parse(lock && lock.disabledFrom);
    const disabledUntil = Date.parse(lock && lock.disabledUntil);
    if ((!Number.isFinite(disabledUntil) || disabledUntil <= now) && !schedules.length && !exemptions.length) continue;
    visible[feature] = {
      disabledFrom: Number.isFinite(disabledFrom) && Number.isFinite(disabledUntil) && disabledUntil > now ? new Date(disabledFrom).toISOString() : "",
      disabledUntil: Number.isFinite(disabledUntil) && disabledUntil > now ? new Date(disabledUntil).toISOString() : "",
      disabledBy: String(lock.disabledBy || ""),
      reason: String(lock.reason || "").slice(0, 160),
      roomId: String(lock.roomId || "").slice(0, 80),
      roles: normalizeLockRoles(lock.roles),
      schedules,
      exemptions,
    };
  }
  return visible;
}

function sanitizeFeatureLockSchedules(schedules) {
  return (Array.isArray(schedules) ? schedules : [])
    .map((schedule) => ({
      id: String(schedule && schedule.id || crypto.randomUUID()).slice(0, 80),
      startTime: normalizeScheduleTime(schedule && schedule.startTime),
      endTime: normalizeScheduleTime(schedule && schedule.endTime),
      days: normalizeScheduleDays(schedule && schedule.days),
      repeats: !schedule || schedule.repeats !== false,
      disabledBy: String(schedule && schedule.disabledBy || "").slice(0, 80),
      reason: String(schedule && schedule.reason || "").trim().slice(0, 160),
      roomId: String(schedule && schedule.roomId || "").trim().slice(0, 80),
      roles: normalizeLockRoles(schedule && schedule.roles),
      createdAt: String(schedule && schedule.createdAt || ""),
      updatedAt: String(schedule && schedule.updatedAt || ""),
    }))
    .filter((schedule) => schedule.startTime && schedule.endTime && schedule.days.length)
    .slice(0, 48);
}

function sanitizeFeatureLockExemptions(exemptions) {
  const now = Date.now();
  return (Array.isArray(exemptions) ? exemptions : [])
    .map((exemption) => ({
      id: String(exemption && exemption.id || crypto.randomUUID()).slice(0, 80),
      grade: normalizeGrade(exemption && exemption.grade || ""),
      roomId: String(exemption && exemption.roomId || "").trim().slice(0, 80),
      until: String(exemption && exemption.until || ""),
      exemptedBy: String(exemption && exemption.exemptedBy || "").slice(0, 80),
      createdAt: String(exemption && exemption.createdAt || ""),
    }))
    .filter((exemption) => exemption.grade && Number.isFinite(Date.parse(exemption.until)) && Date.parse(exemption.until) > now)
    .slice(-96);
}

function featureScheduleActive(schedule, now = new Date()) {
  const days = normalizeScheduleDays(schedule && schedule.days);
  const day = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][now.getDay()];
  if (!days.includes(day)) return false;
  const start = scheduleTimeToMinutes(schedule.startTime);
  const end = scheduleTimeToMinutes(schedule.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  return start < end ? current >= start && current < end : current >= start || current < end;
}

function scheduleWindowEnd(schedule, now = new Date()) {
  const end = scheduleTimeToMinutes(schedule.endTime);
  const current = now.getHours() * 60 + now.getMinutes();
  const result = new Date(now);
  const [hour, minute] = String(schedule.endTime || "").split(":").map(Number);
  result.setHours(Number.isFinite(hour) ? hour : now.getHours(), Number.isFinite(minute) ? minute : now.getMinutes(), 0, 0);
  if (end <= current || scheduleTimeToMinutes(schedule.startTime) > end) result.setDate(result.getDate() + 1);
  return result;
}

function scheduleTimeToMinutes(time) {
  const [hourText, minuteText] = String(time || "").split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return NaN;
  return hour * 60 + minute;
}

function featureBlocked(settings, feature, user, context = {}) {
  const visibility = sanitizeFeatureVisibility(settings.featureVisibility || {})[feature];
  if (visibility && visibility.hidden && !canOwn(user) && !visibility.allowedUsers.includes(String(user && user.username || "").toLowerCase())) {
    return `${featureLabel(feature)} is hidden for your account`;
  }
  if (canManage(user)) return "";
  const featureLockConfig = (settings.featureLocks || {})[feature];
  const userGrade = normalizeGrade(user && user.grade || "");
  const exempted = sanitizeFeatureLockExemptions(featureLockConfig && featureLockConfig.exemptions || []).some((exemption) =>
    exemption.grade === userGrade && (!exemption.roomId || String(context.roomId || "") === exemption.roomId)
  );
  if (exempted) return "";
  const lock = activeFeatureLockCandidates(featureLockConfig, new Date()).find((candidate) => {
    if (candidate.roomId && String(context.roomId || "") !== candidate.roomId) return false;
    if (candidate.roles.length && !candidate.roles.includes(effectiveRole(user))) return false;
    return true;
  });
  if (!lock) return "";
  const label = feature === "dms" ? "DMs" : feature.charAt(0).toUpperCase() + feature.slice(1);
  const roomText = lock.roomId ? ` in room ${lock.roomId}` : "";
  return `${label} disabled${roomText} until ${new Date(lock.disabledUntil).toLocaleString()}${lock.reason ? `: ${lock.reason}` : ""}`;
}

async function featureGateError(settings, feature, user, context = {}) {
  const ownerCheckinBlock = ownerCheckinFeatureBlocked(settings, feature, user);
  if (ownerCheckinBlock) return ownerCheckinBlock;
  const blocked = featureBlocked(settings, feature, user, context);
  if (blocked) return blocked;
  const paywalls = sanitizePaywalls(settings.paywalls || {});
  const wholeAppPaywall = paywalls.all;
  if (feature !== "store" && wholeAppPaywall && wholeAppPaywall.enabled) {
    return featurePaywallBlocked(settings, await readJson(FILES.store, { items: [], orders: [] }), "all", user);
  }
  if (!paywalls[feature] || !paywalls[feature].enabled) return "";
  return featurePaywallBlocked(settings, await readJson(FILES.store, { items: [], orders: [] }), feature, user);
}

function ownerCheckinFeatureBlocked(settings, feature, user) {
  if (canOwn(user)) return "";
  const checkin = normalizeOwnerCheckin(settings && settings.ownerCheckin);
  if (!checkin.restrictionActive || !checkin.restrictedFeatures.includes(feature)) return "";
  return `${featureLabel(feature)} is temporarily restricted by the owner operational check-in.`;
}

function normalizeLockRoles(roles) {
  const values = Array.isArray(roles) ? roles : splitEnvList(roles);
  const allowed = new Set(["member", "moderator", "admin", "hmd", "dev"]);
  return Array.from(new Set(values.map((role) => normalizeRole(role)).filter((role) => allowed.has(role))));
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
    admin: "Admin",
    hmd: "HMD",
    browser: "Browser",
    docs: "Google Workspace",
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
    domain: "Domain",
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

function effectiveRole(user) {
  const role = normalizeRole(user && user.role);
  if (role !== "admin") return role;
  const previousRole = normalizeRole(user && user.tempAdminPreviousRole);
  const until = Date.parse(user && user.tempAdminUntil);
  if (previousRole && previousRole !== "admin" && Number.isFinite(until) && until <= Date.now()) {
    return previousRole;
  }
  return role;
}

function normalizeSoundboardSound(sound) {
  const value = String(sound || "").toLowerCase();
  if (["chime", "ping", "pop", "ring"].includes(value)) return value;
  return "chime";
}

function canManage(user) {
  return builtInManagerUsernames.has(String(user && user.username || "").toLowerCase()) && managerRoles.has(effectiveRole(user));
}

function canOwn(user) {
  return ownerUsernames.has(String(user && user.username || "").toLowerCase());
}

function canDev(user) {
  return builtInManagerUsernames.has(String(user && user.username || "").toLowerCase()) && developerRoles.has(effectiveRole(user));
}

function canBypassShutdown(user) {
  const username = String(user && user.username ? user.username : "").toLowerCase();
  return shutdownExemptUsernames.has(username) || canManage(user);
}

function canModerate(user) {
  return moderatorRoles.has(effectiveRole(user));
}

function sanitizeDelegatedAdminFeatureList(source) {
  const values = Array.isArray(source) ? source : String(source || "").split(/[\n,;]/);
  const allowed = new Set(["strikes", "room-controls", "reports", "audit-logs", "member-actions", "content-moderation", "account-requests", "account-management", "live-ip-tracking", "announcements", "store-management", "auto-moderation", "voice-management", "service-scaling", "system-logs"]);
  return Array.from(new Set(values.map((value) => String(value || "").trim().toLowerCase()).filter((value) => allowed.has(value))));
}

function sanitizeNonOwnerAdminFeatures(source) {
  const values = Array.isArray(source) ? source : String(source || "").split(/[\n,;]/);
  // Preserve the legacy screen-time name while storing the current room-control capability.
  return sanitizeDelegatedAdminFeatureList(values.map((value) => String(value || "").trim().toLowerCase() === "screen-time" ? "room-controls" : value));
}

function sanitizeDelegatedAdminFeatures(source) {
  const value = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  return Object.fromEntries(Object.entries(value)
    .map(([username, features]) => [normalizeUsername(username), sanitizeDelegatedAdminFeatureList(features)])
    .filter(([username]) => Boolean(username))
    .slice(0, 100));
}

function canUseModerationCapability(user, settings, capability) {
  if (!canModerate(user)) return false;
  if (normalizeRole(user && user.role) !== "admin" || canOwn(user)) return true;
  const features = sanitizeDelegatedAdminFeatures(settings && settings.delegatedAdminFeatures)[normalizeUsername(user.username)] || [];
  return features.includes(capability);
}

function sanitizeModeratorLogAccessUsers(source) {
  const list = Array.isArray(source) ? source : String(source || "").split(/[\n,;]/);
  return Array.from(new Set(list.map(normalizeUsername).filter(Boolean))).slice(0, 50);
}

function canViewAuditLogs(user, settings = {}) {
  if (canManage(user)) return true;
  if (!canModerate(user)) return false;
  if (canUseModerationCapability(user, settings, "audit-logs")) return true;
  const allowed = sanitizeModeratorLogAccessUsers(settings.moderationSettings && settings.moderationSettings.logAccessUsers);
  return allowed.includes(normalizeUsername(user && user.username));
}

function isUserBanned(user) {
  if (!user || !user.bannedUntil) return false;
  const until = Date.parse(user.bannedUntil);
  return Number.isFinite(until) && until > Date.now();
}

function clearExpiredUserRestrictions(users) {
  let changed = false;
  const now = Date.now();
  for (const user of users || []) {
    if (user.bannedUntil) {
      const until = Date.parse(user.bannedUntil);
      if (Number.isFinite(until) && until <= now) {
        user.bannedUntil = "";
        user.banReason = "";
        user.updatedAt = new Date().toISOString();
        user.updatedBy = "system-expiry";
        changed = true;
      }
    }
    if (user.mutedUntil) {
      const until = Date.parse(user.mutedUntil);
      if (Number.isFinite(until) && until <= now) {
        user.mutedUntil = "";
        user.shadowMuted = false;
        user.updatedAt = new Date().toISOString();
        user.updatedBy = "system-expiry";
        changed = true;
      }
    }
  }
  return changed;
}

function scheduleBanExpiry(username, bannedUntil) {
  const key = String(username || "").toLowerCase();
  if (!key) return;
  clearBanExpiry(key);
  const until = Date.parse(bannedUntil || "");
  if (!Number.isFinite(until) || until <= Date.now()) return;
  const delay = Math.min(until - Date.now() + 500, 2147483647);
  const timer = setTimeout(async () => {
    banExpiryTimers.delete(key);
    const users = await readJson(FILES.users, []);
    if (clearExpiredUserRestrictions(users)) {
      await writeJson(FILES.users, users);
      broadcastManagers({ type: "users:update", users: users.map(safeUser) });
    }
  }, delay);
  if (timer.unref) timer.unref();
  banExpiryTimers.set(key, timer);
}

function clearBanExpiry(username) {
  const key = String(username || "").toLowerCase();
  if (!key) return;
  if (banExpiryTimers.has(key)) clearTimeout(banExpiryTimers.get(key));
  banExpiryTimers.delete(key);
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

function normalizePhoneNumber(phone) {
  const value = String(phone || "").trim();
  if (!value) return "";
  const digits = value.replace(/[^\d]/g, "");
  return digits.length >= 7 ? digits : "";
}

function normalizeCurrency(currency) {
  const value = String(currency || "USD").trim().toUpperCase();
  if (["USD", "INR", "EUR", "GBP"].includes(value)) return value;
  return "USD";
}

function normalizeGrade(grade) {
  const value = String(grade || "").trim().toLowerCase().replace(/\s+/g, "");
  if (/^(6|7|8|9|10|11|12)[abc]$/.test(value)) return value.toUpperCase();
  if (["6", "7", "8", "9", "10", "11", "12", "college", "staff", "other"].includes(value)) return value;
  return "";
}

function normalizeInnerDocType(type) {
  const value = String(type || "doc").trim().toLowerCase();
  if (["doc", "notes", "slides", "sheet"].includes(value)) return value;
  return "doc";
}

function normalizeOrderStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (["pending", "paid", "cancelled", "refunded"].includes(value)) return value;
  return "pending";
}

function normalizeOptionalUrl(value) {
  const rawValue = String(value || "").trim();
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(rawValue) && rawValue.length <= 1024 * 1024) {
    return rawValue;
  }
  const textValue = rawValue.slice(0, 500);
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
  if (["system", "connectifi", "dark", "bd-somani", "midnight", "ocean", "forest", "rose", "slate", "glass", "custom"].includes(value)) return value;
  return "system";
}

function normalizeThemeOverride(theme) {
  const value = String(theme || "").trim().toLowerCase();
  if (["connectifi", "dark", "bd-somani", "midnight", "ocean", "forest", "rose", "slate", "glass", "custom"].includes(value)) return value;
  return "";
}

function normalizeGlobalTheme(theme) {
  const value = String(theme || "").trim().toLowerCase();
  if (!value) return "";
  if (value === "system") return "system";
  return normalizeThemeOverride(value);
}

function normalizeVisualStyle(style) {
  const value = String(style || "forest").trim().toLowerCase();
  if (["forest", "ocean", "mountains", "space", "city", "abstract", "nature"].includes(value)) return value;
  return "forest";
}

function sanitizeProfileSchedules(schedules) {
  return (Array.isArray(schedules) ? schedules : [])
    .map((schedule) => ({
      id: String(schedule && schedule.id || crypto.randomUUID()).slice(0, 80),
      startTime: normalizeScheduleTime(schedule && schedule.startTime),
      endTime: normalizeScheduleTime(schedule && schedule.endTime),
      days: normalizeScheduleDays(schedule && schedule.days),
      repeats: !schedule || schedule.repeats !== false,
    }))
    .filter((schedule) => schedule.startTime && schedule.endTime && schedule.days.length)
    .slice(0, 24);
}

function normalizeScheduleTime(value) {
  const text = String(value || "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : "";
}

function normalizeScheduleDays(days) {
  const selected = Array.isArray(days) ? days.map((day) => String(day || "").toLowerCase()) : [];
  return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].filter((day) => selected.includes(day));
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

async function issueMutedWordStrike(user, req) {
  const [settings, users] = await Promise.all([
    readJson(FILES.settings, {}),
    readJson(FILES.users, []),
  ]);
  const index = users.findIndex((entry) => String(entry.username || "").toLowerCase() === String(user.username || "").toLowerCase());
  if (index === -1 || canOwn(users[index])) return { thresholdReset: false, strikeCount: 0 };

  const issuedAt = new Date().toISOString();
  const reason = "Muted word used";
  const strikes = Array.isArray(users[index].strikes) ? users[index].strikes : [];
  const strike = { id: crypto.randomUUID(), issuedBy: "automod", reason, createdAt: issuedAt };
  const nextStrikes = [...strikes, strike].slice(-50);
  users[index] = { ...users[index], strikes: nextStrikes, updatedAt: issuedAt, updatedBy: "automod" };
  await addModerationLog("automod", "user:strike", users[index].username, reason);
  await addSystemLog("user.strike.issued", "automod", { username: users[index].username, count: nextStrikes.length, reason }, req);

  let thresholdReset = false;
  if (strikes.length < 3 && nextStrikes.length >= 3) {
    const recipients = Array.isArray(settings.strikeEmails) ? settings.strikeEmails.map(cleanEmailAddress).filter(Boolean) : [];
    sendDirectEmail(recipients, "Connectifi account reached three strikes", [
      `Account: ${users[index].username}`,
      `Strike count: ${nextStrikes.length}`,
      `Latest reason: ${reason}`,
      "Issued by: automod",
      `Time: ${issuedAt}`,
    ].join("\n"), { route: "loginFailures", contactType: "security" }).catch(() => {});
    users[index] = {
      ...users[index],
      strikes: [],
      lastStrikeThresholdAt: issuedAt,
      updatedAt: issuedAt,
      updatedBy: "automod",
    };
    thresholdReset = true;
    await addModerationLog("automod", "user:strike-threshold-reset", users[index].username, "Third-strike email sent and active strikes reset");
    await addSystemLog("user.strike.threshold.reset", "automod", { username: users[index].username, reason }, req);
  }

  await writeJson(FILES.users, users);
  broadcastManagers({ type: "users:update", users: users.map((entry) => safeUser(entry, user)) });
  return { thresholdReset, strikeCount: Array.isArray(users[index].strikes) ? users[index].strikes.length : 0 };
}

async function checkAutomod(textValue, user, req) {
  // The two owner-admin accounts remain protected from automated enforcement.
  // Moderators and non-owner admins are intentionally subject to the same
  // muted-word rules as members.
  if (canOwn(user)) return "";
  const automod = await readJson(FILES.automod, {});
  if (!automod.enabled) return "";
  const lower = String(textValue || "").toLowerCase();
  for (const word of automod.mutedWords || []) {
    if (word && lower.includes(String(word).toLowerCase())) {
      const result = await issueMutedWordStrike(user, req);
      return result.thresholdReset
        ? "Message blocked by auto moderation. A third strike was issued, the strike email was sent, and active strikes were reset."
        : "Message blocked by auto moderation. A strike was issued.";
    }
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
  broadcastManagerLogs("moderation:update", "moderationLogs", logs.slice(0, 250));
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
  broadcastManagerLogs("logs:update", "logs", next.slice(0, 300));
}

async function ownerFailsafeTriggeredResponse(req, res, actor, trigger) {
  const [settings, users] = await Promise.all([
    readJson(FILES.settings, {}),
    readJson(FILES.users, []),
  ]);
  const now = new Date();
  const until = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const actorName = String(actor && actor.username || "unknown").toLowerCase();
  const owner = users.find((entry) => ownerUsernames.has(String(entry.username || "").toLowerCase()));
  const failsafe = normalizeOwnerFailsafe(settings.ownerFailsafe);
  const recoveryCodeHash = failsafe.recoveryCodeHash || String(owner && owner.passwordHash || "");
  const recoveryCodeMode = failsafe.recoveryCodeHash ? failsafe.recoveryCodeMode : "owner-password-bootstrap";
  const actorIndex = users.findIndex((entry) => String(entry.username || "").toLowerCase() === actorName);

  if (actorIndex !== -1 && !ownerUsernames.has(actorName)) {
    users[actorIndex] = {
      ...users[actorIndex],
      bannedUntil: until,
      banReason: `Owner failsafe: ${trigger}`.slice(0, 160),
      updatedAt: now.toISOString(),
      updatedBy: "owner-failsafe",
    };
  }

  const next = {
    ...settings,
    serverEnabled: false,
    shutdownAt: now.toISOString(),
    shutdownBy: "owner-failsafe",
    shutdownReason: "Owner recovery lock",
    ownerFailsafe: {
      ...failsafe,
      recoveryCodeHash,
      recoveryCodeMode,
      locked: true,
      lockedAt: now.toISOString(),
      lockedBy: actorName,
      trigger: String(trigger || "protected-action").slice(0, 120),
    },
    updatedAt: now.toISOString(),
    updatedBy: "owner-failsafe",
  };

  await Promise.all([writeJson(FILES.users, users), writeJson(FILES.settings, next)]);
  if (actorIndex !== -1 && !ownerUsernames.has(actorName)) {
    expireUserSessions(actorName);
    scheduleBanExpiry(actorName, until);
  }
  const kicked = kickNonOwnerFailsafeUsers();
  await addSystemLog("owner.failsafe.triggered", actorName, { trigger, bannedUntil: until, kicked }, req);
  await addModerationLog("owner-failsafe", "user:ban", actorName, `24 hours: ${trigger}`);
  broadcastSettings(next);
  notifyAdminEmails(
    "Connectifi owner recovery lock activated",
    [
      "A protected owner action was attempted.",
      `Account: ${actorName}`,
      `Action: ${trigger}`,
      `Blocked at: ${now.toISOString()}`,
      `Account ban ends: ${until}`,
      "The server is locked until the owner admin enters the recovery code.",
    ].join("\n"),
    { route: "loginFailures", contactType: "security" },
  ).catch(() => {});
  return json(res, 423, {
    error: "Owner failsafe activated. The server is locked and this account has been banned for 24 hours.",
    bannedUntil: until,
  });
}

async function activateOwnerCheckinLockdown(trigger, actorName = "owner-checkin") {
  const [settings, users] = await Promise.all([
    readJson(FILES.settings, {}),
    readJson(FILES.users, []),
  ]);
  if (ownerFailsafeLocked(settings)) return settings;
  const now = new Date();
  const failsafe = normalizeOwnerFailsafe(settings.ownerFailsafe);
  const owner = users.find((entry) => ownerUsernames.has(String(entry.username || "").toLowerCase()));
  const next = {
    ...settings,
    serverEnabled: false,
    shutdownAt: now.toISOString(),
    shutdownBy: "owner-checkin",
    shutdownReason: "Owner recovery lock",
    ownerFailsafe: {
      ...failsafe,
      recoveryCodeHash: failsafe.recoveryCodeHash || String(owner && owner.passwordHash || ""),
      recoveryCodeMode: failsafe.recoveryCodeHash ? failsafe.recoveryCodeMode : "owner-password-bootstrap",
      locked: true,
      lockedAt: now.toISOString(),
      lockedBy: String(actorName || "owner-checkin").slice(0, 80),
      trigger: String(trigger || "owner-checkin").slice(0, 120),
    },
    ownerCheckin: normalizeOwnerCheckin({
      ...settings.ownerCheckin,
      pending: false,
      deadlineAt: "",
      lastResponseCode: "102",
    }),
    updatedAt: now.toISOString(),
    updatedBy: "owner-checkin",
  };
  await writeJson(FILES.settings, next);
  const kicked = kickNonOwnerFailsafeUsers();
  await addSystemLog("owner.checkin.lockdown", "owner-checkin", { trigger, kicked });
  broadcastSettings(next);
  sendDirectEmail(ownerCheckinRecipients(next), "Connectifi owner recovery lock activated", [
    "The owner operational check-in has activated the recovery lock.",
    `Reason: ${trigger}`,
    `Time: ${now.toISOString()}`,
    "The server remains locked until the owner admin enters the recovery code.",
  ].join("\n"), { route: "loginFailures", contactType: "security" }).catch(() => {});
  return next;
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
    cloudStorageReady: cloudStorageConfigured() || persistence.ready,
    cloudinaryConfigured: cloudinaryConfigured(),
    cloudinaryFolder: cloudinaryConfigured() ? CLOUDINARY_FOLDER : "",
    backblazeConfigured: b2Configured(),
    backblazeBucket: b2Configured() ? B2_BUCKET_NAME : "",
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
  if (!persistence.ready && !cloudinaryConfigured() && !b2Configured()) return;
  const files = await readJson(FILES.uploads, []);
  if (!Array.isArray(files) || !files.length) return;

  let changed = false;
  for (const record of files) {
    if (!record || !record.storedName) continue;
    const localPath = path.join(UPLOAD_DIR, record.storedName);
    if ((UPLOAD_PROVIDER === "b2" || UPLOAD_PROVIDER === "backblaze") && b2Configured() && record.cloudStorage !== "backblaze-b2") {
      try {
        if (fs.existsSync(localPath)) {
          const b2File = await uploadLocalFileToB2(record.storedName, localPath, record);
          record.cloudStorage = "backblaze-b2";
          record.b2FileId = b2File.fileId || "";
          record.b2FileName = b2File.fileName || `inner/${record.storedName}`;
          record.persistence = record.persistence && record.persistence.includes("disk") ? "disk+backblaze-b2" : "backblaze-b2";
          delete record.inlineData;
          record.inlineEncoding = "";
          record.inlineSize = 0;
          changed = true;
          continue;
        } else if (record.inlineEncoding === "base64" && record.inlineData) {
          const buffer = Buffer.from(record.inlineData, "base64");
          const b2File = await uploadBufferToB2(record.storedName, buffer, record);
          record.cloudStorage = "backblaze-b2";
          record.b2FileId = b2File.fileId || "";
          record.b2FileName = b2File.fileName || `inner/${record.storedName}`;
          record.persistence = "backblaze-b2";
          delete record.inlineData;
          record.inlineEncoding = "";
          record.inlineSize = 0;
          changed = true;
          continue;
        }
      } catch (error) {
        persistence.error = error.message || "Backblaze B2 migration failed";
        console.error("[persistence] backblaze migration failed:", record.originalName || record.storedName, persistence.error);
      }
    }
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
  const recipients = recipientsForEmailRoute(settings, options.route || "general");
  return sendEmailToRecipients(recipients, subject, body, options);
}

function recipientsForEmailRoute(settings, route) {
  const cleanRoute = sanitizeEmailRouteKey(route || "general");
  const routes = settings && settings.emailRoutes && typeof settings.emailRoutes === "object" ? settings.emailRoutes : {};
  const routeList = Array.isArray(routes[cleanRoute]) ? routes[cleanRoute] : [];
  const fallbackList = Array.isArray(settings && settings.reportEmails) ? settings.reportEmails : [];
  const clean = routeList.map(cleanEmailAddress).filter(Boolean);
  const fallback = fallbackList.map(cleanEmailAddress).filter(Boolean);
  return (clean.length ? clean : fallback.length ? fallback : REPORT_EMAILS).slice(0, 10);
}

function cleanEmailAddress(value) {
  const email = String(value || "").trim();
  return email.includes("@") ? email : "";
}

function sanitizeAcceptedEmailDomains(source = []) {
  const rawList = Array.isArray(source)
    ? source
    : String(source || "").split(",");
  const seen = new Set();
  return rawList
    .map((entry) => String(entry || "").trim().toLowerCase())
    .map((entry) => entry.replace(/^@+/, "").replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .map((entry) => entry.replace(/[^a-z0-9.*-]/g, ""))
    .filter((entry) => entry && entry.includes(".") && !entry.includes(".."))
    .map((entry) => entry.startsWith("*.") ? entry : entry.startsWith(".") ? `*${entry}` : entry)
    .filter((entry) => {
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    })
    .slice(0, 25);
}

function emailDomainValidationError(email, settings = {}) {
  const allowed = sanitizeAcceptedEmailDomains(settings.acceptedEmailDomains || []);
  if (!allowed.length) return "";
  const clean = cleanEmailAddress(email).toLowerCase();
  if (!clean) return `Use an email from: ${allowed.join(", ")}`;
  const domain = clean.split("@").pop();
  const matched = allowed.some((rule) => {
    if (rule.startsWith("*.")) {
      const suffix = rule.slice(2);
      return domain === suffix || domain.endsWith(`.${suffix}`);
    }
    return domain === rule;
  });
  return matched ? "" : `Use an email from: ${allowed.join(", ")}`;
}

function sanitizeEmailRoutes(routes = {}) {
  const allowed = emailRouteKeys();
  const next = {};
  allowed.forEach((key) => {
    const list = Array.isArray(routes[key]) ? routes[key] : [];
    next[key] = list.map(cleanEmailAddress).filter(Boolean).slice(0, 10);
  });
  return next;
}

function emailRouteKeys() {
  return ["reports", "accountRequests", "signups", "accountApprovals", "accountCreated", "announcements", "loginFailures", "general"];
}

function sanitizeEmailRouteKey(route) {
  const key = String(route || "").trim();
  return emailRouteKeys().includes(key) ? key : "general";
}

function emailRouteLabel(route) {
  return {
    reports: "report alert",
    accountRequests: "account request",
    signups: "signup",
    accountApprovals: "account approval",
    accountCreated: "account creation",
    announcements: "announcement",
    loginFailures: "security",
    general: "general",
  }[sanitizeEmailRouteKey(route)] || "general";
}

function defaultEmailContacts() {
  const fromEmail = parseEmailFrom(EMAIL_FROM).email;
  return {
    noreply: cleanEmailAddress(firstEnvValue("INNER_NOREPLY_EMAIL") || fromEmail || "noreply@connectifi.in") || "",
    reports: cleanEmailAddress(firstEnvValue("INNER_REPORT_EMAIL", "INNER_REPORTS_EMAIL") || "report@connectifi.in") || "",
    security: cleanEmailAddress(firstEnvValue("INNER_SECURITY_EMAIL") || "security@connectifi.in") || "",
    support: cleanEmailAddress(firstEnvValue("INNER_SUPPORT_EMAIL") || EMAIL_REPLY_TO || "support@connectifi.in") || "",
    admin: cleanEmailAddress(firstEnvValue("INNER_ADMIN_CONTACT_EMAIL") || REPORT_EMAILS[0] || "admin@connectifi.in") || "",
  };
}

function sanitizeEmailContacts(source = {}) {
  const defaults = defaultEmailContacts();
  return {
    noreply: cleanEmailAddress(source.noreply) || defaults.noreply,
    reports: cleanEmailAddress(source.reports) || defaults.reports,
    security: cleanEmailAddress(source.security) || defaults.security,
    support: cleanEmailAddress(source.support) || defaults.support,
    admin: cleanEmailAddress(source.admin) || defaults.admin,
  };
}

function contactTypeForEmailRoute(route) {
  return {
    reports: "reports",
    loginFailures: "security",
    accountRequests: "admin",
    signups: "admin",
    accountApprovals: "admin",
    accountCreated: "admin",
    announcements: "support",
    general: "support",
  }[sanitizeEmailRouteKey(route)] || "support";
}

function contactForEmail(settings, options = {}) {
  const contacts = sanitizeEmailContacts(settings && settings.emailContacts ? settings.emailContacts : {});
  const type = ["noreply", "reports", "security", "support", "admin"].includes(options.contactType) ? options.contactType : contactTypeForEmailRoute(options.route || "general");
  return {
    type,
    email: contacts[type] || contacts.support || EMAIL_REPLY_TO || "",
    from: options.fromContact ? (contacts[type] || contacts.support || parseEmailFrom(EMAIL_FROM).email || "") : (contacts.noreply || parseEmailFrom(EMAIL_FROM).email || ""),
    contacts,
  };
}

async function sendDirectEmail(recipients, subject, body, options = {}) {
  const cleanRecipients = Array.isArray(recipients)
    ? recipients.map((entry) => String(entry || "").trim()).filter((entry) => entry.includes("@")).slice(0, 10)
    : [];
  return sendEmailToRecipients(cleanRecipients, subject, body, options);
}

async function sendEmailToRecipients(recipients, subject, body, options = {}) {
  const settings = await readJson(FILES.settings, {}).catch(() => ({}));
  const contact = contactForEmail(settings, options);
  if (!recipients.length && !EMAIL_WEBHOOK_URL) {
    await addSystemLog("email.skipped", "system", { subject, reason: "No recipients configured" });
    const result = { ok: false, reason: "No recipients configured", recipients, provider: "", status: 0 };
    return options.detailed ? result : false;
  }
  const payload = {
    subject,
    body,
    from: emailFromForContact(contact),
    html: buildEmailHtml(subject, body, { ...options, contact }),
    replyTo: options.replyTo || contact.email || EMAIL_REPLY_TO || "",
    contact,
    recipients,
    app: "Connectifi",
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

function publicBaseUrl(req) {
  const configured = firstEnvValue("INNER_PUBLIC_URL", "PUBLIC_URL", "RENDER_EXTERNAL_URL");
  if (configured) return String(configured).replace(/\/+$/, "");
  const proto = firstForwardedValue(req.headers["x-forwarded-proto"]) || (req.socket.encrypted ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.headers.host || `${HOST}:${PORT}`;
  return `${proto}://${host}`.replace(/\/+$/, "");
}

async function sendResendEmail(payload) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: payload.from || EMAIL_FROM,
      to: payload.recipients,
      subject: payload.subject,
      text: payload.body,
      html: payload.html,
      reply_to: payload.replyTo || undefined,
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
  const { email, name } = parseEmailFrom(payload.from || EMAIL_FROM || SMTP_USER);
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
    `Reply-To: ${payload.replyTo || EMAIL_REPLY_TO || email}`,
    "Content-Type: multipart/alternative; boundary=inner-email-boundary",
    "",
    "--inner-email-boundary",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    emailTextWithFooter(payload),
    "--inner-email-boundary",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    payload.html,
    "--inner-email-boundary--",
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
  const { email, name } = parseEmailFrom(payload.from || EMAIL_FROM);
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
      textContent: emailTextWithFooter(payload),
      htmlContent: payload.html,
      replyTo: payload.replyTo ? { email: payload.replyTo } : undefined,
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
  const { email, name } = parseEmailFrom(payload.from || EMAIL_FROM);
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: payload.recipients.map((address) => ({ email: address })) }],
      from: { email, name: name || "Inner" },
      reply_to: payload.replyTo ? { email: payload.replyTo } : undefined,
      subject: payload.subject,
      content: [
        { type: "text/plain", value: emailTextWithFooter(payload) },
        { type: "text/html", value: payload.html },
      ],
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
  return { name: "Connectifi", email: raw || "noreply@example.com" };
}

function emailProviderStatus(recipients = []) {
  const parsedFrom = parseEmailFrom(EMAIL_FROM);
  return {
    recipients: recipients.length ? recipients : REPORT_EMAILS,
    from: EMAIL_FROM,
    fromEmail: parsedFrom.email,
    replyTo: EMAIL_REPLY_TO || "",
    contacts: sanitizeEmailContacts(),
    providers: {
      smtp: smtpConfigured(),
      brevo: Boolean(BREVO_API_KEY),
      resend: Boolean(RESEND_API_KEY),
      sendgrid: Boolean(SENDGRID_API_KEY),
      webhook: Boolean(EMAIL_WEBHOOK_URL),
    },
  };
}

function emailTextWithFooter(payload) {
  const replyTo = payload.replyTo || (payload.contact && payload.contact.email) || EMAIL_REPLY_TO || "";
  const footer = replyTo
    ? `\n\nReplying to this email goes to ${replyTo}.`
    : "\n\nReplying to this email may not reach the right team until a reply-to address is configured.";
  return `${payload.body || ""}${footer}\n\nInner`;
}

function emailFromForContact(contact = {}) {
  const email = cleanEmailAddress(contact.from) || cleanEmailAddress(contact.email) || parseEmailFrom(EMAIL_FROM).email;
  return email ? `Connectifi <${email}>` : EMAIL_FROM;
}

function buildEmailHtml(subject, body, options = {}) {
  const contact = options.contact || {};
  const replyTo = contact.email || EMAIL_REPLY_TO || "";
  const label = options.actionLabel || emailRouteLabel(options.route || "general");
  const ctaUrl = sanitizeExternalUrl(options.ctaUrl || "");
  const bodyHtml = String(body || "")
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const cta = ctaUrl
    ? `<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#151515;color:#fff;text-decoration:none;border-radius:8px;padding:12px 16px;font-weight:700;">${escapeHtml(options.actionLabel || "Open Connectifi")}</a>`
    : "";
  const replyLine = replyTo
    ? `Replying to this email goes to <a href="mailto:${escapeHtml(replyTo)}" style="color:#245c4f;font-weight:700;">${escapeHtml(replyTo)}</a>.`
    : "Replies are not connected until a reply-to/contact email is configured.";
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f6f6f2;color:#151515;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f2;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #deded6;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:22px 24px;background:#151515;color:#ffffff;">
                <div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#a6d7ca;">Connectifi</div>
                <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2;">${escapeHtml(subject)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;font-size:16px;line-height:1.55;">
                <div style="display:inline-block;margin-bottom:14px;padding:6px 10px;border:1px solid #d8ded8;border-radius:999px;color:#245c4f;background:#eef6f3;font-size:13px;font-weight:800;">${escapeHtml(label)}</div>
                ${bodyHtml}
                ${cta ? `<div style="margin-top:20px;">${cta}</div>` : ""}
                ${ctaUrl ? `<p style="margin-top:14px;color:#5d625f;font-size:14px;">If the button does not open, use this link:<br><a href="${escapeHtml(ctaUrl)}" style="color:#245c4f;word-break:break-all;">${escapeHtml(ctaUrl)}</a></p>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;border-top:1px solid #e6e6df;color:#5d625f;font-size:13px;line-height:1.45;">
                ${replyLine}<br>
                Contact type: ${escapeHtml(contact.type || "support")}. Sent by Connectifi.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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

async function serveBrowserFrame(req, res, requestUrl, user) {
  const target = sanitizeExternalUrl(requestUrl.searchParams.get("url"));
  if (!target) return text(res, 400, "Enter a valid http or https URL");
  const settings = await readJson(FILES.settings, {});
  const policyError = browserPolicyError(target, settings.browserPolicy || {}, user);
  if (policyError) return browserFrameMessage(res, 403, "Site blocked by Connectifi", policyError);
  await addSystemLog("browser.open", user.username, browserOpenDetails(target), req);
  if (typeof fetch !== "function") return text(res, 500, "Server fetch is unavailable");
  try {
    const response = await fetch(target, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 Connectifi Browser",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const contentType = response.headers.get("content-type") || "text/html; charset=utf-8";
    const arrayBuffer = await response.arrayBuffer();
    const body = Buffer.from(arrayBuffer);
    res.statusCode = response.ok ? 200 : response.status;
    res.setHeader("Content-Type", contentType.includes("text/html") ? "text/html; charset=utf-8" : contentType);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    if (!contentType.includes("text/html")) return res.end(body);
    const escapedTarget = escapeHtml(target);
    const baseTag = `<base href="${escapedTarget}">`;
    const cleaned = body.toString("utf8")
      .replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/\s(?:integrity|nonce)=("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
    return res.end(cleaned.includes("<head") ? cleaned : `${baseTag}${cleaned}`);
  } catch (error) {
    return browserFrameMessage(res, 502, "Connectifi browser could not open this site", `${error.message || "fetch failed"}\n\nIf your network blocks this site, Connectifi cannot bypass that.`);
  }
}

function browserPolicyError(target, policy, user) {
  if (canOwn(user)) return "";
  const host = hostnameForPolicy(target);
  const next = sanitizeBrowserPolicy(policy || {});
  if (!host) return "Invalid site.";
  if (next.blockedSites.some((domain) => domainMatches(host, domain))) return `${host} is blocked by the Connectifi browser rules.`;
  if (next.allowOnly && !next.allowedSites.some((domain) => domainMatches(host, domain))) return `${host} is not on the allowed site list.`;
  return "";
}

function browserOpenDetails(target) {
  try {
    const parsed = new URL(target);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const searchParams = parsed.searchParams;
    const query = searchParams.get("q") || searchParams.get("query") || searchParams.get("search") || "";
    return {
      url: target.slice(0, 700),
      host: host.slice(0, 120),
      query: String(query || "").trim().slice(0, 240),
      path: `${parsed.pathname || "/"}${parsed.search || ""}`.slice(0, 500),
    };
  } catch (error) {
    return { url: String(target || "").slice(0, 700), host: "", query: "", path: "" };
  }
}

function hostnameForPolicy(target) {
  try {
    return new URL(target).hostname.toLowerCase().replace(/^www\./, "");
  } catch (error) {
    return "";
  }
}

function domainMatches(host, domain) {
  const clean = String(domain || "").toLowerCase().replace(/^www\./, "");
  return host === clean || host.endsWith(`.${clean}`);
}

function browserFrameMessage(res, status, title, detail) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;margin:0;padding:28px;background:#f7f7f4;color:#151515}.box{max-width:720px;margin:auto;border:1px solid #ddddd6;background:white;border-radius:8px;padding:22px}h1{font-size:1.25rem;margin:0 0 10px}p{white-space:pre-wrap;color:#666}</style></head><body><main class="box"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(detail)}</p></main></body></html>`);
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

function defaultAccountPasswordHash(username) {
  const keyName = String(username || "").toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const hash = firstEnvValue(`INNER_${keyName}_PASSWORD_HASH`, `${keyName}_PASSWORD_HASH`);
  if (hash && String(hash).includes(":")) return String(hash);
  const password = firstEnvValue(`INNER_${keyName}_PASSWORD`, `${keyName}_PASSWORD`, "INNER_DEFAULT_ADMIN_PASSWORD");
  if (password) return hashPassword(String(password));
  return hashPassword(crypto.randomBytes(24).toString("base64url"));
}

function verifyPassword(password, passwordRecord) {
  const [salt, expected] = String(passwordRecord || "").split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === actual.length && crypto.timingSafeEqual(expectedBuffer, actual);
}

function verifyPasswordAsync(password, passwordRecord) {
  const [salt, expected] = String(passwordRecord || "").split(":");
  if (!salt || !expected) return Promise.resolve(false);
  const expectedBuffer = Buffer.from(expected, "hex");
  return new Promise((resolve) => {
    crypto.scrypt(String(password || ""), salt, 64, (error, actual) => {
      if (error || expectedBuffer.length !== actual.length) return resolve(false);
      resolve(crypto.timingSafeEqual(expectedBuffer, actual));
    });
  });
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
    await replaceLocalJsonFile(tempFile, file, jsonText);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fsp.rm(tempFile, { force: true }).catch(() => {});
    throw error;
  }
}

async function replaceLocalJsonFile(tempFile, file, jsonText) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await fsp.rename(tempFile, file);
      return;
    } catch (error) {
      if (!["EPERM", "EACCES", "EBUSY"].includes(error.code) || attempt === 3) {
        await fsp.writeFile(file, jsonText, "utf8");
        await fsp.rm(tempFile, { force: true }).catch(() => {});
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
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
  const [settings, rooms, messages, dms, dmGroups, files, accountRequests, store, aiRequests, innerDocs, users, vpn, profiles, friends, invites, reports, readReceipts, moderationLogs, logs, devConfig, voiceRooms, bots, plugins, automod] = await Promise.all([
    readJson(FILES.settings, {}),
    readJson(FILES.rooms, []),
    readJson(FILES.messages, []),
    readJson(FILES.dms, []),
    readJson(FILES.dmGroups, []),
    readJson(FILES.uploads, []),
    readJson(FILES.accountRequests, []),
    readJson(FILES.store, { items: [], orders: [] }),
    readJson(FILES.aiRequests, []),
    readJson(FILES.innerDocs, []),
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
    app: "Connectifi",
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
      innerDocs,
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
    ["innerDocs", FILES.innerDocs, []],
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
  const config = resolveAiConfig(aiConfig);
  const apiKey = config.apiKey;
  if (!apiKey) {
    return {
      configured: false,
      text:
        "AI is not connected yet. Add any OpenAI-compatible API key/base URL in Admin, then ask again. I saved this request in the Admin panel so it is not lost.",
    };
  }

  if (typeof fetch !== "function") {
    return {
      configured: false,
      text: "This Node runtime does not include fetch, so the AI helper cannot call the API from here.",
    };
  }

  try {
    let response = await fetchAi(config.responsesUrl, apiKey, aiResponsesBody(config, prompt));
    const data = await response.json().catch(() => ({}));
    if (!response.ok && [400, 404, 405].includes(response.status)) {
      response = await fetchAi(config.chatUrl, apiKey, aiChatBody(config, prompt));
      const chatData = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          configured: false,
          text: chatData.error && chatData.error.message ? chatData.error.message : `AI request failed (${response.status})`,
        };
      }
      return {
        configured: true,
        text: extractAiText(chatData) || "AI returned no text.",
      };
    }
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

async function assessAiLoginSecurity(user, login) {
  const aiConfig = await readJson(FILES.ai, {});
  const config = resolveAiConfig(aiConfig);
  if (!config.apiKey || !user || !login) return;

  const history = Array.isArray(user.loginHistory) ? user.loginHistory : [];
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentIps = new Set(history
    .filter((entry) => Date.parse(entry.loggedInAt || "") >= dayAgo)
    .map((entry) => String(entry.ip || "").trim())
    .filter(Boolean));
  const deviceChanged = Boolean(login.previousDevice && login.device && login.previousDevice !== login.device);
  const ipChanged = Boolean(login.previousIp && login.ip && login.previousIp !== login.ip);
  const signalScore = (login.outsideRecentIps ? 1 : 0) + (deviceChanged ? 1 : 0) + (ipChanged ? 1 : 0) + (recentIps.size >= 3 ? 1 : 0);
  if (signalScore < 2) return;

  const flags = await readJson(FILES.aiSecurityFlags, []);
  const fingerprint = `${String(user.username || "").toLowerCase()}|${login.ip || ""}|${login.device || ""}`;
  const recentlyFlagged = Array.isArray(flags) && flags.some((flag) =>
    flag && flag.fingerprint === fingerprint && Date.now() - Date.parse(flag.createdAt || "") < 6 * 60 * 60 * 1000
  );
  if (recentlyFlagged) return;

  const prompt = [
    "You are a security triage assistant for a private workspace.",
    "Assess whether this login pattern warrants an owner review. Do not infer identity, location, intent, or wrongdoing.",
    "Return only JSON in this shape: {\"suspicious\":true|false,\"severity\":\"low\"|\"medium\"|\"high\",\"reason\":\"short factual reason\"}.",
    `Signals: IP changed=${ipChanged}; device changed=${deviceChanged}; new compared with recent IPs=${Boolean(login.outsideRecentIps)}; distinct IPs in last 24h=${recentIps.size}; combined signal score=${signalScore}.`,
  ].join("\n");
  const assessment = await generateAiSecurityAssessment(config, prompt);
  if (!assessment.suspicious) return;

  const flag = {
    id: crypto.randomUUID(),
    fingerprint,
    username: user.username,
    severity: assessment.severity,
    reason: assessment.reason,
    createdAt: new Date().toISOString(),
    loginAt: login.loginAt,
    ip: login.ip || "",
    device: login.device || "",
    signals: {
      ipChanged,
      deviceChanged,
      newComparedWithRecentIps: Boolean(login.outsideRecentIps),
      distinctIpsLast24Hours: recentIps.size,
    },
  };
  const next = [flag, ...(Array.isArray(flags) ? flags : [])].slice(0, 500);
  await writeJson(FILES.aiSecurityFlags, next);
  await addSystemLog("security.ai_login_flag", user.username, { severity: flag.severity, reason: flag.reason }, null);
}

async function generateAiSecurityAssessment(config, prompt) {
  if (typeof fetch !== "function") return { suspicious: true, severity: "medium", reason: "Multiple login signals need owner review." };
  try {
    let response = await fetchAi(config.responsesUrl, config.apiKey, {
      model: config.model,
      instructions: "You triage login anomaly signals. Return only the requested JSON. Never claim certainty or wrongdoing.",
      input: prompt,
      max_output_tokens: 180,
      store: false,
    });
    let data = await response.json().catch(() => ({}));
    if (!response.ok && [400, 404, 405].includes(response.status)) {
      response = await fetchAi(config.chatUrl, config.apiKey, {
        model: config.model,
        messages: [{ role: "system", content: "Return only the requested JSON for login anomaly triage." }, { role: "user", content: prompt }],
        max_tokens: 180,
      });
      data = await response.json().catch(() => ({}));
    }
    if (!response.ok) return { suspicious: true, severity: "medium", reason: "Multiple login signals need owner review." };
    const text = extractAiText(data);
    const match = String(text || "").match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : {};
    const severity = ["low", "medium", "high"].includes(String(parsed.severity || "").toLowerCase())
      ? String(parsed.severity).toLowerCase()
      : "medium";
    return {
      suspicious: parsed.suspicious === true || String(parsed.suspicious).toLowerCase() === "true",
      severity,
      reason: String(parsed.reason || "Multiple login signals need owner review.").replace(/\s+/g, " ").trim().slice(0, 280),
    };
  } catch (error) {
    return { suspicious: true, severity: "medium", reason: "Multiple login signals need owner review." };
  }
}

function resolveAiConfig(aiConfig = {}) {
  const apiKey = firstEnvValue("INNER_AI_API_KEY", "OPENAI_API_KEY") || aiConfig.apiKey || "";
  const baseUrl = sanitizeAiBaseUrl(firstEnvValue("INNER_AI_BASE_URL", "OPENAI_BASE_URL") || aiConfig.baseUrl || "https://api.openai.com/v1");
  return {
    apiKey,
    baseUrl,
    model: String(firstEnvValue("INNER_AI_MODEL", "OPENAI_MODEL") || aiConfig.model || "gpt-5.2").trim() || "gpt-5.2",
    responsesUrl: `${baseUrl.replace(/\/+$/, "")}/responses`,
    chatUrl: `${baseUrl.replace(/\/+$/, "")}/chat/completions`,
  };
}

function sanitizeAiBaseUrl(value) {
  const raw = String(value || "").trim() || "https://api.openai.com/v1";
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) return "https://api.openai.com/v1";
    return parsed.toString().replace(/\/+$/, "");
  } catch (error) {
    return "https://api.openai.com/v1";
  }
}

function fetchAi(url, apiKey, body) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function aiResponsesBody(config, prompt) {
  return {
    model: config.model,
    instructions:
      "You are the built-in admin helper for Inner, a small private workspace app. Help the admin describe safe, small UI/content/admin-setting changes. Do not ask for passwords, secrets, or unsafe surveillance. Return a concise plan and exact text/settings to change.",
    input: prompt,
    max_output_tokens: 700,
    store: false,
  };
}

function aiChatBody(config, prompt) {
  return {
    model: config.model,
    messages: [
      {
        role: "system",
        content:
          "You are the built-in admin helper for Inner, a small private workspace app. Help the admin describe safe, small UI/content/admin-setting changes. Do not ask for passwords, secrets, or unsafe surveillance. Return a concise plan and exact text/settings to change.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 700,
  };
}

function extractAiText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  if (data.choices && data.choices[0] && data.choices[0].message && typeof data.choices[0].message.content === "string") {
    return data.choices[0].message.content;
  }
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
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
  const setCookie = res.getHeader && res.getHeader("Set-Cookie");
  if (setCookie) headers["Set-Cookie"] = setCookie;
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}

function text(res, status, payload) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(payload);
}

async function serveStatic(req, res, filePath) {
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
    if (req.method === "HEAD") return res.end();
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
  const [files, rooms] = await Promise.all([readJson(FILES.uploads, []), readJson(FILES.rooms, [])]);
  const record = files.find((entry) => entry.storedName === storedName);
  if (!record) return text(res, 404, "Not found");
  if (!canAccessFileRecord(record, user, rooms)) return text(res, 403, "Private or unreleased file");

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
    const disposition = `${dispositionType}; filename="${String(record.originalName || record.storedName || "upload").replaceAll('"', "")}"`;
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
            "Cache-Control": record.private ? "no-store" : "private, max-age=60",
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
      "Cache-Control": record.private ? "no-store" : "private, max-age=60",
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
  if (record && record.cloudStorage === "backblaze-b2") {
    return proxyB2Upload(req, res, record);
  }
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
  if (record && record.cloudStorage === "backblaze-b2") {
    await deleteB2Upload(record);
    return;
  }
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

function normalizeReleaseAt(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed).toISOString();
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






