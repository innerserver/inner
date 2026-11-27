const { randomUUID } = require("node:crypto");

const SCHOOL_LINKS = new Map([
  ["docs.google.com", /^\/(?:document|presentation|spreadsheets|forms)\/d\/(?:e\/)?[\w-]+(?:\/|$)/],
  ["drive.google.com", /^\/(?:file\/d|drive\/folders)\/[\w-]+(?:\/|$)/],
  ["www.canva.com", /^\/design\/[\w-]+(?:\/|$)/],
  ["canva.com", /^\/design\/[\w-]+(?:\/|$)/],
  ["canva.link", /^\/[\w-]+(?:\/|$)/],
]);

function normalizeSchoolLink(value) {
  if (typeof value !== "string" || value.length > 2000) return "";
  try {
    const url = new URL(value.trim());
    const allowedPath = SCHOOL_LINKS.get(url.hostname);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !allowedPath?.test(url.pathname)) return "";
    return url.href;
  } catch {
    return "";
  }
}

function createPersonalNotes({ fileFor, readJson, writeJson, readJsonBody, json }) {
  const pending = new Map();
  function writeFor(file, operation) {
    const write = (pending.get(file) || Promise.resolve()).then(operation);
    const settled = write.catch(() => {});
    pending.set(file, settled);
    void settled.then(() => { if (pending.get(file) === settled) pending.delete(file); });
    return write;
  }

  return {
    async handle(req, res, username) {
      const file = fileFor(username);
      if (req.method === "GET") return json(res, 200, { notes: await readJson(file, []) });
      if (!["POST", "DELETE"].includes(req.method)) return json(res, 405, { error: "Method not allowed" });
      const body = await readJsonBody(req);
      return writeFor(file, async () => {
        const notes = await readJson(file, []);
        const index = notes.findIndex((note) => note.id === body.id);
        if (body.id && index < 0) return json(res, 404, { error: "Note not found" });
        if (index >= 0 && notes[index].revision !== body.revision) {
          return json(res, 409, { error: "This note changed on another device. Copy your edits, then reload Notes." });
        }
        if (req.method === "DELETE") {
          if (index < 0) return json(res, 404, { error: "Note not found" });
          notes.splice(index, 1);
          await writeJson(file, notes);
          return json(res, 200, { notes });
        }
        const title = typeof body.title === "string" ? body.title.trim() : "";
        const content = typeof body.content === "string" ? body.content : "";
        if (!title || title.length > 120 || content.length > 40000) {
          return json(res, 400, { error: "Use a title and keep the note under 40,000 characters." });
        }
        if (index < 0 && notes.length >= 60) {
          return json(res, 400, { error: "Delete a note before adding another. The limit is 60 notes." });
        }
        const note = {
          id: notes[index]?.id || randomUUID(), revision: randomUUID(), title, content,
          updatedAt: new Date().toISOString(),
        };
        if (index >= 0) notes.splice(index, 1);
        notes.unshift(note);
        await writeJson(file, notes);
        return json(res, 200, { note, notes });
      });
    },
    removeAccount(username) {
      const file = fileFor(username);
      return writeFor(file, () => writeJson(file, []));
    },
  };
}

module.exports = { normalizeSchoolLink, createPersonalNotes };
