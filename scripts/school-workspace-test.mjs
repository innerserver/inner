import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile, writeFile, mkdir, mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import net from "node:net";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "server.js"));
const { requiresMalwareScan, inspectUpload, scanFile } = require("./lib/upload-scanner");
const { buildFormQuestions, formQuestionVisible } = require("./lib/forms");
const createUploadAlerts = require("./lib/upload-alerts");
const directory = await mkdtemp(path.join(tmpdir(), "connectifi-school-"));
const source = await readFile(path.join(root, "server.js"), "utf8");
const context = vm.createContext({ require, __dirname: root, Buffer, URL, AbortSignal, AbortController, setTimeout, clearTimeout, setInterval, clearInterval, console, fetch, process: { env: { INNER_LOCALHOST_MODE: "true", INNER_DATA_DIR: directory }, pid: process.pid } });
vm.runInContext(source.slice(0, source.lastIndexOf("main().catch(")) + ";globalThis.app={route,createInnerServer,sessions,FILES,websocketServer};", context);
const { app } = context;
let server, origin;
const users = [{ username: "admin", role: "admin", email: "admin@example.test" }, { username: "teacher", role: "moderator" }, { username: "alice", role: "member", grade: "9A" }, { username: "bob", role: "member", grade: "9B" }];
const tokens = {};
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP00AAAAASUVORK5CYII=", "base64");
before(async () => {
  await mkdir(path.join(directory, "uploads"), { recursive: true });
  const fixtures = { users, rooms: [{ id: "room-a", name: "Room A", private: true, allowedUsers: ["alice", "teacher"] }, { id: "room-b", name: "Room B", private: true, allowedUsers: ["bob"] }], settings: { serverEnabled: true }, questionnaires: [], uploads: [], announcements: [{ id: "notice-a", title: "Room A notice", message: "Please confirm", scope: "room", roomId: "room-a", active: true, requireAcknowledgement: true }] };
  for (const [key, value] of Object.entries(fixtures)) await writeFile(app.FILES[key], JSON.stringify(value));
  for (const user of users) {
    tokens[user.username] = `${user.username}-token`;
    app.sessions.set(tokens[user.username], { ...user, csrfToken: "test-csrf", expiresAt: Date.now() + 3600000 });
  }
  server = app.createInnerServer((req, res) => app.route(req, res).catch((error) => {
    if (res.destroyed || res.headersSent) return;
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json", "Connection": "close" }); res.end(JSON.stringify({ error: error.message }));
  }));
  server.listen(0, "127.0.0.1"); await once(server, "listening"); origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); app.websocketServer.close(); await rm(directory, { recursive: true, force: true }); });
async function call(user, url, body, method = body === undefined ? "GET" : "POST", extra = {}) {
  const response = await fetch(origin + url, { method, headers: { Origin: origin, Cookie: `server_app_session=${tokens[user]}`, "X-CSRF-Token": "test-csrf", ...(Buffer.isBuffer(body) ? {} : { "Content-Type": "application/json" }), ...extra }, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) });
  const data = await response.json().catch(() => ({})); return { status: response.status, data };
}
const upload = (user, name, bytes, schoolContext = "") => call(user, "/api/upload", bytes, "POST", { "x-file-name": name, "x-file-type": "image/jpeg", "x-school-context": schoolContext });
test("validated camera photos publish without a malware service; fake photos are rejected", async () => {
  assert.equal(requiresMalwareScan(".JPG"), false);
  assert.equal((await inspectUpload("nonexistent-photo.jpg", ".jpg")).status, "not-required-photo");
  const result = await upload("alice", "camera.png", png);
  assert.equal(result.status, 201); assert.equal(result.data.file.scanStatus, "not-required-photo");
  assert.equal((await upload("alice", "fake.jpg", Buffer.from("%PDF-1.7\n"))).status, 400);
  assert.equal((await upload("alice", "fake.heic", Buffer.from("not really a photo"))).status, 400);
});
test("PDFs cannot use a forged image MIME to bypass the scanner", async () => {
  assert.equal(requiresMalwareScan(".pdf"), true);
  const result = await upload("alice", "homework.pdf", Buffer.from("%PDF-1.7\n document"));
  assert.equal(result.status, 503); assert.match(result.data.error, /scanner|scanning/i);
  assert.equal((await readdir(path.join(directory, "quarantine"))).length, 0);
  const records = JSON.parse(await readFile(app.FILES.uploads)); assert.equal(records.some((file) => file.originalName === "homework.pdf"), false);
});
test("simultaneous photo uploads preserve both file records", async () => {
  const results = await Promise.all([upload("alice", "parallel-a.png", png), upload("alice", "parallel-b.png", png)]);
  assert.deepEqual(results.map((result) => result.status), [201, 201]);
  const files = JSON.parse(await readFile(app.FILES.uploads));
  for (const result of results) assert.equal(files.some((file) => file.id === result.data.file.id), true);
});
test("the separate scanner protocol accepts only a complete clean result and blocks detections", async () => {
  const file = path.join(directory, "scanner-fixture.pdf"); await writeFile(file, "%PDF-1.7\n test");
  let verdict = "stream: OK\0", observed = Buffer.alloc(0);
  const scanner = net.createServer((socket) => {
    let input = Buffer.alloc(0), command = false;
    socket.on("data", (chunk) => {
      input = Buffer.concat([input, chunk]);
      if (!command) { if (input.length < 10) return; assert.equal(input.subarray(0, 10).toString(), "zINSTREAM\0"); input = input.subarray(10); command = true; }
      while (input.length >= 4) {
        const length = input.readUInt32BE(0);
        if (input.length < 4 + length) return;
        if (!length) { socket.end(verdict); return; }
        observed = Buffer.concat([observed, input.subarray(4, 4 + length)]); input = input.subarray(4 + length);
      }
    });
  });
  scanner.listen(0, "127.0.0.1"); await once(scanner, "listening");
  try {
    const options = { host: "127.0.0.1", port: scanner.address().port, timeoutMs: 1000 };
    assert.equal((await scanFile(file, options)).status, "clean"); assert.equal(observed.toString(), "%PDF-1.7\n test");
    verdict = "stream: Test-Signature FOUND\0"; await assert.rejects(scanFile(file, options), { statusCode: 400, code: "UPLOAD_MALWARE_DETECTED", detection: "Test-Signature" });
    verdict = "stream: Heuristics.Limits.Exceeded.MaxFileSize FOUND\0"; await assert.rejects(scanFile(file, options), { code: "UPLOAD_SCAN_POLICY_BLOCK" });
    verdict = "stream: scanner error ERROR\0"; await assert.rejects(scanFile(file, options), { statusCode: 503 });
  } finally { await new Promise((resolve) => scanner.close(resolve)); }
});
test("a blocked PDF emails admins with its uploader and intended form teacher, without publishing the file", async () => {
  const scanner = net.createServer((socket) => { socket.on("error", () => {}); socket.once("data", () => socket.end("stream: Integration-Test-Malware FOUND\0")); });
  scanner.listen(0, "127.0.0.1"); await once(scanner, "listening");
  const previousHost = process.env.INNER_CLAMD_HOST, previousPort = process.env.INNER_CLAMD_PORT;
  const originalEmail = vm.runInContext("sendDirectEmail", context), messages = [];
  context.testEmail = async (...args) => { messages.push(args); return { ok: true }; };
  vm.runInContext("sendDirectEmail = (...args) => testEmail(...args)", context);
  process.env.INNER_CLAMD_HOST = "127.0.0.1"; process.env.INNER_CLAMD_PORT = String(scanner.address().port);
  try {
    const created = await call("teacher", "/api/questionnaires", { title: "Attachment destination", scope: "room", target: "room-a", questions: [{ label: "Notes", type: "paragraph", required: false }] });
    assert.equal(created.status, 200);
    const { data } = await call("alice", "/api/questionnaires");
    const form = data.questionnaires.find((entry) => entry.title === "Attachment destination");
    const blocked = await upload("alice", "blocked-handout.pdf", Buffer.from("%PDF-1.7\n integration fixture"), `form:${form.id}`);
    assert.equal(blocked.status, 400); assert.equal(blocked.data.adminEmailStatus, "sent");
    assert.equal(messages.length, 1); assert.deepEqual(messages[0][0], ["admin@example.test"]);
    assert.match(messages[0][2], /Uploader: alice/); assert.match(messages[0][2], /Attachment destination/);
    assert.match(messages[0][2], /teacher\/moderator teacher/); assert.match(messages[0][2], /Integration-Test-Malware/);
    assert.equal(messages[0][3].attachments, undefined);
    assert.equal((await readdir(path.join(directory, "quarantine"))).length, 0);
    const files = JSON.parse(await readFile(app.FILES.uploads)); assert.equal(files.some((file) => file.originalName === "blocked-handout.pdf"), false);
    assert.equal((await call("alice", "/api/uploads/security-incidents")).status, 403);
    const incidents = await call("admin", "/api/uploads/security-incidents");
    assert.equal(incidents.data.incidents[0].uploader, "alice"); assert.equal(incidents.data.incidents[0].emailStatus, "sent");
    const bytes = Buffer.from("%PDF-1.7\n resumable malware fixture");
    const staged = await call("alice", "/api/uploads/resumable", { name: "blocked-resumable.pdf", type: "application/pdf", size: bytes.length, schoolContext: `form:${form.id}` });
    const uploadId = staged.data.uploadId;
    assert.equal((await call("alice", `/api/uploads/resumable/${uploadId}`, bytes, "PATCH", { "Upload-Offset": "0" })).status, 200);
    assert.equal((await call("alice", `/api/uploads/resumable/${uploadId}/complete`, {})).status, 400);
    assert.equal((await call("alice", `/api/uploads/resumable/${uploadId}`)).status, 404);
    assert.equal((await readdir(path.join(directory, "upload-staging"))).some((name) => name.startsWith(uploadId)), false);
    assert.equal(messages.length, 2);
  } finally {
    if (previousHost === undefined) delete process.env.INNER_CLAMD_HOST; else process.env.INNER_CLAMD_HOST = previousHost;
    if (previousPort === undefined) delete process.env.INNER_CLAMD_PORT; else process.env.INNER_CLAMD_PORT = previousPort;
    context.originalEmail = originalEmail; vm.runInContext("sendDirectEmail = originalEmail", context);
    delete context.originalEmail; delete context.testEmail;
    await new Promise((resolve) => scanner.close(resolve));
  }
});
test("malware mail failures stay queued and retries retain the original room destination", async () => {
  const data = { incidents: [], users: [{ username: "admin2", role: "admin", email: "owner@example.test" }], settings: {}, rooms: [{ id: "room-a", name: "Class 9A" }], forms: [] };
  let succeeds = false, messages = [];
  const alerts = createUploadAlerts({ FILES: { uploadIncidents: "incidents", users: "users", settings: "settings", rooms: "rooms", questionnaires: "forms" }, readJson: async (key) => structuredClone(data[key]), writeJson: async (key, value) => { data[key] = structuredClone(value); }, sendDirectEmail: async (...args) => { messages.push(args); return { ok: succeeds }; } });
  const result = await alerts.notify({ user: { username: "teacher" }, fileName: "lesson.pdf", size: 123, detection: "Test-Malware", context: "task:room-a", privateUpload: false });
  assert.equal(result.emailStatus, "pending"); assert.equal(data.incidents[0].attempts, 1);
  assert.match(messages[0][2], /Task reference files for room: Class 9A/);
  succeeds = true; data.incidents[0].nextAttemptAt = 0;
  await alerts.retry(); assert.equal(data.incidents[0].emailStatus, "sent"); assert.equal(messages.length, 2);
  await alerts.retry(); assert.equal(messages.length, 2);
});
test("only staff can post room tasks and only room members can see them", async () => {
  const task = { roomId: "room-a", title: "Read chapter 2", instructions: "Read the notes", fileIds: [] };
  assert.equal((await call("alice", "/api/school/tasks", task)).status, 403);
  assert.equal((await call("teacher", "/api/school/tasks", task)).status, 200);
  assert.equal((await call("alice", "/api/school")).data.tasks.length, 1);
  assert.equal((await call("bob", "/api/school")).data.tasks.length, 0);
});
test("admins set teacher appointments, and simultaneous bookings cannot exceed capacity", async () => {
  const event = { kind: "appointment", teacher: "teacher", title: "Project discussion", startsAt: new Date(Date.now() + 3600000).toISOString(), endsAt: new Date(Date.now() + 7200000).toISOString(), capacity: 1, roomId: "" };
  assert.equal((await call("teacher", "/api/school/events", event)).status, 403);
  assert.equal((await call("admin", "/api/school/events", event)).status, 200);
  assert.equal((await call("admin", "/api/school/events", event)).status, 409);
  const id = (await call("alice", "/api/school")).data.events[0].id;
  const booked = await Promise.all([call("alice", `/api/school/events/${id}/book`, {}), call("bob", `/api/school/events/${id}/book`, {})]);
  assert.deepEqual(booked.map((result) => result.status).sort(), [200, 409]);
  assert.equal((await call("alice", "/api/school")).data.events[0].bookings, undefined);
  assert.equal((await call("teacher", "/api/school")).data.events[0].bookings.length, 1);
});
test("acknowledgements are room-scoped, timestamped and idempotent", async () => {
  assert.equal((await call("bob", "/api/school/announcements/notice-a/acknowledge", {})).status, 404);
  for (let i = 0; i < 2; i++) assert.equal((await call("alice", "/api/school/announcements/notice-a/acknowledge", {})).status, 200);
  const notice = (await call("admin", "/api/school")).data.notices[0];
  assert.equal(notice.receipts.length, 1); assert.ok(notice.receipts[0].acknowledgedAt);
  assert.equal((await call("alice", "/api/school")).data.notices[0].receipts, undefined);
});
test("specific-person announcements and acknowledgements stay private across state and live payloads", async () => {
  assert.equal((await call("alice", "/api/announcements/recipients")).status, 403);
  const directory = await call("admin", "/api/announcements/recipients?q=alice");
  assert.equal(directory.data.people.length, 1); assert.equal(Object.hasOwn(directory.data.people[0], "email"), false);
  const draft = { title: "Alice only", message: "Private announcement fixture", scope: "people", recipientUsernames: ["alice"], requireAcknowledgement: true };
  assert.equal((await call("teacher", "/api/announcements", draft)).status, 403);
  assert.equal((await call("admin", "/api/announcements", { ...draft, recipientUsernames: [] })).status, 400);
  assert.equal((await call("admin", "/api/announcements", { ...draft, recipientUsernames: ["missing-account"] })).status, 400);
  assert.equal((await call("admin", "/api/announcements", { ...draft, scope: "unknown" })).status, 400);
  const created = await call("admin", "/api/announcements", draft);
  assert.equal(created.status, 201);
  const id = created.data.announcement.id;
  const stored = JSON.parse(await readFile(app.FILES.announcements, "utf8"));
  context.noticeFixtures = stored;
  const forUser = (username) => vm.runInContext(`safeAnnouncements(noticeFixtures, { username: ${JSON.stringify(username)}, role: ${JSON.stringify(username === "admin" ? "admin" : "member")} }, [])`, context);
  assert.equal(forUser("bob").some((notice) => notice.id === id), false);
  assert.equal(forUser("alice").some((notice) => notice.id === id), true);
  assert.equal(Object.hasOwn(forUser("alice").find((notice) => notice.id === id), "recipientUsernames"), false);
  assert.equal(forUser("admin").some((notice) => notice.id === id), true);
  const aliceState = await call("alice", "/api/state?fast=1"), bobState = await call("bob", "/api/state?fast=1");
  assert.equal(aliceState.status, 200); assert.equal(bobState.status, 200);
  assert.equal(aliceState.data.announcements.some((notice) => notice.id === id), true);
  assert.equal(bobState.data.announcements.some((notice) => notice.id === id), false);
  assert.equal((await call("bob", "/api/school")).data.notices.some((notice) => notice.id === id), false);
  assert.equal((await call("bob", `/api/school/announcements/${id}/acknowledge`, {})).status, 404);
  assert.equal((await call("alice", `/api/school/announcements/${id}/acknowledge`, {})).status, 200);
  assert.equal((await call("admin", `/api/school/announcements/${id}/acknowledge`, {})).status, 404);
  const adminNotice = (await call("admin", "/api/school")).data.notices.find((notice) => notice.id === id);
  assert.deepEqual(adminNotice.pending, []); assert.equal(adminNotice.receipts.length, 1);
  assert.equal((await call("admin", "/api/announcements", { title: "Everyone", message: "School notice", scope: "all" })).status, 201);
  assert.equal((await call("admin", "/api/announcements", { title: "Room notice", message: "Room notice", scope: "room", roomId: "room-a" })).status, 201);
});
test("only the sender can cancel an outgoing friend request", async () => {
  const requested = await call("alice", "/api/friends/request", { to: "bob", search: "bob" });
  assert.equal(requested.status, 201);
  const id = requested.data.friends.outgoing[0].id;
  assert.equal((await call("teacher", "/api/friends/cancel", { id })).status, 404);
  assert.equal((await call("bob", "/api/friends/cancel", { id })).status, 404);
  const cancelled = await call("alice", "/api/friends/cancel", { id });
  assert.equal(cancelled.status, 200); assert.equal(cancelled.data.friends.outgoing.length, 0);
});
test("grade discovery and friend requests include all A, B and C sections of that year", async () => {
  const fullUsers = JSON.parse(await readFile(app.FILES.users, "utf8"));
  fullUsers.push({ username: "charlie", role: "member", grade: "9C" }, { username: "outside", role: "member", grade: "10A" });
  await writeFile(app.FILES.users, JSON.stringify(fullUsers));
  const found = await call("alice", "/api/friends/candidates");
  assert.equal(found.data.people.some((person) => person.username === "bob"), true);
  assert.equal(found.data.people.some((person) => person.username === "charlie"), true);
  assert.equal(found.data.people.some((person) => person.username === "outside"), false);
  const grade = await call("alice", "/api/friends/candidates?q=grade:9");
  assert.equal(grade.data.people.some((person) => person.username === "charlie"), true);
  const section = await call("alice", "/api/friends/candidates?q=grade:9B");
  assert.equal(section.data.people.some((person) => person.username === "bob"), true);
  assert.equal(section.data.people.some((person) => person.username === "charlie"), false);
  assert.equal((await call("alice", "/api/friends/request", { to: "outside" })).status, 403);
  const sameYear = await call("alice", "/api/friends/request", { to: "charlie" });
  assert.equal(sameYear.status, 201);
  assert.equal((await call("alice", "/api/friends/cancel", { id: sameYear.data.friends.outgoing.find((request) => request.to === "charlie").id })).status, 200);
  assert.equal((await call("alice", "/api/friends/request", { to: "outside", search: "outside" })).status, 201);
});
test("account custom colours and photo backgrounds survive saving and state refresh", async () => {
  const photo = `data:image/png;base64,${png.toString("base64")}`;
  const customTheme = { bg: "#e7f1ed", surface: "#f7fbf8", ink: "#183c30", accent: "#17694d" };
  const saved = await call("alice", "/api/profile", { displayName: "Alice", grade: "9A", theme: "custom", visualStyle: "custom", themeImageUrl: photo, customTheme });
  assert.equal(saved.status, 200); assert.equal(saved.data.profile.themeImageUrl, photo);
  assert.equal(saved.data.profile.customTheme.accent, customTheme.accent);
  const refreshed = await call("alice", "/api/state?fast=1");
  assert.equal(refreshed.status, 200); assert.equal(refreshed.data.profiles.alice.theme, "custom");
  assert.equal(refreshed.data.profiles.alice.themeImageUrl, photo);
  const glass = await call("alice", "/api/profile", { displayName: "Alice", grade: "9A", theme: "glass", visualStyle: "forest", themeImageUrl: photo, customTheme });
  assert.equal(glass.status, 200);assert.equal(glass.data.profile.theme, "glass");assert.equal(glass.data.profile.themeImageUrl, photo);
  const persisted = (await call("alice", "/api/state?fast=1")).data.profiles.alice;
  assert.equal(persisted.theme, "glass");assert.equal(persisted.themeImageUrl, photo);
});
test("language preferences are validated and isolated per account", async () => {
  assert.equal((await call("alice", "/api/school/language", { language: "es" })).status, 200);
  assert.equal((await call("alice", "/api/school")).data.language, "es");
  assert.equal((await call("bob", "/api/school")).data.language, "en");
  assert.equal((await call("alice", "/api/school/language", { language: "xx" })).status, 400);
});
test("conditional form fields and file limits are validated on the server", async () => {
  const questions = buildFormQuestions([{ type: "choice", label: "Attach photo?", options: ["Yes", "No"] }, { type: "file", label: "Photo", showWhen: { questionIndex: 0, equals: "Yes" }, required: true }]);
  assert.equal(formQuestionVisible(questions[1], { [questions[0].id]: "No" }), false);
  assert.equal(formQuestionVisible(questions[1], { [questions[0].id]: "Yes" }), true);
  assert.throws(() => buildFormQuestions([{ type: "file", label: "Unsafe", accept: [".exe"] }]), { statusCode: 400 });
  const form = { title: "Photo form", scope: "room", target: "room-a", allowEdit: true, questions: [{ type: "file", label: "Your photo", required: true }] };
  assert.equal((await call("teacher", "/api/questionnaires", form)).status, 200);
  const definition = (await call("alice", "/api/questionnaires")).data.questionnaires[0], questionId = definition.questions[0].id;
  const attached = await upload("alice", "answer.png", png, `form:${definition.id}`);
  assert.equal(attached.status, 201);
  const fileId = attached.data.file.id, answers = { [questionId]: [fileId] };
  assert.equal((await call("alice", `/api/questionnaires/${definition.id}/drafts`, { answers })).status, 200);
  assert.deepEqual((await call("alice", "/api/questionnaires")).data.questionnaires[0].ownDraft, answers);
  assert.equal((await call("bob", `/api/questionnaires/${definition.id}/responses`, { answers })).status, 403);
  assert.equal((await call("alice", `/api/questionnaires/${definition.id}/responses`, { answers })).status, 200);
  assert.equal((await call("alice", `/api/questionnaires/${definition.id}/responses`, { answers })).status, 200);
  const finished = (await call("teacher", "/api/questionnaires")).data.questionnaires[0]; assert.equal(finished.responses.length, 1);
  const download = await fetch(`${origin}/api/files/${fileId}/download`, { headers: { Cookie: `server_app_session=${tokens.teacher}` } }); assert.equal(download.status, 200); await download.arrayBuffer();
  const denied = await fetch(`${origin}/api/files/${fileId}/download`, { headers: { Cookie: `server_app_session=${tokens.bob}` } }); assert.equal(denied.status, 403); await denied.text();
});
test("resumable uploads enforce ownership and offsets, then complete idempotently", async () => {
  const created = await call("alice", "/api/uploads/resumable", { name: "resumed.png", size: png.length, type: "image/png" }); assert.equal(created.status, 201);
  const route = `/api/uploads/resumable/${created.data.uploadId}`;
  assert.equal((await call("bob", route)).status, 404);
  const first = await call("alice", route, png.subarray(0, 20), "PATCH", { "Upload-Offset": "0" }); assert.equal(first.status, 200);
  assert.equal((await call("alice", route, png.subarray(20), "PATCH", { "Upload-Offset": "0" })).status, 409);
  assert.equal((await call("alice", route)).data.offset, 20);
  assert.equal((await call("alice", route, png.subarray(20), "PATCH", { "Upload-Offset": "20" })).status, 200);
  const completed = await call("alice", route + "/complete", {}); assert.equal(completed.status, 201); assert.equal(completed.data.file.scanStatus, "not-required-photo");
  assert.equal((await call("alice", route + "/complete", {})).data.file.id, completed.data.file.id);
});
test("one shared Pin action is available to conversation members, including Unpin", async () => {
  await writeFile(app.FILES.messages, JSON.stringify([{ id: "shared-pin-message", roomId: "room-a", user: "teacher", text: "Class reference", createdAt: new Date().toISOString() }]));
  assert.equal((await call("alice", "/api/messages/shared-pin-message/pin", { pinned: true })).data.message.pinned, true);
  assert.equal((await call("bob", "/api/messages/shared-pin-message/pin", { pinned: false })).status, 403);
  assert.equal((await call("alice", "/api/messages/shared-pin-message/pin", { pinned: false })).data.message.pinned, false);
  await writeFile(app.FILES.dms, JSON.stringify([{ id: "shared-pin-dm", participants: ["alice", "bob"], from: "alice", to: "bob", text: "Shared note", createdAt: new Date().toISOString() }]));
  assert.equal((await call("alice", "/api/dms/shared-pin-dm/pin", { pinned: true })).data.dm.pinned, true);
  assert.equal((await call("teacher", "/api/dms/shared-pin-dm/pin", { pinned: false })).status, 403);
  assert.equal((await call("bob", "/api/dms/shared-pin-dm/pin", { pinned: false })).data.dm.pinned, false);
});
test("startup provisions Grades 6–12 for all sections, without exposing old section history", async () => {
  const storedUsers = JSON.parse(await readFile(app.FILES.users, "utf8"));
  for (const user of storedUsers) {
    if (user.username === "alice") user.grade = "8A";
    if (user.username === "bob") user.grade = "8B";
    if (user.username === "charlie") user.grade = "8C";
    if (user.username === "outside") user.grade = "9A";
  }
  for (let year = 6; year <= 12; year++) for (const section of ["A", "B", "C"]) storedUsers.push({ username: `sample${year}${section.toLowerCase()}`, role: "member", grade: `${year}${section}` });
  await writeFile(app.FILES.users, JSON.stringify(storedUsers));
  const oldRooms = JSON.parse(await readFile(app.FILES.rooms, "utf8"));
  oldRooms.push({ id: "legacy-8a", name: "Class 8A", classGrade: "8A", private: true, allowedUsers: ["alice"], createdBy: "system" });
  await writeFile(app.FILES.rooms, JSON.stringify(oldRooms));
  await writeFile(app.FILES.messages, JSON.stringify([{ id: "old-private-message", roomId: "legacy-8a", user: "alice", text: "Private section history", createdAt: new Date().toISOString() }]));
  await vm.runInContext("ensureRooms()", context);
  await vm.runInContext("ensureRooms()", context);
  const rooms = JSON.parse(await readFile(app.FILES.rooms, "utf8"));
  for (let year = 6; year <= 12; year++) {
    const matching = rooms.filter((room) => room.name === `Grade ${year}`);
    assert.equal(matching.length, 1);
    for (const section of ["a", "b", "c"]) assert.equal(matching[0].allowedUsers.includes(`sample${year}${section}`), true);
  }
  for (const name of ["alice", "bob", "charlie", "outside"]) {
    const user = storedUsers.find((entry) => entry.username === name);
    tokens[name] = `${name}-grade-token`; app.sessions.set(tokens[name], { ...user, csrfToken: "test-csrf", expiresAt: Date.now() + 3600000 });
  }
  const grade8 = rooms.find((room) => room.name === "Grade 8");
  assert.equal((await call("bob", "/api/state?fast=1")).data.rooms.some((room) => room.id === grade8.id), true);
  assert.equal((await call("bob", "/api/state?fast=1")).data.messages.some((message) => message.id === "old-private-message"), false);
  assert.equal((await call("alice", "/api/state?fast=1")).data.messages.some((message) => message.id === "old-private-message"), true);
  const notice = await call("admin", "/api/announcements", { title: "All Grade 8", message: "All sections", scope: "room", roomId: grade8.id, requireAcknowledgement: true });
  assert.equal(notice.status, 201);
  for (const name of ["alice", "bob", "charlie"]) assert.equal((await call(name, "/api/school")).data.notices.some((entry) => entry.id === notice.data.announcement.id), true);
  assert.equal((await call("outside", "/api/school")).data.notices.some((entry) => entry.id === notice.data.announcement.id), false);
  const profile = await call("alice", "/api/profile", { grade: "8A", displayName: "Alice" });
  assert.equal(profile.status, 200);
  const moved = await vm.runInContext("syncClassRoom({username:'alice',role:'member',grade:'8A'})", context);
  assert.equal(moved.roomId, grade8.id);
});

test("form senders and respondents get server-recorded account/class snapshots", async () => {
  const users = JSON.parse(await readFile(app.FILES.users, "utf8"));
  users.find(user => user.username === "teacher").grade = "8C";
  await writeFile(app.FILES.users, JSON.stringify(users));
  const created = await call("teacher", "/api/questionnaires", { title: "Class identity", scope: "grade", target: "8", createdBy: "fake", createdByGrade: "12A", questions: [{ label: "Answer", type: "text", required: true }] });
  assert.equal(created.status, 200);
  let form = (await call("teacher", "/api/questionnaires")).data.questionnaires.find(form => form.title === "Class identity");
  assert.equal(form.createdBy, "teacher"); assert.equal(form.createdByGrade, "8C");
  const response = await call("bob", `/api/questionnaires/${form.id}/responses`, { username: "fake", grade: "12A", answers: { [form.questions[0].id]: "Hello" } });
  assert.equal(response.status, 200);
  users.find(user => user.username === "teacher").grade = "9A"; await writeFile(app.FILES.users, JSON.stringify(users));
  form = (await call("teacher", "/api/questionnaires")).data.questionnaires.find(entry => entry.id === form.id);
  assert.equal(form.createdByGrade, "8C");
  assert.equal(form.responses[0].username, "bob"); assert.equal(form.responses[0].grade, "8B");
});

test("disabled direct upload routes still return their original 410 response", async () => {
  for (const route of ["sign", "complete"]) {
    const result = await call("alice", `/api/uploads/direct-cloudinary/${route}`, {});
    assert.equal(result.status, 410); assert.equal(result.data.error, "Use the app upload endpoint for file type and size validation.");
  }
});

test("sticker library defaults private, supports owner-only publishing and keeps backing files private", async () => {
  const uploaded = await call("alice", "/api/upload", png, "POST", { "x-file-name": "my-sticker.png", "x-file-type": "image/png", "x-file-private": "true" });
  assert.equal(uploaded.status, 201); assert.equal(uploaded.data.file.private, true);
  const created = await call("alice", "/api/stickers", { fileId: uploaded.data.file.id });
  assert.equal(created.status, 201);
  const sticker = created.data.stickers.find(entry => entry.fileId === uploaded.data.file.id);
  assert.equal(sticker.visibility, "private");
  assert.equal((await call("bob", "/api/stickers")).data.stickers.some(entry => entry.id === sticker.id), false);
  const image = async (name) => fetch(origin + sticker.attachment.url, { headers: { Cookie: `server_app_session=${tokens[name]}` } });
  assert.equal((await image("bob")).status, 404);
  assert.equal((await call("bob", `/api/stickers/${sticker.id}`, { visibility: "public" }, "PATCH")).status, 404);
  assert.equal((await call("alice", `/api/stickers/${sticker.id}`, { visibility: "public" }, "PATCH")).status, 200);
  assert.equal((await call("bob", "/api/stickers")).data.stickers.some(entry => entry.id === sticker.id), true);
  assert.equal((await image("bob")).status, 200);
  assert.equal(JSON.parse(await readFile(app.FILES.uploads)).find(file => file.id === uploaded.data.file.id).private, true);
  assert.equal((await call("bob", `/api/stickers/${sticker.id}`, undefined, "DELETE")).status, 404);
  await call("alice", `/api/stickers/${sticker.id}`, { visibility: "private" }, "PATCH");
  assert.equal((await image("bob")).status, 404);
});

test("private sticker sends stay visible only to chat recipients after removal, without adding to their library", async () => {
  const uploaded = await call("alice", "/api/upload", png, "POST", { "x-file-name": "private-dm-sticker.png", "x-file-type": "image/png", "x-file-private": "true" });
  const created = await call("alice", "/api/stickers", { fileId: uploaded.data.file.id });
  const sticker = created.data.stickers.find(entry => entry.fileId === uploaded.data.file.id);
  await writeFile(app.FILES.friends, JSON.stringify({ requests: [], friendships: [{ users: ["alice", "bob"] }] }));
  const denied = await call("bob", "/api/dms", { to: "alice", attachment: sticker.attachment });assert.equal(denied.status, 403);
  const sent = await call("alice", "/api/dms", { to: "bob", attachment: sticker.attachment });assert.equal(sent.status, 201);
  const image = (name) => fetch(origin + sent.data.dm.attachment.url, { headers: { Cookie: `server_app_session=${tokens[name]}` } });
  assert.equal((await image("bob")).status, 200);assert.equal((await image("teacher")).status, 404);
  assert.equal((await call("bob", "/api/stickers")).data.stickers.some(entry => entry.id === sticker.id), false);
  assert.equal((await call("alice", `/api/stickers/${sticker.id}`, undefined, "DELETE")).status, 200);
  assert.equal((await image("bob")).status, 200);assert.equal((await image("teacher")).status, 404);
});

test("simultaneous sticker imports preserve both library entries", async () => {
  const uploads = await Promise.all(["one.png", "two.png"].map(name => call("alice", "/api/upload", png, "POST", { "x-file-name": name, "x-file-type": "image/png", "x-file-private": "true" })));
  const results = await Promise.all(uploads.map(result => call("alice", "/api/stickers", { fileId: result.data.file.id, visibility: "public" })));
  assert.equal(results.every(result => result.status === 201), true);
  const ids = new Set((await call("bob", "/api/stickers")).data.stickers.map(sticker => sticker.fileId));
  assert.equal(uploads.every(result => ids.has(result.data.file.id)), true);
});

test("legacy private stickers protect old file URLs while preserving sent attachment access", async () => {
  const uploaded = await upload("alice", "legacy-sticker.png", png);
  assert.equal(uploaded.data.file.private, false);
  const file = uploaded.data.file;
  await writeFile(app.FILES.stickers, JSON.stringify([{ id: 'legacy-private', owner: 'alice', fileId: file.id, visibility: 'private' }]));
  await writeFile(app.FILES.dms, JSON.stringify([{ id: 'legacy-message', participants: ['alice','bob'], attachment: { ...file, sticker: true } }]));
  await vm.runInContext('protectStickerFiles([{id:"legacy-private",owner:"alice",fileId:' + JSON.stringify(file.id) + '}])', context);
  const fetchImage = name => fetch(origin + file.url, { headers: { Cookie: `server_app_session=${tokens[name]}` } });
  assert.equal((await fetchImage("bob")).status, 200);assert.equal((await fetchImage("teacher")).status, 403);
  assert.equal((await call("bob", "/api/stickers")).data.stickers.some(sticker => sticker.id === 'legacy-private'), false);
});
