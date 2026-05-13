const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = process.env.INNER_DATA_DIR ? path.resolve(process.env.INNER_DATA_DIR) : path.join(ROOT, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

const FILES = {
  users: path.join(DATA_DIR, "users.json"),
  rooms: path.join(DATA_DIR, "rooms.json"),
  messages: path.join(DATA_DIR, "messages.json"),
  dms: path.join(DATA_DIR, "dms.json"),
  uploads: path.join(DATA_DIR, "files.json"),
  store: path.join(DATA_DIR, "store.json"),
  aiRequests: path.join(DATA_DIR, "ai-requests.json"),
  ai: path.join(DATA_DIR, "ai.json"),
  settings: path.join(DATA_DIR, "settings.json"),
  vpn: path.join(DATA_DIR, "vpn.json"),
};

const MAX_JSON_BYTES = 1024 * 1024;
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
const SESSION_COOKIE = "server_app_session";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const SESSION_PERSISTENT_MS = 180 * 24 * 60 * 60 * 1000;
const sessions = new Map();
const wsClients = new Map();
const serverStartedAt = new Date().toISOString();
const allowedFeatureLocks = new Set(["messages", "files", "screen", "dms", "rooms", "vpn"]);

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
  ".mun",
]);

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
  await ensureStorage();

  const server = http.createServer((req, res) => {
    route(req, res).catch((error) => {
      console.error(error);
      json(res, 500, { error: "Internal server error" });
    });
  });

  server.on("upgrade", handleUpgrade);

  server.listen(PORT, HOST, () => {
    console.log(`Inner running at http://${HOST}:${PORT}`);
    console.log("Admin login: admin / Devshah@11");
    console.log("Secondary admin login: admin2 / Devshah@11");
  });
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
  await ensureJson(FILES.uploads, []);
  await ensureJson(FILES.store, { items: [], orders: [] });
  await ensureJson(FILES.aiRequests, []);
  await ensureJson(FILES.ai, { apiKey: "", updatedAt: "", updatedBy: "" });
  await ensureJson(FILES.settings, {
    serverEnabled: true,
    roomName: "Inner",
    featureLocks: {},
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
  await ensureSettings();
}

async function ensureUsers() {
  const now = new Date().toISOString();
  const settings = await readJson(FILES.settings, {});
  const deletedDefaults = Array.isArray(settings.deletedDefaultAdmins) ? settings.deletedDefaultAdmins : [];

  if (!fs.existsSync(FILES.users)) {
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
    ]);
    return;
  }

  const users = await readJson(FILES.users, []);
  let changed = false;
  const adminIndex = users.findIndex((entry) => entry.username.toLowerCase() === "admin");
  const admin2Index = users.findIndex((entry) => entry.username.toLowerCase() === "admin2");

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
  }

  if (changed) await writeJson(FILES.rooms, rooms);
}

async function ensureSettings() {
  const settings = await readJson(FILES.settings, {});
  if (!settings.featureLocks || typeof settings.featureLocks !== "object" || Array.isArray(settings.featureLocks)) {
    await writeJson(FILES.settings, {
      ...settings,
      featureLocks: {},
      updatedAt: new Date().toISOString(),
      updatedBy: settings.updatedBy || "system",
    });
  }
}

async function ensureJson(file, fallback) {
  if (!fs.existsSync(file)) {
    await writeJson(file, fallback);
  }
}

async function route(req, res) {
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
    return serveStatic(res, safePath);
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
      return json(res, 401, { error: "Invalid username or password" });
    }

    if (!canManage(user) && isUserBanned(user)) {
      return json(res, 403, { error: `Account is temporarily banned until ${new Date(user.bannedUntil).toLocaleString()}` });
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

    const userIndex = users.findIndex((entry) => entry.username.toLowerCase() === user.username.toLowerCase());
    if (userIndex !== -1) {
      users[userIndex] = {
        ...users[userIndex],
        lastLoginAt: new Date().toISOString(),
        lastLoginIp: getClientIp(req),
      };
      await writeJson(FILES.users, users);
    }

    const cookieParts = [`${SESSION_COOKIE}=${token}`, "HttpOnly", "SameSite=Lax", "Path=/"];
    if (persistent) cookieParts.push(`Max-Age=${Math.floor(SESSION_PERSISTENT_MS / 1000)}`);
    res.setHeader("Set-Cookie", cookieParts.join("; "));
    return json(res, 200, { user: safeUser(user) });
  }

  if (req.method === "POST" && pathname === "/api/logout") {
    const token = getCookie(req, SESSION_COOKIE);
    if (token) sessions.delete(token);
    res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    return json(res, 200, { ok: true });
  }

  if (req.method === "GET" && pathname === "/api/health") {
    return json(res, 200, {
      ok: true,
      app: "Inner",
      startedAt: serverStartedAt,
    });
  }

  const user = requireUser(req, res);
  if (!user) return;

  if (req.method === "GET" && pathname === "/api/me") {
    return json(res, 200, { user });
  }

  if (req.method === "GET" && pathname === "/api/state") {
    const [settings, rooms, messages, dms, files, store, aiRequests, aiConfig, vpn, users, backups] = await Promise.all([
      readJson(FILES.settings, {}),
      readJson(FILES.rooms, []),
      readJson(FILES.messages, []),
      readJson(FILES.dms, []),
      readJson(FILES.uploads, []),
      readJson(FILES.store, { items: [], orders: [] }),
      readJson(FILES.aiRequests, []),
      readJson(FILES.ai, {}),
      readJson(FILES.vpn, {}),
      readJson(FILES.users, []),
      canManage(user) ? listBackups() : [],
    ]);
    const normalizedMessages = messages.map((message) => ({
      ...message,
      roomId: message.roomId || "main",
    }));
    const visibleDms = canManage(user)
      ? dms
      : dms.filter((entry) => Array.isArray(entry.participants) && entry.participants.includes(user.username));
    return json(res, 200, {
      user,
      settings: safeSettings(settings),
      rooms,
      messages: normalizedMessages.slice(-500),
      dms: visibleDms.slice(-500),
      files,
      store: safeStore(store, user),
      aiRequests: canManage(user) ? aiRequests.slice(-100) : [],
      aiConfigured: canManage(user) ? Boolean(process.env.OPENAI_API_KEY || aiConfig.apiKey) : false,
      vpn: safeVpn(vpn),
      locations: vpnLocations,
      users: canManage(user) ? users.map(safeUser) : [],
      people: users.map(publicUser),
      backups,
    });
  }

  if (req.method === "POST" && pathname === "/api/messages") {
    const settings = await readJson(FILES.settings, {});
    if (!settings.serverEnabled && !canManage(user)) return json(res, 423, { error: "Server room is off" });
    const featureError = featureBlocked(settings, "messages", user);
    if (featureError) return json(res, 423, { error: featureError });

    const body = await readJsonBody(req);
    const textValue = String(body.text || "").trim();
    const roomId = String(body.roomId || "main").trim() || "main";
    const attachment = await resolveChatAttachment(body.attachment);
    if (!textValue && !attachment) return json(res, 400, { error: "Message cannot be empty" });
    if (textValue.length > 2000) return json(res, 400, { error: "Message is too long" });
    if (roomId !== "main") {
      const roomFeatureError = featureBlocked(settings, "rooms", user);
      if (roomFeatureError) return json(res, 423, { error: roomFeatureError });
    }

    const rooms = await readJson(FILES.rooms, []);
    if (!rooms.some((room) => room.id === roomId)) return json(res, 404, { error: "Room not found" });

    const messages = await readJson(FILES.messages, []);
    const message = {
      id: crypto.randomUUID(),
      roomId,
      text: textValue,
      attachment,
      user: user.username,
      sourceIp: getClientIp(req),
      sourceHost: req.headers.host || "",
      sourceAgent: String(req.headers["user-agent"] || "").slice(0, 240),
      createdAt: new Date().toISOString(),
    };
    messages.push(message);
    await writeJson(FILES.messages, messages.slice(-3000));
    broadcast({ type: "message:new", message });
    return json(res, 201, { message });
  }

  if (req.method === "POST" && pathname === "/api/upload") {
    const settings = await readJson(FILES.settings, {});
    if (!settings.serverEnabled && !canManage(user)) return json(res, 423, { error: "Server room is off" });
    const featureError = featureBlocked(settings, "files", user);
    if (featureError) return json(res, 423, { error: featureError });
    return saveUpload(req, res, user);
  }

  if (req.method === "GET" && pathname === "/api/files") {
    const files = await readJson(FILES.uploads, []);
    return json(res, 200, { files });
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
      createdAt: new Date().toISOString(),
      createdBy: user.username,
    };
    rooms.push(room);
    await writeJson(FILES.rooms, rooms);
    broadcast({ type: "room:new", room });
    return json(res, 201, { room, rooms });
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
    broadcast({ type: "room:delete", id });
    return json(res, 200, { rooms: nextRooms });
  }

  if (req.method === "POST" && pathname === "/api/dms") {
    const settings = await readJson(FILES.settings, {});
    if (!settings.serverEnabled && !canManage(user)) return json(res, 423, { error: "Server room is off" });
    const featureError = featureBlocked(settings, "dms", user);
    if (featureError) return json(res, 423, { error: featureError });

    const body = await readJsonBody(req);
    const to = String(body.to || "").trim();
    const textValue = String(body.text || "").trim();
    if (!to) return json(res, 400, { error: "Choose who to message" });
    if (to.toLowerCase() === user.username.toLowerCase()) return json(res, 400, { error: "Choose another account" });
    const attachment = await resolveChatAttachment(body.attachment);
    if (!textValue && !attachment) return json(res, 400, { error: "Message cannot be empty" });
    if (textValue.length > 2000) return json(res, 400, { error: "Message is too long" });

    const users = await readJson(FILES.users, []);
    const recipient = users.find((entry) => entry.username.toLowerCase() === to.toLowerCase());
    if (!recipient) return json(res, 404, { error: "Account not found" });

    const dms = await readJson(FILES.dms, []);
    const dm = {
      id: crypto.randomUUID(),
      from: user.username,
      to: recipient.username,
      participants: [user.username, recipient.username],
      text: textValue,
      attachment,
      sourceIp: getClientIp(req),
      sourceHost: req.headers.host || "",
      sourceAgent: String(req.headers["user-agent"] || "").slice(0, 240),
      createdAt: new Date().toISOString(),
    };
    dms.push(dm);
    await writeJson(FILES.dms, dms.slice(-3000));
    broadcastDm({ type: "dm:new", dm }, dm);
    return json(res, 201, { dm });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/dms/")) {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const id = pathname.split("/").pop();
    const dms = await readJson(FILES.dms, []);
    const dm = dms.find((entry) => entry.id === id);
    if (!dm) return json(res, 404, { error: "DM not found" });

    const next = dms.filter((entry) => entry.id !== id);
    await writeJson(FILES.dms, next);
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

  if (req.method === "POST" && pathname === "/api/users") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const username = normalizeUsername(body.username);
    const password = String(body.password || "");
    const role = normalizeRole(body.role) === "admin" ? "admin" : "member";
    if (!username) return json(res, 400, { error: "Use 3-32 letters, numbers, dots, dashes, or underscores" });
    if (username.toLowerCase() === "admin") return json(res, 400, { error: "The admin account already exists" });
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
    if (username.toLowerCase() === "admin2") await unmarkDeletedDefault("admin2", user.username);
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
    users[index] = {
      ...previous,
      role: nextRole,
      allowPersistentLogin: Boolean(body.allowPersistentLogin),
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
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
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
    if (minutes > 0) expireUserSessions(username);
    broadcastManagers({ type: "users:update", users: users.map(safeUser) });
    return json(res, 200, { users: users.map(safeUser) });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/messages/")) {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const id = pathname.split("/").pop();
    const messages = await readJson(FILES.messages, []);
    const next = messages.filter((entry) => entry.id !== id);
    if (next.length === messages.length) return json(res, 404, { error: "Message not found" });
    await writeJson(FILES.messages, next);
    broadcast({ type: "message:delete", id });
    return json(res, 200, { ok: true });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/files/")) {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const id = pathname.split("/").pop();
    const files = await readJson(FILES.uploads, []);
    const record = files.find((entry) => entry.id === id);
    if (!record) return json(res, 404, { error: "File not found" });
    const next = files.filter((entry) => entry.id !== id);
    await writeJson(FILES.uploads, next);
    await fsp.rm(path.join(UPLOAD_DIR, record.storedName), { force: true }).catch(() => {});
    broadcast({ type: "file:delete", id });
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/settings") {
    if (!canManage(user)) return json(res, 403, { error: "Admin access required" });
    const body = await readJsonBody(req);
    const settings = await readJson(FILES.settings, {});
    const next = {
      ...settings,
      serverEnabled:
        typeof body.serverEnabled === "boolean" ? body.serverEnabled : Boolean(settings.serverEnabled),
      roomName: String(body.roomName || settings.roomName || "Inner").slice(0, 80),
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    await writeJson(FILES.settings, next);
    broadcast({ type: "state:update", settings: safeSettings(next) });
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

  json(res, 404, { error: "API route not found" });
}

async function saveUpload(req, res, user) {
  const originalName = sanitizeFileName(req.headers["x-file-name"] || "upload.bin");
  const providedType = String(req.headers["x-file-type"] || "application/octet-stream").slice(0, 120);
  const category = normalizeCategory(req.headers["x-file-category"] || "document");
  const extension = path.extname(originalName).toLowerCase();

  if (!allowedExtensions.has(extension)) {
    return json(res, 400, {
      error: "Unsupported file type. Upload photos, video, audio, documents, MUN files, or important documents.",
    });
  }

  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > MAX_UPLOAD_BYTES) {
    return json(res, 413, { error: "File is larger than 250 MB" });
  }

  const storedName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;
  const target = path.join(UPLOAD_DIR, storedName);
  let written = 0;

  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(target, { flags: "wx" });

    req.on("data", (chunk) => {
      written += chunk.length;
      if (written > MAX_UPLOAD_BYTES) {
        out.destroy(new Error("File is larger than 250 MB"));
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

  const files = await readJson(FILES.uploads, []);
  const fileRecord = {
    id: crypto.randomUUID(),
    originalName,
    storedName,
    category,
    kind: classifyFile(extension, providedType),
    mimeType: mimeTypes[extension] || providedType || "application/octet-stream",
    size: written,
    user: user.username,
    sourceIp: getClientIp(req),
    sourceHost: req.headers.host || "",
    sourceAgent: String(req.headers["user-agent"] || "").slice(0, 240),
    createdAt: new Date().toISOString(),
    url: `/uploads/${encodeURIComponent(storedName)}`,
  };
  files.unshift(fileRecord);
  await writeJson(FILES.uploads, files);
  broadcast({ type: "file:new", file: fileRecord });
  return json(res, 201, { file: fileRecord });
}

async function resolveChatAttachment(attachment) {
  if (!attachment || typeof attachment !== "object") return null;
  const id = String(attachment.id || "");
  if (!id) return null;
  const files = await readJson(FILES.uploads, []);
  const file = files.find((entry) => entry.id === id);
  if (!file) return null;
  if (!["image", "video"].includes(file.kind)) return null;
  return {
    id: file.id,
    originalName: file.originalName,
    category: file.category,
    kind: file.kind,
    mimeType: file.mimeType,
    size: file.size,
    user: file.user,
    createdAt: file.createdAt,
    url: file.url,
  };
}

function handleUpgrade(req, socket) {
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
    sharing: false,
  };
  wsClients.set(id, client);

  sendWs(client, {
    type: "hello",
    clientId: id,
    user: safeUser(user),
    peers: peerList(id),
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
      handleWsMessage(client, JSON.parse(data.toString("utf8")));
    } catch (error) {
      sendWs(client, { type: "error", error: "Bad websocket message" });
    }
  }
}

async function handleWsMessage(client, message) {
  if (message.type === "ping") {
    return sendWs(client, { type: "pong", at: Date.now() });
  }

  const settings = await readJson(FILES.settings, {});
  if (!settings.serverEnabled && !canManage(client) && (message.type === "signal" || message.type === "screen:status")) {
    return sendWs(client, { type: "error", error: "Server room is off" });
  }
  const screenFeatureError = featureBlocked(settings, "screen", client);
  if (screenFeatureError && (message.type === "signal" || message.type === "screen:status" || message.type === "screen:request")) {
    return sendWs(client, { type: "error", error: screenFeatureError });
  }

  if (message.type === "signal") {
    const target = wsClients.get(String(message.target || ""));
    if (!target) return;
    return sendWs(target, {
      type: "signal",
      from: client.id,
      fromUser: client.username,
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

  if (message.type === "screen:status") {
    client.sharing = Boolean(message.sharing);
    return broadcast({
      type: "screen:status",
      from: client.id,
      fromUser: client.username,
      sharing: client.sharing,
    });
  }
}

function removeClient(id) {
  const client = wsClients.get(id);
  if (!client) return;
  wsClients.delete(id);
  broadcast({ type: "peer:left", peerId: id, username: client.username });
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
  };
}

function broadcast(payload, exceptId) {
  for (const client of wsClients.values()) {
    if (client.id !== exceptId) sendWs(client, payload);
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

function broadcastStoreUpdate(store, orderUser) {
  for (const client of wsClients.values()) {
    if (canManage(client) || client.username === orderUser) {
      sendWs(client, { type: "store:update", store: safeStore(store, client) });
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

function safeUser(user) {
  return {
    username: user.username,
    role: normalizeRole(user.role),
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
  };
}

function publicUser(user) {
  return {
    username: user.username,
    role: normalizeRole(user.role),
    banned: isUserBanned(user),
  };
}

function safeSettings(settings) {
  return {
    ...settings,
    featureLocks: activeFeatureLocks(settings.featureLocks || {}),
  };
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
  const lock = activeFeatureLocks(settings.featureLocks || {})[feature];
  if (!lock) return "";
  const label = feature === "dms" ? "DMs" : feature.charAt(0).toUpperCase() + feature.slice(1);
  return `${label} disabled until ${new Date(lock.disabledUntil).toLocaleString()}${lock.reason ? `: ${lock.reason}` : ""}`;
}

function normalizeRole(role) {
  return role === "owner" || role === "admin" ? "admin" : "member";
}

function canManage(user) {
  return normalizeRole(user && user.role) === "admin";
}

function isUserBanned(user) {
  if (!user || !user.bannedUntil) return false;
  const until = Date.parse(user.bannedUntil);
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

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const raw = forwarded || req.socket.remoteAddress || "";
  return raw.replace(/^::ffff:/, "");
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
  try {
    const data = await fsp.readFile(file, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return fallback;
  }
}

async function writeJson(file, value) {
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
  const [settings, rooms, messages, dms, files, store, aiRequests, users, vpn] = await Promise.all([
    readJson(FILES.settings, {}),
    readJson(FILES.rooms, []),
    readJson(FILES.messages, []),
    readJson(FILES.dms, []),
    readJson(FILES.uploads, []),
    readJson(FILES.store, { items: [], orders: [] }),
    readJson(FILES.aiRequests, []),
    readJson(FILES.users, []),
    readJson(FILES.vpn, {}),
  ]);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `inner-backup-${timestamp}.json`;
  const backup = {
    app: "Inner",
    version: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: username,
    note: "This backup includes account password hashes and chat history. Uploaded file contents remain in data/uploads.",
    data: {
      settings,
      rooms,
      messages,
      dms,
      files,
      store,
      aiRequests,
      users,
      vpn: safeVpn(vpn),
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
  const featureError = featureBlocked(settings, "files", user);
  if (featureError) return text(res, 423, featureError);
  const storedName = path.basename(pathname);
  const files = await readJson(FILES.uploads, []);
  const record = files.find((entry) => entry.storedName === storedName);
  if (!record) return text(res, 404, "Not found");

  const target = path.join(UPLOAD_DIR, storedName);
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
    text(res, 404, "Not found");
  }
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
