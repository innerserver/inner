import assert from "node:assert/strict";
import { test, before, after, beforeEach } from "node:test";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import vm from "node:vm";
import { createRequire } from "node:module";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "server.js"));
const { isoCBOR } = require("@simplewebauthn/server/helpers");
const directory = await mkdtemp(path.join(tmpdir(), "connectifi-passkeys-"));
const source = await readFile(path.join(root, "server.js"), "utf8");
const context = vm.createContext({ require, __dirname: root, Buffer, URL, AbortSignal, AbortController, setTimeout, clearTimeout, setInterval, clearInterval, console, fetch, process: { env: { INNER_LOCALHOST_MODE: "true", INNER_DATA_DIR: directory }, pid: process.pid } });
vm.runInContext(source.slice(0, source.lastIndexOf("main().catch(")) + ";globalThis.app={route,createInnerServer,sessions,FILES,websocketServer,hashPasswordAsync,hashSessionValue,restoreSessions,SESSION_FILE,securityRateLimits};", context);
const app = context.app;
let server, origin, passwordHash;
const password = "Test-passkey-password-123";
const token = "a".repeat(64);
const secondToken = "b".repeat(64);
async function call(route, body, cookie = `server_app_session=${token}`, extra = {}) {
  const response = await fetch(origin + route, { method: body === undefined ? "GET" : "POST", headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json", "X-CSRF-Token": "test-csrf", ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] || "" };
}
const b64 = (data) => Buffer.from(data).toString("base64url");
const hash = (data) => crypto.createHash("sha256").update(data).digest();
function credential(options, { uv = true, challenge = options.challenge } = {}) {
  const pair = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = pair.publicKey.export({ format: "jwk" }), id = crypto.randomBytes(32);
  const cose = isoCBOR.encode(new Map([[1, 2], [3, -7], [-1, 1], [-2, new Uint8Array(Buffer.from(jwk.x, "base64url"))], [-3, new Uint8Array(Buffer.from(jwk.y, "base64url"))]]));
  const size = Buffer.alloc(2); size.writeUInt16BE(id.length);
  const authData = Buffer.concat([hash("127.0.0.1"), Buffer.from([uv ? 0x45 : 0x41]), Buffer.alloc(4), Buffer.alloc(16), size, id, cose]);
  const attestation = isoCBOR.encode(new Map([["fmt", "none"], ["attStmt", new Map()], ["authData", new Uint8Array(authData)]]));
  const client = { type: "webauthn.create", challenge, origin, crossOrigin: false };
  return { id: b64(id), privateKey: pair.privateKey, userHandle: options.user.id, registration: { id: b64(id), rawId: b64(id), type: "public-key", clientExtensionResults: {}, response: { clientDataJSON: b64(JSON.stringify(client)), attestationObject: b64(attestation), transports: ["internal"] } } };
}
function assertion(key, options, { uv = true, counter = 1, signature = true } = {}) {
  const count = Buffer.alloc(4); count.writeUInt32BE(counter);
  const authData = Buffer.concat([hash("127.0.0.1"), Buffer.from([uv ? 5 : 1]), count]);
  const clientData = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge: options.challenge, origin, crossOrigin: false }));
  return { id: key.id, rawId: key.id, type: "public-key", clientExtensionResults: {}, response: { clientDataJSON: b64(clientData), authenticatorData: b64(authData), signature: b64(signature ? crypto.sign("sha256", Buffer.concat([authData, hash(clientData)]), key.privateKey) : Buffer.alloc(70)), userHandle: key.userHandle } };
}
async function enroll() {
  const options = await call("/api/passkeys/register/options", { password, name: "Test laptop" });
  assert.equal(options.status, 200, JSON.stringify(options.body));
  const key = credential(options.body), cookie = `server_app_session=${token}; ${options.cookie}`;
  const result = await call("/api/passkeys/register/verify", key.registration, cookie);
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return { key, cookie };
}
before(async () => {
  passwordHash = await app.hashPasswordAsync(password);
  server = app.createInnerServer((req, res) => app.route(req, res).catch((error) => { if (!res.headersSent) { res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: error.message })); } }));
  server.listen(0, "127.0.0.1"); await once(server, "listening"); origin = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  app.securityRateLimits.clear(); app.sessions.clear();
  app.sessions.set(app.hashSessionValue(token), { username: "alice", role: "member", parentEmails: ["parent@example.test"], grade: "8A", csrfToken: "test-csrf", expiresAt: Date.now() + 3600000 });
  for (const [name, value] of Object.entries({ users: [{ username: "alice", role: "member", parentEmails: ["parent@example.test"], grade: "8A", passwordHash }], passkeys: [], passkeyPreferences: {}, settings: { serverEnabled: true }, rooms: [{ id: "main", name: "Main" }], accountRequests: [], profiles: {}, logs: [] })) await writeFile(app.FILES[name], JSON.stringify(value));
});
after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); app.websocketServer.close(); await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
test("enrolment requires a signed-in account, CSRF and the current password", async () => {
  assert.equal((await call("/api/passkeys/register/options", { password }, "")).status, 401);
  assert.equal((await call("/api/passkeys/register/options", { password }, undefined, { "X-CSRF-Token": "wrong" })).status, 403);
  assert.equal((await call("/api/passkeys/register/options", { password: "wrong" })).status, 403);
  assert.equal((await call("/api/passkeys/login/options", {}, "", { Origin: "https://evil.example" })).status, 403);
});
test("real attestation registers a key, hides key material in lists and cannot replay", async () => {
  const { key, cookie } = await enroll();
  const listed = await call("/api/passkeys"); assert.equal(listed.body.passkeys[0].name, "Test laptop");
  assert.equal(listed.body.passkeys[0].publicKey, undefined); assert.equal(listed.body.passkeys[0].userHandle, undefined);
  assert.equal((await call("/api/passkeys/register/verify", key.registration, cookie)).status, 400);
});
test("a valid signed assertion creates the normal rotated session and CSRF token", async () => {
  const { key } = await enroll();
  const options = await call("/api/passkeys/login/options", {}, "");
  assert.equal(options.body.allowCredentials?.length || 0, 0);
  const signed = assertion(key, options.body), result = await call("/api/passkeys/login/verify", signed, options.cookie);
  assert.equal(result.status, 200, JSON.stringify(result.body)); assert.equal(result.body.user.username, "alice");
  assert.ok(result.body.csrfToken); assert.match(result.cookie, /^server_app_session=/);
  assert.equal((await call("/api/passkeys/login/verify", signed, options.cookie)).status, 400);
});
test("forged signatures, missing user verification and wrong user handles fail", async () => {
  const { key } = await enroll();
  for (const settings of [{ signature: false }, { uv: false }, { handle: "wrong" }]) {
    const options = await call("/api/passkeys/login/options", {}, ""), signed = assertion(key, options.body, settings);
    if (settings.handle) signed.response.userHandle = settings.handle;
    const result = await call("/api/passkeys/login/verify", signed, options.cookie); assert.ok(result.status >= 400); assert.equal(result.cookie.startsWith("server_app_session="), false);
  }
});
test("registration binds the challenge to the original session", async () => {
  const options = await call("/api/passkeys/register/options", { password }); const key = credential(options.body);
  app.sessions.set(app.hashSessionValue(secondToken), { username: "alice", role: "member", parentEmails: ["parent@example.test"], csrfToken: "test-csrf", expiresAt: Date.now() + 3600000 });
  assert.equal((await call("/api/passkeys/register/verify", key.registration, `server_app_session=${secondToken}; ${options.cookie}`)).status, 400);
});
test("passkey login obeys bans and server shutdown", async () => {
  const { key } = await enroll();
  await writeFile(app.FILES.users, JSON.stringify([{ username: "alice", role: "member", parentEmails: ["parent@example.test"], grade: "8A", passwordHash, bannedUntil: new Date(Date.now() + 3600000).toISOString() }]));
  let options = await call("/api/passkeys/login/options", {}, "");
  assert.equal((await call("/api/passkeys/login/verify", assertion(key, options.body), options.cookie)).status, 403);
  await writeFile(app.FILES.users, JSON.stringify([{ username: "alice", role: "member", parentEmails: ["parent@example.test"], grade: "8A", passwordHash }]));
  await writeFile(app.FILES.settings, JSON.stringify({ serverEnabled: false }));
  options = await call("/api/passkeys/login/options", {}, "");
  assert.equal((await call("/api/passkeys/login/verify", assertion(key, options.body, { counter: 2 }), options.cookie)).status, 423);
});
test("password reset invalidates previously registered passkeys", async () => {
  const { key } = await enroll();
  await writeFile(app.FILES.users, JSON.stringify([{ username: "alice", role: "member", parentEmails: ["parent@example.test"], passwordHash: await app.hashPasswordAsync("Changed-password-123") }]));
  const options = await call("/api/passkeys/login/options", {}, "");
  assert.equal((await call("/api/passkeys/login/verify", assertion(key, options.body), options.cookie)).status, 401);
});
test("removal requires a password and immediately blocks future sign-in", async () => {
  const { key } = await enroll();
  assert.equal((await call("/api/passkeys/remove", { id: key.id, password: "wrong" })).status, 403);
  assert.equal((await call("/api/passkeys/remove", { id: key.id, password })).status, 200);
  const options = await call("/api/passkeys/login/options", {}, "");
  assert.equal((await call("/api/passkeys/login/verify", assertion(key, options.body), options.cookie)).status, 401);
});

test("setup prompts on the first successful password login and every 20 more", async () => {
  const user = { username: "alice", role: "member", parentEmails: ["parent@example.test"], grade: "8A", passwordHash };
  context.passkeyTestUser = user;
  const record = () => vm.runInContext("getPasskeyHandler().recordPasswordLogin(passkeyTestUser)", context);
  assert.equal(await record(), true);
  for (let count = 1; count < 20; count++) assert.equal(await record(), false);
  assert.equal(await record(), true);
  for (let count = 1; count < 20; count++) assert.equal(await record(), false);
  assert.equal(await record(), true);
  await enroll();
  for (let count = 0; count < 21; count++) assert.equal(await record(), false);
});

test("Don't remind me again persists per account and can be re-enabled", async () => {
  context.passkeyTestUser = { username: "alice", role: "member", parentEmails: ["parent@example.test"], grade: "8A", passwordHash };
  assert.equal((await call("/api/passkeys/reminders", { disabled: true })).status, 200);
  for (let count = 0; count < 22; count++) assert.equal(await vm.runInContext("getPasskeyHandler().recordPasswordLogin(passkeyTestUser)", context), false);
  assert.equal((await call("/api/passkeys")).body.remindersDisabled, true);
  assert.equal((await call("/api/passkeys/reminders", { disabled: false })).status, 200);
  for (let count = 1; count < 20; count++) assert.equal(await vm.runInContext("getPasskeyHandler().recordPasswordLogin(passkeyTestUser)", context), false);
  assert.equal(await vm.runInContext("getPasskeyHandler().recordPasswordLogin(passkeyTestUser)", context), true);
});

test("fresh password login supports setup immediately without asking for the password twice", async () => {
  assert.equal((await call("/api/login", { username: "alice", password: "wrong" }, "")).status, 401);
  const signedIn = await call("/api/login", { username: "alice", password }, "");
  assert.equal(signedIn.status, 200);
  assert.equal(signedIn.body.passkeyPrompt, true);
  const options = await call("/api/passkeys/register/options", { name: "My device" }, signedIn.cookie, { "X-CSRF-Token": signedIn.body.csrfToken });
  assert.equal(options.status, 200, JSON.stringify(options.body));
  const key = credential(options.body);
  assert.equal((await call("/api/passkeys/register/verify", key.registration, `${signedIn.cookie}; ${options.cookie}`, { "X-CSRF-Token": signedIn.body.csrfToken })).status, 201);
  const nextLogin = await call("/api/login", { username: "alice", password }, "");
  assert.equal(nextLogin.status, 200);
  assert.equal(nextLogin.body.passkeyPrompt, false);
});

test("passkey options in another tab leave the first tab's challenge usable", async () => {
  const { key } = await enroll();
  const first = await call("/api/passkeys/login/options", {}, "");
  const second = await call("/api/passkeys/login/options", {}, first.cookie);
  assert.notEqual(first.cookie.split("=")[0], second.cookie.split("=")[0]);
  const result = await call("/api/passkeys/login/verify", assertion(key, first.body), first.cookie + "; " + second.cookie);
  assert.equal(result.status, 200);
});

test("persistent sessions restore after an empty process and logout removes them", async () => {
  await writeFile(app.FILES.settings, JSON.stringify({ serverEnabled: true, persistentLogin: { defaultEnabled: true } }));
  const signedIn = await call("/api/login", { username: "alice", password }, "");
  assert.equal(signedIn.status, 200);
  const rawToken = signedIn.cookie.split("=")[1];
  const saved = JSON.parse(await readFile(app.SESSION_FILE, "utf8"));
  assert.ok(saved.some(([key]) => key === app.hashSessionValue(rawToken)));
  assert.equal(JSON.stringify(saved).includes(rawToken), false);
  app.sessions.clear();
  await app.restoreSessions();
  assert.equal((await call("/api/session/ping", undefined, signedIn.cookie)).status, 200);
  assert.equal((await call("/api/logout", {}, signedIn.cookie, { "X-CSRF-Token": signedIn.body.csrfToken })).status, 200);
  app.sessions.clear();
  await app.restoreSessions();
  assert.equal((await call("/api/session/ping", undefined, signedIn.cookie)).status, 401);
});

test("saved notes and document links preserve text and the browser destination", async () => {
  const note = await call("/api/notes", { title: "Class notes", content: "Line one\nLine two" });
  assert.equal(note.status, 200, JSON.stringify(note.body));
  assert.equal((await call("/api/notes")).body.notes[0].content, "Line one\nLine two");
  const url = "https://docs.google.com/presentation/d/example_slide_id/edit#slide=id.example";
  const link = await call("/api/files/links", { title: "Slides", url });
  assert.equal(link.status, 201, JSON.stringify(link.body));
  const item = (await call("/api/files")).body.files.find((file) => file.id === link.body.file.id);
  assert.equal(item.url, url);
  assert.equal(item.private, true);
});
