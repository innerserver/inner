const crypto = require("crypto");

module.exports = function createUploadAlerts({ readJson, writeJson, FILES, sendDirectEmail, adminEmails = [], log = () => {} }) {
  let queue = Promise.resolve(), timer = null, retrying = false;
  const sending = new Set();
  const clean = (value, max = 300) => String(value || "").replace(/[\r\n\0]/g, " ").slice(0, max);
  const email = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  function serial(operation) { const next = queue.then(operation); queue = next.catch(() => {}); return next; }
  const load = () => readJson(FILES.uploadIncidents, []);
  async function update(id, change) {
    return serial(async () => {
      const records = await load(), record = records.find((entry) => entry.id === id);
      if (record) { Object.assign(record, change); await writeJson(FILES.uploadIncidents, records); }
    });
  }
  async function destination({ context, releaseRoom, privateUpload }) {
    const [rooms, forms] = await Promise.all([readJson(FILES.rooms, []), context?.startsWith("form:") ? readJson(FILES.questionnaires, []) : []]);
    if (context?.startsWith("form:")) {
      const form = forms.find((entry) => entry.id === context.slice(5));
      return { kind: "form", id: context.slice(5), label: form ? `Form: ${clean(form.title)}; intended for teacher/moderator ${clean(form.createdBy)}` : `Form: ${clean(context.slice(5))}`, recipients: form ? [form.createdBy] : [] };
    }
    const roomId = context?.startsWith("task:") ? context.slice(5) : releaseRoom;
    if (roomId) {
      const room = rooms.find((entry) => entry.id === roomId);
      return { kind: "room", id: roomId, label: `${context?.startsWith("task:") ? "Task reference files for room" : "Room"}: ${clean(room?.name || roomId)}`, recipients: [] };
    }
    return { kind: privateUpload ? "private" : "workspace", id: "", label: privateUpload ? "Private file storage; no room, teacher or individual recipient selected" : "Shared workspace files; no individual recipient selected", recipients: [] };
  }
  async function recipients() {
    const [users, settings] = await Promise.all([readJson(FILES.users, []), readJson(FILES.settings, {})]);
    const owners = users.filter((user) => user.role === "admin" || ["admin", "admin2"].includes(String(user.username).toLowerCase())).map((user) => user.email);
    return [...new Set([...owners, settings.adminContactEmail, settings.emailContacts?.admin, ...(Array.isArray(settings.reportEmails) ? settings.reportEmails : []), ...adminEmails].map((value) => clean(value, 254)).filter(email))].slice(0, 10);
  }
  async function attempt(id) {
    if (sending.has(id)) return "pending";
    sending.add(id);
    try {
      const record = (await load()).find((entry) => entry.id === id);
      if (!record || record.emailStatus === "sent") return record?.emailStatus || "pending";
      const targets = await recipients(), attempts = (record.attempts || 0) + 1;
      await update(id, { emailStatus: "sending", attempts, lastAttemptAt: new Date().toISOString() });
      let delivered = false;
      try {
        if (targets.length) {
          const result = await sendDirectEmail(targets, "Connectifi security: malware upload blocked", [
            "A document upload was blocked after a malware detection.",
            `Uploader: ${record.uploader}`, `File: ${record.fileName}`, `Size: ${record.size} bytes`,
            `Intended destination: ${record.destination.label}`,
            record.destination.recipients.length ? `Intended recipient accounts: ${record.destination.recipients.join(", ")}` : "",
            `Scanner detection: ${record.detection}`, `Time (UTC): ${record.createdAt}`, `Incident ID: ${record.id}`,
            "The file was not published or sent to B2. Its quarantined copy was removed. No file is attached to this email.",
          ].filter(Boolean).join("\n"), { route: "loginFailures", contactType: "security", fromContact: true, detailed: true });
          delivered = result === true || result?.ok === true;
        }
      } catch { /* Keep a durable pending alert when the mail provider is unavailable. */ }
      const emailStatus = delivered ? "sent" : attempts >= 8 ? "failed" : "pending";
      await update(id, { emailStatus, sentAt: delivered ? new Date().toISOString() : "", nextAttemptAt: Date.now() + Math.min(3600000, 60000 * 2 ** (attempts - 1)) });
      return emailStatus;
    } finally { sending.delete(id); }
  }
  async function notify(details) {
    const record = { id: crypto.randomUUID(), uploader: clean(details.user.username, 80), fileName: clean(details.fileName, 180), size: Number(details.size) || 0, detection: clean(details.detection), destination: await destination(details), createdAt: new Date().toISOString(), emailStatus: "pending", attempts: 0, nextAttemptAt: Date.now() };
    await serial(async () => {
      const records = await load();
      if (records.length >= 1000) {
        const removable = records.findIndex((entry) => ["sent", "failed"].includes(entry.emailStatus));
        if (removable !== -1) records.splice(removable, 1);
        else throw new Error("Administrator alert outbox is full");
      }
      records.push(record); await writeJson(FILES.uploadIncidents, records);
    });
    return { incidentId: record.id, emailStatus: await attempt(record.id) };
  }
  async function retry() {
    if (retrying) return;
    retrying = true;
    try {
      const pending = (await load()).filter((entry) => ["pending", "sending"].includes(entry.emailStatus) && (!entry.nextAttemptAt || entry.nextAttemptAt <= Date.now()) && !sending.has(entry.id)).slice(0, 10);
      for (const record of pending) await attempt(record.id);
    } finally { retrying = false; }
  }
  function start() {
    if (timer) return;
    timer = setInterval(() => { void retry().catch(() => log("Malware email retry failed")); }, 60000);
    timer.unref();
  }
  return { notify, retry, start };
};
