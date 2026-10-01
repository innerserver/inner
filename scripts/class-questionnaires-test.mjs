import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import vm from "node:vm";

const source = await readFile(new URL("../server.js", import.meta.url), "utf8");
const block = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const data = {
  users: [{ username: "teacher", role: "moderator", grade: "staff" }, { username: "alice", role: "member", grade: "9A" }, { username: "bob", role: "member", grade: "9B" }, { username: "carol", role: "member", grade: "10A" }],
  rooms: [{ id: "main", name: "Main" }, { id: "old", name: "Class 8A", private: true, allowedUsers: ["alice"] }],
  questionnaires: [],
};
const alice = data.users[1];
const session = { username: "alice", grade: "8A" };
const peer = { username: "alice", grade: "8A" };
const context = vm.createContext({
  crypto: { randomUUID }, FILES: { users: "users", rooms: "rooms", questionnaires: "questionnaires" },
  sessions: new Map([["session", session]]), wsClients: new Map([["peer", peer]]), builtInManagerUsernames: new Set(),
  normalizeUsername: (name) => String(name || "").toLowerCase(), normalizeUsernameList: (names) => Array.isArray(names) ? names : [],
  normalizeOptionalUrl: () => "", normalizeRoomTheme: () => "", effectiveRole: (user) => user.role,
  canModerate: (user) => ["moderator", "admin"].includes(user.role), canManage: (user) => user.role === "admin",
  readJson: async (file) => structuredClone(data[file]),
  writeJson: async (file, value) => { await new Promise((resolve) => setTimeout(resolve, 1)); data[file] = structuredClone(value); },
  readJsonBody: async (req) => req.body || {}, json: (_res, status, body) => ({ status, body }),
  broadcastRoomsUpdate: () => {}, sendWs: () => {},
});
vm.runInContext([
  block("function normalizeGrade(", "function normalizeInnerDocType("),
  block("function sanitizeRoom(", "function safeRoom("),
  block("function classRoomGrade(", "function safeRooms("),
  block("function attendanceUserBelongsToRoom(", "function sanitizeAttendanceRecords("),
  block("function canAccessRoom(", "function safeAnnouncements("),
].join("\n"), context);

const moved = await context.syncClassRoom(alice);
assert.equal(session.grade, "9A");
assert.equal(peer.grade, "9A");
assert.equal(context.canAccessRoom(data.rooms.find((room) => room.id === "old"), alice), false);
assert.equal(context.canAccessRoom(data.rooms.find((room) => room.id === moved.roomId), alice), true);
assert.equal(data.rooms.find((room) => room.id === "old").allowedUsers.includes("alice"), false);
assert.equal(context.canAccessRoom(data.rooms.find((room) => room.id === moved.roomId), data.users[2]), false);
await Promise.all([context.syncClassRoom(data.users[2]), context.syncClassRoom(data.users[2])]);
assert.equal(data.rooms.filter((room) => context.classRoomGrade(room) === "9B").length, 1);
assert.equal(context.classRoomGrade({ id: "other", name: "Staff" }), "");
console.log("PASS class transfer, old access revoked, sessions updated, concurrent room creation");

const call = (username, path = "/api/questionnaires", body, method = "POST") => context.handleQuestionnaires({ method, body }, {}, data.users.find((user) => user.username === username), path);
const draft = { title: "Class survey", scope: "grade", target: "9", questions: [{ label: "Choose one", type: "choice", options: ["A", "B"], required: true }, { label: "Choose several", type: "checkbox", options: ["C", "D"], required: true }, { label: "Comments", type: "paragraph", required: false }] };
assert.equal((await call("alice", undefined, draft)).status, 403);
assert.equal((await call("teacher", undefined, { ...draft, questions: [{ label: "Invalid", type: "choice", options: ["A"] }] })).status, 400);
assert.equal((await call("teacher", undefined, draft)).status, 200);
const survey = data.questionnaires[0];
const path = `/api/questionnaires/${survey.id}/responses`;
const answers = { [survey.questions[0].id]: "A", [survey.questions[1].id]: ["C"], [survey.questions[2].id]: "<script>untrusted</script>" };
assert.equal((await call("carol", path, { answers })).status, 403);
assert.equal((await call("alice", path, { answers: {} })).status, 400);
assert.equal((await call("alice", path, { answers: { ...answers, [survey.questions[0].id]: "Invalid" } })).status, 400);
assert.equal((await call("alice", path, { answers: { ...answers, [survey.questions[1].id]: ["Invalid"] } })).status, 400);
const submitted = await Promise.all([call("alice", path, { answers }), call("bob", path, { answers })]);
assert.equal(submitted.every((response) => response.status === 200), true);
assert.equal(data.questionnaires[0].responses.length, 2);
assert.equal((await call("alice", path, { answers })).status, 409);
const memberList = (await call("alice", undefined, undefined, "GET")).body.questionnaires;
assert.equal(memberList[0].responses.length, 0);
assert.equal(memberList[0].ownResponse.username, "alice");
assert.equal(memberList[0].pending, undefined);
const teacherList = (await call("teacher", undefined, undefined, "GET")).body.questionnaires;
assert.equal(teacherList[0].responses.length, 2);
assert.equal(teacherList[0].recipientCount, 2);
assert.equal(teacherList[0].pending.length, 0);
assert.equal((await call("carol", undefined, undefined, "GET")).body.questionnaires.length, 0);
assert.equal((await call("alice", `/api/questionnaires/${survey.id}/close`, {})).status, 403);
assert.equal((await call("teacher", `/api/questionnaires/${survey.id}/close`, {})).status, 200);
assert.equal((await call("alice", path, { answers })).status, 409);
console.log("PASS questionnaire permissions, validation, grade targeting, simultaneous submissions, duplicate prevention, response privacy, closing");

assert.equal((await call("teacher", undefined, { ...draft, scope: "room", target: moved.roomId })).status, 200);
assert.equal((await call("bob", undefined, undefined, "GET")).body.questionnaires.some((form) => form.scope === "room"), false);
assert.equal((await call("alice", undefined, undefined, "GET")).body.questionnaires.some((form) => form.scope === "room"), true);
alice.grade = "10A";
await context.syncClassRoom(alice);
assert.equal((await call("alice", undefined, undefined, "GET")).body.questionnaires.length, 0);
console.log("PASS room audience and questionnaire access after changing class");
