const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { pipeline } = require("stream/promises");
const { Transform } = require("stream");

module.exports = function createResumable({ directory, readJsonBody, json, upload, validateContext, maxBytes = 250 * 1024 * 1024 }) {
  const locks = new Set();
  let creationQueue = Promise.resolve();
  const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
  const manifestPath = (id) => path.join(directory, `${id}.json`);
  const partPath = (id) => path.join(directory, `${id}.part`);
  async function save(meta) {
    const temp = `${manifestPath(meta.id)}.${crypto.randomUUID()}.tmp`;
    await fsp.writeFile(temp, JSON.stringify(meta), { flag: "wx", mode: 0o600 });
    await fsp.rename(temp, manifestPath(meta.id));
  }
  async function get(id, username) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw fail("Upload not found", 404);
    const meta = await fsp.readFile(manifestPath(id), "utf8").then(JSON.parse).catch(() => null);
    if (!meta || meta.username !== username) throw fail("Upload not found", 404);
    if (meta.expiresAt < Date.now()) throw fail("Upload expired. Start again.", 410);
    return meta;
  }
  async function handle(req, res, user, url) {
    await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
    const parts = url.pathname.split("/"), id = parts[4], action = parts[5];
    if (req.method === "POST" && !id) {
      const body = await readJsonBody(req);
      const operation = creationQueue.then(async () => {
      if (!Number.isSafeInteger(body.size) || body.size < 1 || body.size > maxBytes || !String(body.name || "").trim()) throw fail("Choose a file between 1 byte and 250 MiB");
      await validateContext(String(body.schoolContext || ""), user);
      const manifests = (await fsp.readdir(directory)).filter((name) => name.endsWith(".json"));
      let owned = 0, active = 0, reservedBytes = 0;
      for (const name of manifests) {
        const item = await fsp.readFile(path.join(directory, name), "utf8").then(JSON.parse).catch(() => null);
        if (item && item.expiresAt <= Date.now() && !locks.has(item.id)) {
          await Promise.all([fsp.rm(manifestPath(item.id), { force: true }), fsp.rm(partPath(item.id), { force: true })]);
        } else if (item && !item.result) {
          active++; reservedBytes += item.size;
          if (item.username === user.username) owned++;
        }
      }
      if (owned >= 3 || active >= 100 || reservedBytes + body.size > Number(process.env.INNER_UPLOAD_STAGING_BYTES || 1024 * 1024 * 1024)) throw fail("Upload staging is full. Finish or cancel an upload first.", 429);
      const meta = { id: crypto.randomUUID(), username: user.username, name: String(body.name).slice(0, 180), type: String(body.type || "application/octet-stream").slice(0, 120), size: body.size, category: String(body.category || "document").slice(0, 40), private: body.private === true, schoolContext: String(body.schoolContext || "").slice(0, 160), releaseRoom: String(body.releaseRoom || "").slice(0, 80), offset: 0, expiresAt: Date.now() + 86400000 };
      await fsp.writeFile(partPath(meta.id), "", { flag: "wx", mode: 0o600 });
      meta.releaseAt = String(body.releaseAt || "").slice(0, 40);
      await save(meta);
      return json(res, 201, { uploadId: meta.id, offset: 0, chunkSize: 2 * 1024 * 1024 });
      });
      creationQueue = operation.catch(() => {});
      return operation;
    }
    let meta = await get(id || "", user.username);
    if (locks.has(id)) throw fail("This upload is busy. Retry shortly.", 409);
    if (req.method === "GET" && !action) return json(res, 200, { uploadId: id, offset: meta.offset, size: meta.size, file: meta.result || null });
    locks.add(id);
    try {
      meta = await get(id, user.username);
      if (req.method === "DELETE" && !action) {
        await Promise.all([fsp.rm(manifestPath(id), { force: true }), fsp.rm(partPath(id), { force: true })]);
        return json(res, 200, { ok: true });
      }
      if (req.method === "PATCH" && !action && !meta.result) {
        const offset = Number(req.headers["upload-offset"]);
        if (offset !== meta.offset) return json(res, 409, { error: "Upload offset changed", offset: meta.offset });
        let received = 0;
        const limit = new Transform({ transform(chunk, _encoding, callback) {
          received += chunk.length;
          callback(received > 2 * 1024 * 1024 || meta.offset + received > meta.size ? fail("Upload chunk is too large", 413) : null, chunk);
        } });
        const timer = setTimeout(() => req.destroy(fail("Upload chunk timed out", 408)), 30000); timer.unref();
        try {
          await pipeline(req, limit, fs.createWriteStream(partPath(id), { flags: "r+", start: meta.offset }));
          if (!received) throw fail("Upload chunk is empty");
          meta.offset += received;
          await save(meta);
        } catch (error) {
          await fsp.truncate(partPath(id), meta.offset).catch(() => {});
          throw error;
        } finally { clearTimeout(timer); }
        return json(res, 200, { offset: meta.offset });
      }
      if (req.method === "POST" && action === "complete") {
        await readJsonBody(req);
        if (meta.result) return json(res, 201, { file: meta.result });
        if (meta.offset !== meta.size || (await fsp.stat(partPath(id))).size !== meta.size) throw fail("Upload is incomplete", 409);
        await validateContext(meta.schoolContext, user);
        const source = fs.createReadStream(partPath(id));
        Object.assign(source, { headers: { ...req.headers, "content-length": String(meta.size), "x-file-name": encodeURIComponent(meta.name), "x-file-type": meta.type, "x-file-category": meta.category, "x-file-private": meta.private ? "true" : "false", "x-file-release-room": meta.releaseRoom, "x-file-release-at": meta.releaseAt || "", "x-school-context": meta.schoolContext }, socket: req.socket, method: "POST", url: "/api/upload", onUploadRejected: async () => { await new Promise((resolve) => source.close(resolve)); await Promise.all([fsp.rm(partPath(id), { force: true }), fsp.rm(manifestPath(id), { force: true })]); }, onUploadCommitted: async (file) => { meta.result = file; await save(meta); } });
        try { await upload(source, res, user); }
        finally { source.destroy(); }
        if (meta.result) await fsp.rm(partPath(id), { force: true });
        return;
      }
      return json(res, 405, { error: "Method not allowed" });
    } finally { locks.delete(id); }
  }
  return { handle };
};
