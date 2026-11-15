(() => {
  const t = (key) => window.ConnectifiI18n?.t(key) || key;
  const element = (tag, text, cls) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; };
  const get = (id) => document.getElementById(id);
  const button = (text, action, primary = false) => {
    const node = element("button", t(text), `connections-button${primary ? " primary" : ""}`); node.type = "button";
    node.onclick = async () => { node.disabled = true; try { await action(); } catch (error) { notify(error.message); } finally { node.disabled = false; } };
    return node;
  };
  function row(person, actions) {
    const profile = state.profiles[person.username] || {}, name = profile.displayName || person.displayName || person.username;
    const node = element("article", undefined, "connection-row"), avatar = element("div", name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(), "connection-avatar");
    const avatarUrl = profile.avatarUrl || person.avatarUrl;
    if (avatarUrl) { const image = element("img"); image.alt = ""; image.src = avatarUrl; image.loading = "lazy"; image.referrerPolicy = "no-referrer"; image.onerror = () => image.remove(); avatar.append(image); }
    const text = element("div", undefined, "connection-person"); text.append(element("strong", name), element("span", `@${person.username}`, "connections-meta"));
    const tools = element("div", undefined, "connection-actions"); tools.append(...actions);
    node.append(avatar, text, element("span", friendGradeLabel(person), "connection-grade connections-meta"), tools);
    return node;
  }
  function noResults(container, text) { container.append(element("p", t(text), "connections-empty")); }
  let tab = "discover";
  function activate(value, focus = false) {
    tab = value;
    document.querySelectorAll("[data-friends-tab]").forEach((node) => { const active = node.dataset.friendsTab === tab; node.setAttribute("aria-selected", String(active)); node.tabIndex = active ? 0 : -1; if (active && focus) node.focus(); });
    for (const [name, id] of [["discover", "friendsDiscoverPane"], ["friends", "friendsListPane"], ["requests", "friendsRequestsPane"]]) get(id).hidden = tab !== name;
    get("friendsSearchScope").hidden = tab !== "discover";
    get("friendRequestForm").hidden = tab === "requests";
    get("friendsSearchHelp").hidden = tab === "requests";
    window.renderConnections();
  }
  window.renderConnections = () => {
    if (!state.user || !get("friendList")) return;
    state.friendGradeFilter = "";
    const query = String(state.friendSearch || "").trim().replace(/^@/, "").toLowerCase(), ownGrade = gradeOf(state.user);
    get("friendsClassLabel").textContent = ownGrade ? `${t("Your class")} ${ownGrade.toUpperCase()}` : "";
    get("friendState").textContent = t("Find classmates and stay connected.");
    const pending = new Set([...(state.friends.incoming || []).map((entry) => entry.from), ...(state.friends.outgoing || []).map((entry) => entry.to)]);
    const friends = new Set((state.friends.friends || []).map((entry) => entry.username));
    const exact = get("friendsSearchScope").value === "exact";
    const known = state.friendCandidatesLoaded ? state.friendCandidates : state.people;
    const candidates = (known || []).filter((person) => person.username !== state.user.username && !person.banned && !pending.has(person.username) && !friends.has(person.username))
      .filter((person) => exact ? Boolean(query) && person.username.toLowerCase() === query : (isOwner() || Boolean(ownGrade) && gradeOf(person) === ownGrade) && (!query || [person.username, state.profiles[person.username]?.displayName, person.displayName].some((value) => String(value || "").toLowerCase().includes(query))))
      .sort((a, b) => String(a.displayName || a.username).localeCompare(String(b.displayName || b.username)));
    const result = get("friendCandidateList"); result.replaceChildren();
    result.setAttribute("aria-busy", String(Boolean(state.friendCandidatesLoading)));
    get("friendResultsState").textContent = state.friendCandidatesLoading ? t("Searching…") : exact ? t("Exact username") : ownGrade ? ownGrade.toUpperCase() : "";
    if (!featureAvailable("friends")) noResults(result, lockMessage("friends"));
    else if (!candidates.length) noResults(result, state.friendCandidatesLoading ? "Searching…" : exact && !query ? "Enter an exact username to find someone." : "No new matches. Try a different name or exact username.");
    else candidates.forEach((person) => result.append(row(person, [button("Add friend", () => sendFriendRequestTo(person.username))])));
    const list = get("friendList"); list.replaceChildren();
    const matching = (state.friends.friends || []).filter((person) => !query || [person.username, state.profiles[person.username]?.displayName].some((value) => String(value || "").toLowerCase().includes(query)));
    matching.forEach((person) => list.append(row(person, [button("Message", () => { state.selectedDmUser = person.username; showView("dms"); renderDms(); }), button("Remove", async () => { if (confirm(t("Remove friend") + `: ${person.username}?`)) await removeFriend(person.username); })])));
    if (!matching.length) noResults(list, query ? "No friends match this search." : "No friends yet. Find people to send a request.");
    const incoming = get("friendIncomingList"), outgoing = get("friendSentList"); incoming.replaceChildren(); outgoing.replaceChildren();
    for (const request of state.friends.incoming || []) incoming.append(row({ username: request.from }, [button("Accept", () => respondFriendRequest(request.id, "accept"), true), button("Decline", () => respondFriendRequest(request.id, "decline"))]));
    for (const request of state.friends.outgoing || []) outgoing.append(row({ username: request.to }, [element("span", t("Request sent"), "connections-meta"), button("Cancel", async () => { const data = await api("/api/friends/cancel", { method: "POST", json: { id: request.id } }); state.friends = data.friends; window.renderConnections(); void loadFriendCandidates({ silent: true }); })]));
    if (!incoming.children.length) noResults(incoming, "No incoming requests.");
    if (!outgoing.children.length) noResults(outgoing, "No sent requests.");
    get("friendsSearchHelp").textContent = t(tab === "friends" ? "Search your accepted friends by name or username." : "Browse your grade, or select Exact username to find someone in another grade.");
    window.ConnectifiI18n?.apply();
  };
  document.querySelectorAll("[data-friends-tab]").forEach((node, index, nodes) => {
    node.onclick = () => activate(node.dataset.friendsTab);
    node.onkeydown = (event) => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? nodes.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + nodes.length) % nodes.length; activate(nodes[next].dataset.friendsTab, true); };
  });
  get("friendRequestForm").addEventListener("submit", (event) => { event.preventDefault(); void loadFriendCandidates(); });
  get("friendsSearchScope").onchange = () => { renderFriends(); void loadFriendCandidates(); };
  window.addEventListener("connectifi-language", () => renderFriends());
  activate("discover");
})();
