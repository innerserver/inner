const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:5181";
const adminPassword = process.env.AUDIT_ADMIN_PASSWORD || "LocalAuditAdmin-20260904";
const suffix = Date.now().toString(36).slice(-5);
const users = {
  a: `rta${suffix}`,
  b: `rtb${suffix}`,
  c: `rtc${suffix}`,
};

function cookieFrom(headers) {
  return headers.get("set-cookie")?.split(";")[0] || "";
}

async function request(path, { method = "GET", json, cookie } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(json ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: json ? JSON.stringify(json) : undefined,
  });
  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body, headers: response.headers };
}

function assert(condition, message, details = {}) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

async function login(username, password) {
  const response = await request("/api/login", { method: "POST", json: { username, password } });
  const cookie = cookieFrom(response.headers);
  assert(response.status === 200 && cookie, `login failed for ${username}`, response);
  return cookie;
}

async function connect(cookie, clientId) {
  const response = await request("/api/realtime/connect", {
    method: "POST",
    cookie,
    json: { clientId, status: "online" },
  });
  assert(response.status === 200 && response.body.clientId, `realtime connect failed for ${clientId}`, response);
  return response.body.clientId;
}

async function sendRealtime(cookie, clientId, payload) {
  const response = await request("/api/realtime/send", {
    method: "POST",
    cookie,
    json: { clientId, payload },
  });
  assert(response.status === 200, `realtime send failed for ${payload.type}`, response);
}

async function poll(cookie, clientId, since = 0) {
  const response = await request(`/api/realtime/poll?clientId=${encodeURIComponent(clientId)}&since=${encodeURIComponent(since)}`, { cookie });
  assert(response.status === 200, `realtime poll failed for ${clientId}`, response);
  return response.body.events || [];
}

async function main() {
  const checks = [];
  const adminCookie = await login("admin", adminPassword);

  for (const username of Object.values(users)) {
    const created = await request("/api/users", {
      method: "POST",
      cookie: adminCookie,
      json: { username, password: "AuditPass1234", role: "member", grade: "10A", allowPersistentLogin: true },
    });
    assert(created.status === 201, `create failed for ${username}`, created);
  }
  checks.push({ check: "created three throwaway realtime users", status: "pass", users });

  const cookieA = await login(users.a, "AuditPass1234");
  const cookieB = await login(users.b, "AuditPass1234");
  const cookieC = await login(users.c, "AuditPass1234");

  const friendRequest = await request("/api/friends/request", {
    method: "POST",
    cookie: cookieA,
    json: { to: users.b, search: "grade:10A" },
  });
  assert(friendRequest.status === 201, "friend request A -> B failed", friendRequest);
  const stateB = await request("/api/state", { cookie: cookieB });
  const incoming = stateB.body.friends?.incoming?.[0];
  assert(incoming?.from === users.a && incoming?.id, "B did not receive friend request", stateB.body.friends);
  const accept = await request("/api/friends/respond", {
    method: "POST",
    cookie: cookieB,
    json: { id: incoming.id, action: "accept" },
  });
  assert(accept.status === 200, "B could not accept friend request", accept);
  checks.push({ check: "friend pair prepared for DM call", status: "pass" });

  const clientA = await connect(cookieA, `http_${users.a}`);
  const clientB = await connect(cookieB, `http_${users.b}`);
  const clientC = await connect(cookieC, `http_${users.c}`);
  const dmRoom = `dm:${[users.a, users.b].sort((left, right) => left.localeCompare(right)).join(":")}`;
  checks.push({ check: "http realtime clients connected", status: "pass", clients: { clientA, clientB, clientC } });

  await poll(cookieB, clientB);
  await poll(cookieC, clientC);

  await sendRealtime(cookieA, clientA, { type: "call:invite", roomId: dmRoom, roomLabel: users.b, mode: "voice" });
  await sendRealtime(cookieA, clientA, { type: "voice:join", roomId: dmRoom, muted: false, deafened: false, videoEnabled: false, cameraOff: true });
  await sendRealtime(cookieA, clientA, { type: "screen:status", roomId: dmRoom, sharing: true });

  const bEvents = await poll(cookieB, clientB);
  const cEvents = await poll(cookieC, clientC);
  const bPayloads = bEvents.map((event) => event.payload || {});
  const cPayloads = cEvents.map((event) => event.payload || {});

  assert(bPayloads.some((payload) => payload.type === "call:invite" && payload.roomId === dmRoom), "B did not receive DM call invite", bPayloads);
  assert(bPayloads.some((payload) => payload.type === "voice:update" && payload.roomId === dmRoom), "B did not receive DM voice update", bPayloads);
  assert(bPayloads.some((payload) => payload.type === "screen:status" && payload.roomId === dmRoom && payload.sharing), "B did not receive DM screen status", bPayloads);
  assert(!cPayloads.some((payload) => payload.roomId === dmRoom), "unrelated user received private DM realtime event", cPayloads);
  checks.push({ check: "DM call/screen realtime scoped to participants", status: "pass" });

  await sendRealtime(cookieA, clientA, { type: "screen:status", roomId: dmRoom, sharing: false });
  await sendRealtime(cookieA, clientA, { type: "voice:leave", roomId: dmRoom });
  checks.push({ check: "DM call/screen leave events accepted", status: "pass" });

  console.log(JSON.stringify({ ok: true, base, checks }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message, details: error.details || null }, null, 2));
  process.exit(1);
});
