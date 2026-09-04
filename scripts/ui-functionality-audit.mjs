const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:5181";
const adminUsername = process.env.AUDIT_ADMIN_USERNAME || "admin2";
const adminPassword = process.env.AUDIT_ADMIN_PASSWORD || "LocalAuditAdmin-20260904";
const suffix = Date.now().toString(36).slice(-5);
const names = { a: `auditalex${suffix}`, b: `auditbailey${suffix}`, c: `auditcasey${suffix}` };

function cookieFrom(headers) {
  return headers.get("set-cookie")?.split(";")[0] || "";
}

async function request(path, { method = "GET", json, cookie, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(json ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...headers },
    body: json ? JSON.stringify(json) : undefined,
  });
  const text = await response.text();
  let body = text;
  try { body = JSON.parse(text); } catch {}
  return { status: response.status, body, headers: response.headers };
}

function assert(condition, message, details = {}) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

async function main() {
  const checks = [];
  const adminLogin = await request("/api/login", { method: "POST", json: { username: adminUsername, password: adminPassword } });
  const adminCookie = cookieFrom(adminLogin.headers);
  assert(adminLogin.status === 200 && adminCookie, "admin login failed", adminLogin);
  checks.push("admin login");

  for (const [key, username] of Object.entries(names)) {
    const created = await request("/api/users", {
      method: "POST",
      cookie: adminCookie,
      json: { username, password: "AuditPass1234", role: "member", grade: key === "c" ? "11A" : "10A", email: `${username}@example.test`, allowPersistentLogin: true },
    });
    assert(created.status === 201, `create ${username} failed`, created);
  }
  checks.push("throwaway users created");

  const loginA = await request("/api/login", { method: "POST", json: { username: names.a, password: "AuditPass1234" } });
  const cookieA = cookieFrom(loginA.headers);
  assert(loginA.status === 200 && cookieA, "user A login failed", loginA);
  const csrfProfile = await request("/api/profile", {
    method: "POST",
    cookie: cookieA,
    headers: { Origin: "https://evil.example.test" },
    json: { displayName: "Blocked Cross Site" },
  });
  assert(csrfProfile.status === 403, "cross-origin authenticated POST was not blocked", csrfProfile);
  const privateBrowserTargets = [
    "http://127.0.0.1:5181/api/state",
    "http://localhost:5181/api/state",
    "http://user:pass@example.com/",
  ];
  for (const target of privateBrowserTargets) {
    const browserCheck = await request(`/api/browser/frame?url=${encodeURIComponent(target)}`, { cookie: cookieA });
    assert([400, 403].includes(browserCheck.status), `unsafe browser target was not blocked: ${target}`, browserCheck);
  }
  checks.push("CSRF and private browser target protections");
  const sameGrade = await request("/api/friends/candidates?q=grade%3A10A", { cookie: cookieA });
  assert((sameGrade.body.people || []).some((person) => person.username === names.b), "same-grade candidate missing", sameGrade.body);
  const exactCross = await request(`/api/friends/candidates?q=${encodeURIComponent(names.c)}`, { cookie: cookieA });
  assert((exactCross.body.people || []).some((person) => person.username === names.c), "exact cross-grade candidate missing", exactCross.body);
  const blockedCross = await request("/api/friends/request", { method: "POST", cookie: cookieA, json: { to: names.c, search: "" } });
  assert(blockedCross.status === 403, "cross-grade request was not blocked", blockedCross);
  const friendRequest = await request("/api/friends/request", { method: "POST", cookie: cookieA, json: { to: names.b, search: "grade:10A" } });
  assert(friendRequest.status === 201, "same-grade request failed", friendRequest);
  checks.push("friend search and request authorization");

  const loginB = await request("/api/login", { method: "POST", json: { username: names.b, password: "AuditPass1234" } });
  const cookieB = cookieFrom(loginB.headers);
  const stateB = await request("/api/state", { cookie: cookieB });
  const incoming = stateB.body.friends?.incoming?.[0];
  assert(incoming?.from === names.a && incoming?.id, "incoming friend request missing", stateB.body.friends);
  const accept = await request("/api/friends/respond", { method: "POST", cookie: cookieB, json: { id: incoming.id, action: "accept" } });
  assert(accept.status === 200, "accept friend request failed", accept);
  const dm = await request("/api/dms", { method: "POST", cookie: cookieA, json: { to: names.b, text: "Private audit DM" } });
  assert(dm.status === 201 && dm.body.dm?.id, "direct message send failed", dm);
  const loginC = await request("/api/login", { method: "POST", json: { username: names.c, password: "AuditPass1234" } });
  const cookieC = cookieFrom(loginC.headers);
  const stateC = await request("/api/state", { cookie: cookieC });
  assert(!(stateC.body.dms || []).some((entry) => entry.id === dm.body.dm.id), "unrelated user received a private DM", stateC.body.dms);
  const themeData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
  const profile = await request("/api/profile", { method: "POST", cookie: cookieA, json: { displayName: "Audit Alex", grade: "10A", theme: "custom", visualStyle: "city", themeImageUrl: themeData, customTheme: { bg: "#102030", surface: "#ffffff", ink: "#101010", accent: "#2f855a" }, bio: "UI audit profile", status: "online", invisible: false } });
  assert(profile.status === 200 && profile.body.profile?.themeImageUrl, "profile theme save failed", profile);
  const finalA = await request("/api/state", { cookie: cookieA });
  assert((finalA.body.friends?.friends || []).some((friend) => friend.username === names.b), "accepted friend missing", finalA.body.friends);
  assert(finalA.body.profiles?.[names.a]?.themeImageUrl, "theme image missing from state", finalA.body.profiles?.[names.a]);
  checks.push("friend acceptance, private DM visibility, and chat theme persistence");
  console.log(JSON.stringify({ ok: true, base, checks }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message, details: error.details || null }, null, 2));
  process.exit(1);
});
