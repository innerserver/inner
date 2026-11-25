import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile, writeFile, mkdir, mkdtemp, rm, readdir } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { once, EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import vm from "node:vm";
import WebSocket from "ws";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "server.js"));
const source = await readFile(path.join(root, "server.js"), "utf8");
const directory = await mkdtemp(path.join(tmpdir(), "connectifi-security-"));
const exportsCode = `; globalThis.app = {
  route, createInnerServer, handleUpgrade, sessions, wsClients, httpRealtimeClients, FILES,
  readJsonBody, readBody, getCookie, isSameOriginRequest, getClientIp, isHttpsRequest,
  isPrivateBrowserAddress, assertSafeBrowserTarget, guardedBrowserFetch, serveBrowserFrame,
  consumeSecurityRate, securityRateLimits, verifyPasswordAsync, hashPasswordAsync,
  upsertHttpRealtimeClient, revokeSession, sendFrame, websocketServer, persistence,
  readJson, writeJson, validateUploadBuffer, safeContentDisposition, fetchAi,
};`;
function harness(extraEnv = {}, overrideRequire = require) {
  const context = vm.createContext({
    require: overrideRequire, __dirname: root, Buffer, URL, AbortSignal, AbortController,
    setTimeout, clearTimeout, setInterval, clearInterval, console,
    fetch: (...args) => fetch(...args),
    process: { env: { INNER_LOCALHOST_MODE: "true", INNER_DATA_DIR: directory, ...extraEnv }, pid: process.pid },
  });
  vm.runInContext(source.slice(0, source.lastIndexOf("main().catch(")) + exportsCode, context);
  return { context, app: context.app };
}
const { app } = harness();
let server, origin;
const req = (headers = {}) => ({ headers: { host: "example.test", ...headers }, socket: { remoteAddress: "127.0.0.1" } });
const session = (name = "alice") => {
  const token = `${name}-${Math.random()}`;
  app.sessions.set(token, { username: name, role: "member", parentEmails: ["parent@example.test"], grade: "9A", csrfToken: "test-csrf", expiresAt: Date.now() + 3600000 });
  return token;
};
const message = (ws, type) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { ws.off("message", listener); reject(new Error(`Missing ${type}`)); }, 3000);
  const listener = (data) => {
    const value = JSON.parse(data);
    if (value.type === type) { clearTimeout(timer); ws.off("message", listener); resolve(value); }
  };
  ws.on("message", listener);
});
async function connect(token = session(), socketOrigin = origin) {
  const ws = new WebSocket(origin.replace("http", "ws") + "/ws", { origin: socketOrigin, headers: { Cookie: `server_app_session=${token}` } });
  ws.on("error", () => {});
  const hello = message(ws, "hello");
  await once(ws, "open");
  return { ws, hello: await hello, token };
}
before(async () => {
  await mkdir(path.join(directory, "uploads"), { recursive: true });
  const fixtures = {
    settings: { serverEnabled: true },
    users: [{ username: "alice", role: "member", parentEmails: ["parent@example.test"], grade: "9A" }, { username: "bob", role: "member", parentEmails: ["parent@example.test"], grade: "9A" }],
    profiles: {}, rooms: [{ id: "main", name: "Main" }], friends: { requests: [], friendships: [["alice", "bob"]] },
  };
  for (const [key, value] of Object.entries(fixtures)) await writeFile(app.FILES[key], JSON.stringify(value));
  server = app.createInnerServer((request, response) => {
    app.route(request, response).catch((error) => {
      if (!response.destroyed && !response.headersSent) {
        response.writeHead(error.statusCode || 500, { "Content-Type": "application/json", "Connection": "close" });
        response.end(JSON.stringify({ error: error.message }));
      }
    });
  });
  server.on("upgrade", (request, socket, head) => app.handleUpgrade(request, socket, head).catch(() => socket.destroy()));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  for (const client of app.wsClients.values()) client.webSocket.terminate();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  app.websocketServer.close();
  await rm(directory, { recursive: true, force: true });
});

test("cross-origin login is rejected before credentials are read", async () => {
  const response = await fetch(`${origin}/api/login`, { method: "POST", headers: { Origin: "https://attacker.test" }, body: "{}" });
  assert.equal(response.status, 403);
});
test("public health hides internal database errors and malformed URLs return 400", async () => {
  app.persistence.error = "internal-test-secret";
  const response = await fetch(`${origin}/api/health`);
  assert.equal((await response.text()).includes("internal-test-secret"), false);
  app.persistence.error = "";
  assert.equal((await fetch(`${origin}/%invalid`)).status, 400);
});
test("exact origins include the scheme, and malformed cookies are harmless", () => {
  assert.equal(app.isSameOriginRequest(req({ origin: "http://example.test" })), true);
  assert.equal(app.isSameOriginRequest(req({ origin: "https://example.test" })), false);
  assert.equal(app.isSameOriginRequest(req({ origin: "http://user@example.test" })), false);
  assert.equal(app.getCookie(req({ cookie: "server_app_session=%ZZ" }), "server_app_session"), "");
});
test("forwarded addresses and protocols require explicit proxy trust", () => {
  const request = req({ "x-forwarded-for": "8.8.8.8, 1.1.1.1", "x-forwarded-proto": "https" });
  assert.equal(app.getClientIp(request), "127.0.0.1");
  assert.equal(app.isHttpsRequest(request), false);
  const trusted = harness({ INNER_TRUST_PROXY: "true" }).app;
  assert.equal(trusted.getClientIp(request), "1.1.1.1");
  assert.equal(trusted.isHttpsRequest(request), true);
  trusted.websocketServer.close();
});
test("JSON primitives, arrays, oversized credentials and large bodies are rejected", async () => {
  for (const body of ["null", "[]", '"text"', '{"password":"' + "a".repeat(1025) + '"}']) {
    const response = await fetch(`${origin}/api/login`, { method: "POST", body });
    assert.equal(response.status, 400);
  }
  const response = await fetch(`${origin}/api/login`, { method: "POST", body: "a".repeat(1024 * 1024 + 1) });
  assert.equal(response.status, 413);
});
test("rate windows and limiter storage are bounded and cannot evict active limits", () => {
  assert.equal(app.consumeSecurityRate("test-window", 1, 100, 1000), true);
  assert.equal(app.consumeSecurityRate("test-window", 1, 100, 1001), false);
  assert.equal(app.consumeSecurityRate("test-window", 1, 100, 1100), true);
  app.securityRateLimits.clear();
  for (let i = 0; i < 20000; i++) app.consumeSecurityRate(`key-${i}`, 1, 100, 1000);
  assert.equal(app.consumeSecurityRate("new-key", 1, 100, 1001), false);
  assert.equal(app.securityRateLimits.size, 20000);
  assert.equal(app.consumeSecurityRate("new-key", 1, 100, 1101), true);
  app.securityRateLimits.clear();
});
test("account admission rejects excess attempts before parsing the body", async () => {
  app.securityRateLimits.set("auth:127.0.0.1", { count: 600, expiresAt: Date.now() + 60000 });
  const response = await fetch(`${origin}/api/login`, { method: "POST", body: "malformed-json" });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
  app.securityRateLimits.clear();
});
test("password hashes remain compatible and expensive operations shed excess work", async () => {
  const hash = await app.hashPasswordAsync("example-password");
  assert.equal(await app.verifyPasswordAsync("example-password", hash), true);
  assert.equal(await app.verifyPasswordAsync("wrong-password", hash), false);
  const results = await Promise.allSettled(Array.from({ length: 9 }, () => app.verifyPasswordAsync("example-password", hash)));
  assert.equal(results.filter((entry) => entry.status === "rejected" && entry.reason.statusCode === 503).length, 1);
});
test("HTTP realtime client identifiers cannot be claimed by another user or session", () => {
  const alice = session(), bob = session("bob"), otherAlice = session();
  const request = (token) => req({ cookie: `server_app_session=${token}` });
  const body = { clientId: "http_test_client" };
  const original = app.upsertHttpRealtimeClient({ username: "alice", role: "member" }, body, request(alice));
  assert.throws(() => app.upsertHttpRealtimeClient({ username: "bob" }, body, request(bob)), { statusCode: 403 });
  assert.throws(() => app.upsertHttpRealtimeClient({ username: "alice" }, body, request(otherAlice)), { statusCode: 403 });
  assert.equal(app.httpRealtimeClients.get(body.clientId), original);
  app.revokeSession(alice);
  assert.equal(app.httpRealtimeClients.has(body.clientId), false);
});
test("WebSocket cross-origin upgrades are rejected", async () => {
  const ws = new WebSocket(origin.replace("http", "ws") + "/ws", { origin: "https://attacker.test", headers: { Cookie: `server_app_session=${session()}` } });
  ws.on("error", () => {});
  const status = await new Promise((resolve, reject) => {
    ws.on("unexpected-response", (_request, response) => { response.resume(); ws.terminate(); resolve(response.statusCode); });
    ws.on("open", () => reject(new Error("Cross-origin upgrade accepted")));
  });
  assert.equal(status, 403);
});
test("fragmented WebSocket messages and screen signaling still work", async () => {
  const alice = await connect(), bob = await connect(session("bob"));
  const pong = message(alice.ws, "pong");
  alice.ws.send('{"type":', { fin: false });
  alice.ws.send('"ping"}', { fin: true });
  assert.equal((await pong).type, "pong");
  const received = message(bob.ws, "screen:signal");
  alice.ws.send(JSON.stringify({ type: "screen:signal", roomId: "screen:global", target: bob.hello.clientId, signal: { type: "offer", sdp: "test-only" } }));
  assert.equal((await received).from, alice.hello.clientId);
  alice.ws.terminate(); bob.ws.terminate();
});
test("normal signaling bursts queue without disconnecting and slow consumers have a bound", async () => {
  const { ws, token } = await connect();
  const received = new Promise((resolve, reject) => {
    let count = 0;
    const timer = setTimeout(() => reject(new Error("Burst did not drain")), 3000);
    ws.on("message", (data) => { if (JSON.parse(data).type === "pong" && ++count === 100) { clearTimeout(timer); resolve(); } });
  });
  for (let i = 0; i < 100; i++) ws.send('{"type":"ping"}');
  await received;
  assert.equal(ws.readyState, WebSocket.OPEN);
  const slowClient = { username: "alice", sessionToken: token, webSocket: { readyState: 1, bufferedAmount: 4 * 1024 * 1024, send: () => assert.fail("Should not add to a full queue") } };
  assert.equal(app.sendFrame({}, Buffer.from("x"), 1, slowClient), false);
  ws.terminate();
});
test("unmasked, oversized and non-object WebSocket messages disconnect safely", async () => {
  for (const [payload, options] of [['{"type":"ping"}', { mask: false }], ["a".repeat(1024 * 1024 + 1), {}], ["null", {}]]) {
    const { ws } = await connect();
    const closed = once(ws, "close");
    ws.send(payload, options);
    await closed;
  }
});
test("logout immediately closes that session's WebSocket", async () => {
  const { ws, token } = await connect();
  const closed = once(ws, "close");
  const response = await fetch(`${origin}/api/logout`, { method: "POST", headers: { Origin: origin, Cookie: `server_app_session=${token}`, "X-CSRF-Token": "test-csrf" } });
  assert.equal(response.status, 200);
  await closed;
  assert.equal(app.sessions.has(token), false);
});
test("expired sessions cannot keep sending over an established WebSocket", async () => {
  const { ws, token } = await connect();
  const closed = once(ws, "close");
  app.sessions.get(token).expiresAt = Date.now() - 1;
  ws.send('{"type":"ping"}');
  await closed;
});
test("private, reserved and IPv4-mapped IPv6 browser targets are rejected", async () => {
  for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "::1", "fd00::1", "0:0:0:0:0:ffff:7f00:1", "::ffff:192.168.1.1", "::ffff:7f00:1", "198.18.0.1"]) {
    assert.equal(app.isPrivateBrowserAddress(address), true, address);
  }
  for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) assert.equal(app.isPrivateBrowserAddress(address), false, address);
  await assert.rejects(app.assertSafeBrowserTarget("http://[::ffff:7f00:1]/"));
  await assert.rejects(app.assertSafeBrowserTarget("https://user:password@example.com/"));
});
test("browser documents receive a server-enforced opaque-origin sandbox", async () => {
  const { app: isolated, context } = harness();
  vm.runInContext(`guardedBrowserFetch = async () => ({ ok: true, headers: { "content-type": "text/html" }, body: Buffer.from('<html><head></head><body onload="alert(1)"><script>alert(1)</script></body></html>') });`, context);
  const headers = {};
  const response = { setHeader: (key, value) => { headers[key] = value; }, end: () => {} };
  await isolated.serveBrowserFrame(req(), response, new URL("http://example.test/api/browser/frame?url=https://example.com"), { username: "alice", role: "member" });
  assert.match(headers["Content-Security-Policy"], /^sandbox;/);
  assert.match(headers["Content-Security-Policy"], /script-src 'none'/);
  assert.doesNotMatch(headers["Content-Security-Policy"], /allow-same-origin|allow-scripts/);
  isolated.websocketServer.close();
});
test("browser fetches stop private redirects and enforce an absolute deadline", async () => {
  const dns = { promises: { lookup: async () => [{ address: "1.1.1.1", family: 4 }] } };
  let redirect = true, requests = 0;
  const transport = { request: (_url, options, callback) => {
    requests++;
    const request = new EventEmitter();
    request.destroy = (error) => request.emit("error", error);
    request.end = () => {
      const upstream = new PassThrough();
      upstream.statusCode = redirect ? 302 : 200;
      upstream.headers = redirect ? { location: "http://127.0.0.1/private" } : {};
      const abort = () => request.destroy(new Error("Browser request timed out."));
      options.signal.addEventListener("abort", abort, { once: true });
      callback(upstream);
      if (redirect) { upstream.end(); options.signal.removeEventListener("abort", abort); }
    };
    return request;
  } };
  const isolated = harness({}, (name) => name === "dns" ? dns : ["http", "https"].includes(name) ? transport : require(name)).app;
  await assert.rejects(isolated.guardedBrowserFetch("https://example.com"), /private/);
  assert.equal(requests, 1);
  redirect = false;
  const controller = new AbortController();
  const pending = isolated.guardedBrowserFetch("https://example.com", 5, controller.signal);
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(pending, /timed out/);
  isolated.websocketServer.close();
});
test("configured database failures never read or write stale local account files", async () => {
  const isolated = harness().app;
  isolated.persistence.ready = true;
  isolated.persistence.json = { findOne: async () => { throw new Error("offline"); }, updateOne: async () => { throw new Error("offline"); } };
  await assert.rejects(isolated.readJson(isolated.FILES.users, []), { statusCode: 503 });
  await assert.rejects(isolated.writeJson(isolated.FILES.users, []), { statusCode: 503 });
  const users = JSON.parse(await readFile(app.FILES.users, "utf8"));
  assert.equal(users.length, 2);
  isolated.websocketServer.close();
});
test("one reset link cannot be completed concurrently or replayed", async () => {
  await writeFile(app.FILES.passwordResets, JSON.stringify([{ id: "reset-test", username: "alice", tokenHash: await app.hashPasswordAsync("reset-secret"), expiresAt: new Date(Date.now() + 60000).toISOString() }]));
  const perform = () => fetch(`${origin}/api/password-reset/complete`, { method: "POST", headers: { Origin: origin }, body: JSON.stringify({ token: "reset-test.reset-secret", nextPassword: "new-test-password" }) });
  const responses = await Promise.all([perform(), perform()]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  assert.equal((await perform()).status, 400);
});
test("disguised executable uploads fail validation and active formats download as attachments", () => {
  assert.match(app.validateUploadBuffer(Buffer.from("MZ executable"), ".exe", "image/png"), /blocked/);
  assert.match(app.validateUploadBuffer(Buffer.from("<script>alert(1)"), ".png", "image/png"), /match/);
  assert.match(app.safeContentDisposition({ originalName: "payload.html", kind: "document" }, { ...req(), url: "/download" }), /^attachment;/);
});
test("aborted uploads remove their partial file", async () => {
  const token = session("bob");
  const upload = httpRequest(`${origin}/api/upload`, { method: "POST", headers: {
    Origin: origin, Cookie: `server_app_session=${token}`, "X-CSRF-Token": "test-csrf",
    "X-File-Name": "partial.png", "X-File-Type": "image/png", "Content-Type": "application/octet-stream",
  } });
  upload.on("error", () => {});
  upload.write(Buffer.from("89504e470d0a1a0a", "hex"));
  const files = () => readdir(path.join(directory, "quarantine")).catch(() => []);
  const waitUntil = async (condition) => {
    for (let i = 0; i < 100; i++) {
      if (await condition()) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.fail("Upload cleanup condition not reached");
  };
  try { await waitUntil(async () => (await files()).length === 1); }
  finally { upload.destroy(); }
  await waitUntil(async () => (await files()).length === 0);
});
test('owner secret access remains while removed allowlist members lose conversation visibility',()=>{const {context,app:isolated}=harness();try{const result=vm.runInContext(`(()=>{const allowed={secretMessaging:{allowedUsers:['alice']}},removed={secretMessaging:{allowedUsers:[]}};const message={id:'s1',user:'alice',text:'Private fixture'},dm={id:'d1',secret:true,participants:['alice','bob'],from:'alice',to:'bob',text:'Private fixture'};return {allowed:safeSecretMessages([message],{username:'alice',role:'member'},allowed).length,removed:safeSecretMessages([message],{username:'alice',role:'member'},removed).length,dmRemoved:safeSecretDms([dm],{username:'alice',role:'member'},removed).length,unselectedParticipant:safeSecretDms([dm],{username:'bob',role:'member'},allowed).length,owner:safeSecretDms([dm],{username:'admin',role:'admin'},removed).length};})()`,context);assert.equal(result.allowed,1);assert.equal(result.removed,0);assert.equal(result.dmRemoved,0);assert.equal(result.unselectedParticipant,0);assert.equal(result.owner,1);}finally{isolated.websocketServer.close();}});
