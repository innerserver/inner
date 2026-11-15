const net = require("net");
const fs = require("fs");

// The exception is based on a validated photo extension, never the browser's MIME
// type. Call this only after validateUploadBytes has verified the file signature.
const photoExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"]);
function requiresMalwareScan(extension) {
  return !photoExtensions.has(String(extension || "").toLowerCase());
}
function scanFile(filePath, options = {}) {
  const host = options.host || process.env.INNER_CLAMD_HOST;
  const port = Number(options.port || process.env.INNER_CLAMD_PORT || 3310);
  if (!host) return Promise.reject(Object.assign(new Error("Document scanning is not configured. Photos can still be uploaded; ask an admin to connect the isolated scanner for documents."), { statusCode: 503 }));
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const stream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });
    stream.pause();
    let settled = false, reply = "", bytes = 0, sent = false;
    const fail = (message, statusCode = 503) => Object.assign(new Error(message), { statusCode });
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer); stream.destroy(); socket.destroy();
      if (error) reject(error); else resolve({ status: "clean", engine: "clamav", scannedAt: new Date().toISOString() });
    };
    const timer = setTimeout(() => finish(fail("Document scan timed out. The file was not published.")), options.timeoutMs || 120000);
    timer.unref();
    socket.setTimeout(15000, () => finish(fail("Document scanner stopped responding. The file was not published.")));
    socket.on("error", () => finish(fail("Document scanner is unavailable. The file was not published.")));
    stream.on("error", () => finish(fail("Could not read quarantined upload")));
    socket.on("close", () => { if (!settled) finish(fail("Document scanner disconnected without a result")); });
    socket.on("data", (chunk) => {
      reply += chunk.toString("utf8");
      if (reply.length > 8192) return finish(fail("Invalid scanner response"));
      if (!reply.includes("\0") && !reply.includes("\n")) return;
      const result = reply.replace(/[\0\r\n]+$/, "");
      if (result === "stream: OK" && sent) finish();
      else if (/ FOUND$/.test(result)) {
        const detection = result.replace(/^stream:\s*/, "").replace(/ FOUND$/, "").slice(0, 300);
        const policyLimit = /^Heuristics\.(?:Limits\.|Encrypted\.)/i.test(detection);
        finish(Object.assign(fail(policyLimit ? "The scanner could not fully inspect this document. The file was not published." : "Document blocked by malware scanning. The file was not published.", 400), {
          code: policyLimit ? "UPLOAD_SCAN_POLICY_BLOCK" : "UPLOAD_MALWARE_DETECTED", detection,
        }));
      }
      else finish(fail("The scanner could not fully check this document. The file was not published."));
    });
    socket.on("connect", () => { socket.write("zINSTREAM\0"); stream.resume(); });
    stream.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > (options.maxBytes || 250 * 1024 * 1024)) return finish(fail("File exceeds the scanner size limit", 413));
      const header = Buffer.alloc(4); header.writeUInt32BE(chunk.length);
      socket.write(header);
      if (!socket.write(chunk)) { stream.pause(); socket.once("drain", () => { if (!settled) stream.resume(); }); }
    });
    stream.on("end", () => { if (!settled) { sent = true; socket.write(Buffer.alloc(4)); } });
  });
}
async function inspectUpload(filePath, extension, options = {}) {
  if (!requiresMalwareScan(extension)) return { status: "not-required-photo", engine: "", scannedAt: "" };
  return scanFile(filePath, options);
}
module.exports = { requiresMalwareScan, scanFile, inspectUpload };
