const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = process.env.INNER_DATA_DIR ? path.resolve(process.env.INNER_DATA_DIR) : path.join(ROOT, "data");
const SESSION_COOKIE = "server_app_session";

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

async function readJson(fileName, fallback) {
  try {
    const data = await fs.readFile(path.join(DATA_DIR, fileName), "utf8");
    return JSON.parse(data);
  } catch (error) {
    return fallback;
  }
}

function sendJsonDownload(res, fileName, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

const originalCreateServer = http.createServer;
http.createServer = function patchedCreateServer(listener) {
  return originalCreateServer.call(http, async (req, res) => {
    try {
      const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

      if (req.method === "GET" && requestUrl.pathname === "/api/export/chats") {
        if (!getCookie(req, SESSION_COOKIE)) {
          res.writeHead(401, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
          return res.end(JSON.stringify({ error: "Login required" }));
        }

        const [rooms, messages, dms, files] = await Promise.all([
          readJson("rooms.json", []),
          readJson("messages.json", []),
          readJson("dms.json", []),
          readJson("files.json", []),
        ]);

        const exportedAt = new Date().toISOString();
        return sendJsonDownload(res, `inner-chat-export-${exportedAt.replace(/[:.]/g, "-")}.json`, {
          app: "Inner",
          type: "chat-export",
          version: 1,
          exportedAt,
          data: {
            rooms,
            roomMessages: messages.map((message) => ({
              ...message,
              roomId: message.roomId || "main",
            })),
            directMessages: dms,
            attachmentRecords: files,
          },
        });
      }
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      return res.end(JSON.stringify({ error: "Failed to export chats" }));
    }

    return listener(req, res);
  });
};
