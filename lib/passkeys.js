const crypto = require("node:crypto");
const webauthn = require("@simplewebauthn/server");

// Challenges and write serialization have the same single-process scope as sessions.
module.exports = function createPasskeys(d, verifier = webauthn) {
  const pending = new Map();
  let queue = Promise.resolve();
  const cookieName = "connectifi_passkey";
  const ttl = 5 * 60 * 1000;
  const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
  const handle = (user) => crypto.createHash("sha256").update(`connectifi-passkey:${user.username}:${user.passwordHash}`).digest("base64url");
  const serial = (fn) => { const result = queue.then(fn); queue = result.catch(() => {}); return result; };
  const owned = (key, user) => key.username === user.username && key.userHandle === handle(user);
  const summary = (key) => ({ id: key.id, name: key.name, createdAt: key.createdAt, lastUsedAt: key.lastUsedAt || "" });
  function context(req) {
    const configured = d.origin();
    const target = new URL(configured || `${d.secure(req) ? "https" : "http"}://${req.headers.host}`);
    if (target.username || target.password || target.pathname !== "/" || target.search || target.hash || (target.protocol !== "https:" && !(target.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)))) throw fail("Passkeys require HTTPS on the configured Connectifi domain.");
    if (req.headers.origin !== target.origin || !d.sameOrigin(req)) throw fail("Passkey origin does not match this Connectifi installation.", 403);
    return { origin: target.origin, rpID: target.hostname };
  }
  function loginCookieName(challenge) {
    return /^[\w-]{20,128}$/.test(challenge || "") ? cookieName + "_" + challenge : "";
  }
  function cookie(req, name, value, maxAge) {
    return name + "=" + value + "; HttpOnly; SameSite=Strict; Path=/api/passkeys; Max-Age=" + maxAge + (d.secure(req) ? "; Secure" : "");
  }
  function remember(req, res, data) {
    for (const [id, item] of pending) if (item.expiresAt <= Date.now()) pending.delete(id);
    const name = data.type === "login" ? loginCookieName(data.challenge) : cookieName;
    if (!name) throw fail("Could not issue passkey options.", 503);
    const previous = d.cookie(req, name);
    if (previous) pending.delete(previous);
    if (pending.size >= 2000) throw fail("Too many passkey requests. Try again shortly.", 503);
    const token = crypto.randomBytes(32).toString("base64url");
    pending.set(token, { ...data, expiresAt: Date.now() + ttl });
    res.setHeader("Set-Cookie", cookie(req, name, token, 300));
  }
  function take(req, res, type, expected, body) {
    let name = cookieName;
    if (type === "login") {
      try {
        const raw = body.response?.clientDataJSON;
        if (typeof raw !== "string" || raw.length > 4096) throw new Error();
        name = loginCookieName(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")).challenge);
      } catch { name = ""; }
    }
    const token = name ? d.cookie(req, name) : "", item = pending.get(token);
    pending.delete(token); // Consume before any asynchronous verification, including failures.
    if (name) res.setHeader("Set-Cookie", cookie(req, name, "", 0));
    if (!item || item.type !== type || item.expiresAt <= Date.now() || item.origin !== expected.origin || item.rpID !== expected.rpID || (type === "register" && item.session !== d.sessionToken(req))) throw fail("Passkey request expired or was already used. Please start again.");
    return item;
  }
  async function passwordUser(req, body, allowRecentPassword = false) {
    const session = d.user(req);
    if (!session) throw fail("Sign in before managing passkeys.", 401);
    const users = await d.users();
    const user = users.find((entry) => entry.username === session.username);
    if (!user || d.banned(user)) throw fail("Account is unavailable.", 403);
    if (!d.rate(`passkey-manage:${user.username}`, 10, 60000)) throw fail("Too many passkey changes. Try again in a minute.", 429);
    const recentlyVerified = allowRecentPassword && !body.password && d.recentPassword(req);
    if (!recentlyVerified && !await d.password(String(body.password || ""), user.passwordHash)) throw fail("Current password is incorrect.", 403);
    return user;
  }
  async function preference(user, change) {
    return serial(async () => {
      const all = await d.readPreferences();
      const previous = all[user.username];
      const item = previous?.userHandle === handle(user) ? previous : { userHandle: handle(user), passwordLogins: 0, disabled: false };
      const result = await change(item);
      // Define a data property even for unusual account names such as __proto__.
      Object.defineProperty(all, user.username, { value: item, enumerable: true, configurable: true, writable: true });
      await d.writePreferences(all);
      return result;
    });
  }
  const route = async function route(req, res, pathname) {
    if (!pathname.startsWith("/api/passkeys")) return false;
    res.setHeader("Cache-Control", "no-store");
    try {
      if (req.method === "GET" && pathname === "/api/passkeys") {
        const session = d.user(req);
        if (!session) throw fail("Sign in before managing passkeys.", 401);
        const user = (await d.users()).find((entry) => entry.username === session.username);
        if (!user) throw fail("Account is unavailable.", 403);
        const preferences = await d.readPreferences();
        const remindersDisabled = preferences[user.username]?.userHandle === handle(user) && preferences[user.username].disabled === true;
        d.json(res, 200, { passkeys: (await d.read()).filter((key) => owned(key, user)).map(summary), remindersDisabled });
        return true;
      }
      if (req.method !== "POST") throw fail("Passkey route not found.", 404);
      const expected = context(req);
      if (!d.rate(`passkey-ip:${d.ip(req)}`, 60, 60000)) throw fail("Too many passkey attempts. Try again in a minute.", 429);
      const body = await d.body(req);
      if (pathname === "/api/passkeys/reminders") {
        const session = d.user(req);
        if (!session) throw fail("Sign in before changing passkey reminders.", 401);
        const user = (await d.users()).find((entry) => entry.username === session.username);
        if (!user || d.banned(user)) throw fail("Account is unavailable.", 403);
        if (typeof body.disabled !== "boolean") throw fail("Choose whether to receive reminders.");
        await preference(user, (item) => { item.disabled = body.disabled; item.passwordLogins = 0; item.firstPromptShown = true; });
        d.json(res, 200, { ok: true, remindersDisabled: body.disabled });
      } else if (pathname === "/api/passkeys/register/options") {
        const user = await passwordUser(req, body, true);
        const keys = (await d.read()).filter((key) => owned(key, user));
        if (keys.length >= 10) throw fail("Remove a passkey before adding another. Each account can keep ten.");
        const options = await verifier.generateRegistrationOptions({ rpName: "Connectifi", rpID: expected.rpID, userName: user.username, userID: Buffer.from(handle(user), "base64url"), attestationType: "none", timeout: 60000, excludeCredentials: keys.map((key) => ({ id: key.id, transports: key.transports })), authenticatorSelection: { residentKey: "required", userVerification: "required" } });
        remember(req, res, { ...expected, type: "register", challenge: options.challenge, username: user.username, userHandle: handle(user), session: d.sessionToken(req), name: String(body.name || "My passkey").trim().slice(0, 80) || "My passkey" });
        d.json(res, 200, options);
      } else if (pathname === "/api/passkeys/register/verify") {
        const item = take(req, res, "register", expected), session = d.user(req);
        const user = (await d.users()).find((entry) => entry.username === item.username);
        if (!session || session.username !== item.username || !user || d.banned(user) || handle(user) !== item.userHandle) throw fail("Account changed. Sign in and start again.", 403);
        const result = await verifier.verifyRegistrationResponse({ response: body, expectedChallenge: item.challenge, expectedOrigin: item.origin, expectedRPID: item.rpID, requireUserVerification: true });
        if (!result.verified || !result.registrationInfo) throw fail("Passkey verification failed.");
        const credential = result.registrationInfo.credential;
        await serial(async () => {
          const keys = await d.read();
          if (keys.some((key) => key.id === credential.id)) throw fail("This passkey is already registered.");
          if (keys.filter((key) => owned(key, user)).length >= 10) throw fail("Passkey limit reached.");
          keys.push({ username: user.username, userHandle: item.userHandle, id: credential.id, publicKey: Buffer.from(credential.publicKey).toString("base64url"), counter: credential.counter, transports: (credential.transports || []).filter((value) => ["usb", "nfc", "ble", "internal", "hybrid", "smart-card"].includes(value)), name: item.name, createdAt: new Date().toISOString() });
          await d.write(keys);
        });
        await d.log("passkey.registered", user.username, {}, req);
        d.json(res, 201, { ok: true });
      } else if (pathname === "/api/passkeys/login/options") {
        const options = await verifier.generateAuthenticationOptions({ rpID: expected.rpID, timeout: 60000, userVerification: "required" });
        remember(req, res, { ...expected, type: "login", challenge: options.challenge });
        d.json(res, 200, options);
      } else if (pathname === "/api/passkeys/login/verify") {
        const item = take(req, res, "login", expected, body);
        await serial(async () => {
          const keys = await d.read(), key = keys.find((entry) => entry.id === body.id);
          const users = await d.users(), user = key && users.find((entry) => entry.username === key.username && owned(key, entry));
          if (!key || !user || body.response?.userHandle !== key.userHandle) throw fail("Unable to sign in with this passkey.", 401);
          const result = await verifier.verifyAuthenticationResponse({ response: body, expectedChallenge: item.challenge, expectedOrigin: item.origin, expectedRPID: item.rpID, requireUserVerification: true, credential: { id: key.id, publicKey: Buffer.from(key.publicKey, "base64url"), counter: key.counter, transports: key.transports } });
          if (!result.verified) throw fail("Unable to sign in with this passkey.", 401);
          key.counter = result.authenticationInfo.newCounter;
          key.lastUsedAt = new Date().toISOString();
          await d.write(keys);
          const latestUsers = await d.users();
          const latestUser = latestUsers.find((entry) => entry.username === key.username && owned(key, entry));
          if (!latestUser) throw fail("Account changed. Please sign in again.", 401);
          await d.login(latestUsers, latestUser, req, res, "passkey");
        });
      } else if (pathname === "/api/passkeys/remove") {
        const user = await passwordUser(req, body);
        await serial(async () => {
          const keys = await d.read(), key = keys.find((entry) => entry.id === body.id && owned(entry, user));
          if (!key) throw fail("Passkey not found.", 404);
          await d.write(keys.filter((entry) => entry !== key));
        });
        await d.log("passkey.removed", user.username, {}, req);
        d.json(res, 200, { ok: true });
      } else throw fail("Passkey route not found.", 404);
    } catch (error) {
      if (!res.headersSent) d.json(res, error.statusCode || 400, { error: error.statusCode ? error.message : "Passkey verification failed. Please try again." });
    }
    return true;
  };
  route.recordPasswordLogin = (user) => preference(user, async (item) => {
    const hasPasskey = (await d.read()).some((key) => owned(key, user));
    if (hasPasskey || item.disabled) return false;
    if (!item.firstPromptShown) {
      item.firstPromptShown = true;
      item.passwordLogins = 0;
      return true;
    }
    item.passwordLogins = Math.max(0, Number(item.passwordLogins) || 0) + 1;
    if (item.passwordLogins < 20) return false;
    item.passwordLogins = 0;
    return true;
  });
  return route;
};
