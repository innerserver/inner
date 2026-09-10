(async function () {
  const title = document.getElementById("detailTitle");
  const subtitle = document.getElementById("detailSubtitle");
  const body = document.getElementById("detailBody");
  const params = new URLSearchParams(location.search);
  const username = String(params.get("user") || "").trim();

  function line(label, value) {
    if (value === undefined || value === null || value === "") return null;
    const row = document.createElement("div");
    row.className = "detail-line";
    const labelNode = document.createElement("span");
    labelNode.textContent = label;
    const valueNode = document.createElement("strong");
    valueNode.textContent = String(value);
    row.append(labelNode, valueNode);
    return row;
  }

  function section(name, rows) {
    const article = document.createElement("article");
    article.className = "detail-section";
    const heading = document.createElement("h2");
    heading.textContent = name;
    article.append(heading);
    const content = rows.flat().filter(Boolean);
    if (content.length) {
      article.append(...content);
    } else {
      const empty = document.createElement("p");
      empty.textContent = "No saved data.";
      article.append(empty);
    }
    return article;
  }

  function formatDate(value) {
    const time = Date.parse(value || "");
    return Number.isFinite(time) ? new Date(time).toLocaleString() : "";
  }

  function formatApprox(location) {
    if (!location) return "";
    if (location.note) return location.note;
    if (location.city || location.region || location.country) return [location.city, location.region, location.country].filter(Boolean).join(", ");
    if (location.latitude && location.longitude) return `${Number(location.latitude).toFixed(4)}, ${Number(location.longitude).toFixed(4)}`;
    try {
      return JSON.stringify(location);
    } catch (error) {
      return "";
    }
  }

  function browserHistoryForUser(logs, target) {
    const current = String(target || "").toLowerCase();
    return (logs || [])
      .filter((log) => String(log.actor || "").toLowerCase() === current && String(log.action || "") === "browser.open")
      .slice(0, 60);
  }

  function loginHistorySection(user) {
    const history = Array.isArray(user.loginHistory) ? user.loginHistory.slice(0, 10) : [];
    const uniqueIps = Array.from(new Set(history.map((entry) => String(entry.ip || "").trim()).filter(Boolean)));
    if (history.length && uniqueIps.length <= 1) {
      return section("Login IP history", [
        line("Recent login IP", uniqueIps[0] || "Same IP"),
        line("Recent login count", history.length),
      ]);
    }
    const details = document.createElement("details");
    details.className = "detail-login-history";
    const summary = document.createElement("summary");
    summary.textContent = `Last ${history.length || 10} login IPs and devices`;
    details.append(summary);
    const rows = history.length
      ? history.flatMap((entry) => [
          line("Time", formatDate(entry.loggedInAt)),
          line("IP", entry.ip),
          line("Device", entry.device),
          line("Approx location", formatApprox(entry.approximateLocation)),
        ])
      : [line("History", "No previous login history has been recorded yet.")];
    details.append(section("", rows));
    return details;
  }

  if (!username) {
    body.textContent = "No username was provided.";
    return;
  }

  try {
    const response = await fetch("/api/state", { credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Sign in as admin to view account details.");
    const users = Array.isArray(data.users) ? data.users : [];
    const user = users.find((entry) => String(entry.username || "").toLowerCase() === username.toLowerCase());
    if (!user) throw new Error("Account not found or your account cannot view admin details.");
    const profile = data.profiles && data.profiles[user.username] ? data.profiles[user.username] : {};
    const contact = user.contact && typeof user.contact === "object" ? user.contact : {};
    const history = browserHistoryForUser(data.logs || [], user.username);

    title.textContent = `${user.username} details`;
    subtitle.textContent = `${user.role || "member"}${user.grade || profile.grade ? ` - Grade ${user.grade || profile.grade}` : ""}`;
    body.replaceChildren(
      section("Identity and contact", [
        line("Display name", user.displayName || profile.displayName),
        line("Username", user.username),
        line("Role", user.role),
        line("Grade", user.grade || profile.grade),
        line("Email from signup/request", user.email || contact.email),
        line("Phone from signup/request", user.phone || contact.phone),
        line("Contact note", typeof user.contact === "string" ? user.contact : contact.contact),
        line("Created", formatDate(user.createdAt)),
        line("Created by", user.createdBy),
      ]),
      section("Latest login and device", [
        line("Persistent login", user.allowPersistentLogin ? "Allowed" : "Off"),
        line("Last login", formatDate(user.lastLoginAt)),
        line("Most used login IP", user.mostLoggedInIp),
        line("Latest IP", user.lastLoginIp || user.sourceIp),
        line("Latest device", user.lastLoginDevice || user.sourceDevice),
        line("Approx location", formatApprox(user.lastLoginApproximateLocation || user.approximateLocation)),
        line("Banned until", formatDate(user.bannedUntil)),
        line("Ban reason", user.banReason),
      ]),
      loginHistorySection(user),
      section("Browser/search history", history.length
        ? history.flatMap((entry) => {
            const details = entry.details || {};
            return [
              line(details.query ? "Search" : "Opened", details.query || details.url || details.host || "Browser open"),
              line("Host", details.host),
              line("URL", details.url),
              line("Path", details.path),
              line("IP", entry.ip),
              line("Device", entry.userAgent),
              line("Time", formatDate(entry.createdAt)),
            ];
          })
        : [line("History", "No Inner Browser opens logged for this account.")])
    );
  } catch (error) {
    body.textContent = error.message || "Could not load account details.";
  }
}());
