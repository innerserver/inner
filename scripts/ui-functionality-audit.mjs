const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:5181";
const suffix = Date.now().toString(36).slice(-5);
const names = {
  a: `auditalex${suffix}`,
  b: `auditbailey${suffix}`,
  c: `auditcasey${suffix}`,
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

async function main() {
  const checks = [];
  const adminLogin = await request("/api/login", {
    method: "POST",
    json: { username: "admin", password: process.env.AUDIT_ADMIN_PASSWORD || "LocalAuditAdmin-20260904" },
  });
  const adminCookie = cookieFrom(adminLogin.headers);
  assert(adminLogin.status === 200 && adminCookie, "admin login failed", adminLogin);
  checks.push({ check: "admin login", status: "pass" });

  for (const [key, username] of Object.entries(names)) {
    const grade = key === "c" ? "11A" : "10A";
    const created = await request("/api/users", {
      method: "POST",
      cookie: adminCookie,
      json: {
        username,
        password: "AuditPass1234",
        role: "member",
        grade,
        email: `${username}@example.test`,
        allowPersistentLogin: true,
      },
    });
    assert(created.status === 201, `create ${username} failed`, created);
  }
  checks.push({ check: "throwaway users created", status: "pass", users: names });

  const loginA = await request("/api/login", { method: "POST", json: { username: names.a, password: "AuditPass1234" } });
  const cookieA = cookieFrom(loginA.headers);
  assert(loginA.status === 200 && cookieA, "user A login failed", loginA);
  checks.push({ check: "normal user login", status: "pass" });

  const sameGrade = await request("/api/friends/candidates?q=grade%3A10A", { cookie: cookieA });
  assert(sameGrade.status === 200, "same-grade search failed", sameGrade);
  assert((sameGrade.body.people || []).some((person) => person.username === names.b), "same-grade candidate missing", sameGrade.body);
  checks.push({ check: "grade friend search", status: "pass", candidates: sameGrade.body.people.map((person) => person.username) });

  const exactCross = await request(`/api/friends/candidates?q=${encodeURIComponent(names.c)}`, { cookie: cookieA });
  assert(exactCross.status === 200, "exact cross-grade search failed", exactCross);
  assert((exactCross.body.people || []).some((person) => person.username === names.c), "exact cross-grade candidate missing", exactCross.body);
  checks.push({ check: "exact username friend search across grade", status: "pass" });

  const blockedCross = await request("/api/friends/request", {
    method: "POST",
    cookie: cookieA,
    json: { to: names.c, search: "" },
  });
  assert(blockedCross.status === 403, "cross-grade friend request was not blocked without exact proof", blockedCross);
  checks.push({ check: "cross-grade add requires exact search proof", status: "pass" });

  const friendRequest = await request("/api/friends/request", {
    method: "POST",
    cookie: cookieA,
    json: { to: names.b, search: "grade:10A" },
  });
  assert(friendRequest.status === 201, "same-grade friend request failed", friendRequest);
  checks.push({ check: "same-grade friend request", status: "pass" });

  const loginB = await request("/api/login", { method: "POST", json: { username: names.b, password: "AuditPass1234" } });
  const cookieB = cookieFrom(loginB.headers);
  assert(loginB.status === 200 && cookieB, "user B login failed", loginB);
  const stateB = await request("/api/state", { cookie: cookieB });
  const incoming = stateB.body.friends?.incoming?.[0];
  assert(incoming?.from === names.a && incoming?.id, "incoming friend request missing", stateB.body.friends);
  const accept = await request("/api/friends/respond", {
    method: "POST",
    cookie: cookieB,
    json: { id: incoming.id, action: "accept" },
  });
  assert(accept.status === 200 && (accept.body.friends?.friends || []).some((friend) => friend.username === names.a), "accept friend request failed", accept);
  checks.push({ check: "incoming friend request accept", status: "pass" });

  const themeData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
  const profile = await request("/api/profile", {
    method: "POST",
    cookie: cookieA,
    json: {
      displayName: "Audit Alex",
      grade: "10A",
      theme: "custom",
      visualStyle: "city",
      themeImageUrl: themeData,
      customTheme: { bg: "#102030", surface: "#ffffff", ink: "#101010", accent: "#2f855a" },
      bio: "UI audit profile",
      status: "online",
      invisible: false,
    },
  });
  assert(profile.status === 200 && profile.body.profile?.theme === "custom" && profile.body.profile?.themeImageUrl, "profile theme save failed", profile);
  checks.push({ check: "custom profile/chat theme image save", status: "pass" });

  const finalA = await request("/api/state", { cookie: cookieA });
  assert((finalA.body.friends?.friends || []).some((friend) => friend.username === names.b), "accepted friend missing from user A state", finalA.body.friends);
  assert(finalA.body.profiles?.[names.a]?.theme === "custom" && finalA.body.profiles?.[names.a]?.themeImageUrl, "theme missing from state", finalA.body.profiles?.[names.a]);
  checks.push({ check: "state reflects friend and custom theme", status: "pass" });

  console.log(JSON.stringify({ ok: true, base, checks }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message, details: error.details || null }, null, 2));
  process.exit(1);
});
