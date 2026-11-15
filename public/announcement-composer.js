(() => {
  const t = (key) => window.ConnectifiI18n?.t(key) || key;
  const get = (id) => document.getElementById(id);
  const element = (tag, text, cls) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; };
  const selected = new Map();
  let results = [], generation = 0, controller, timer, identity = "";
  window.selectedAnnouncementRecipients = () => [...selected.keys()];
  window.clearAnnouncementRecipients = () => { selected.clear(); get("announcementRecipientSearch").value = ""; results = []; render(); };
  function render() {
    const scope = get("announcementScope").value, picker = get("announcementPeoplePicker"), tags = get("announcementSelectedPeople");
    picker.hidden = scope !== "people";
    get("announcementRoomLabel").hidden = scope !== "room";
    document.querySelectorAll("[data-announcement-audience]").forEach((node) => { const active = node.dataset.announcementAudience === scope; node.setAttribute("aria-checked", String(active)); node.tabIndex = active ? 0 : -1; });
    tags.replaceChildren();
    for (const [username, person] of selected) {
      const tag = element("span", undefined, "announcement-selected-person"), remove = element("button", "×"); remove.type = "button"; remove.setAttribute("aria-label", `${t("Remove")} ${person.displayName || username}`);
      remove.onclick = () => { selected.delete(username); render(); };
      tag.append(element("span", person.displayName || username), remove); tags.append(tag);
    }
    const list = get("announcementRecipientResults"); list.replaceChildren();
    for (const person of results) {
      const row = element("label", undefined, "announcement-recipient"), checkbox = element("input"); checkbox.type = "checkbox"; checkbox.checked = selected.has(person.username);
      checkbox.onchange = () => { if (checkbox.checked) { if (selected.size >= 400) { checkbox.checked = false; return notify("Select up to 400 people"); } selected.set(person.username, person); } else selected.delete(person.username); render(); };
      const copy = element("span", undefined, "connection-person"); copy.append(element("strong", person.displayName), element("span", `@${person.username}`, "connections-meta"));
      row.append(checkbox, copy, element("span", person.grade || person.role, "connections-meta")); list.append(row);
    }
    if (!results.length) list.append(element("p", t("Search for people to select recipients."), "connections-empty"));
    const summary = scope === "people" ? `${selected.size} ${t("people selected")}` : scope === "room" ? `${t("Room")}: ${get("announcementRoom").selectedOptions[0]?.textContent || ""}` : t("Whole school");
    get("announcementAudienceSummary").textContent = summary;
    get("announcementPreviewAudience").textContent = scope === "people" ? `${t("Specific people")}: ${[...selected.values()].map((entry) => entry.displayName || entry.username).join(", ") || "0"}` : summary;
    get("announcementPreviewTitle").textContent = get("announcementTitle").value || t("Announcement title");
    get("announcementPreviewMessage").textContent = get("announcementMessage").value || t("Your announcement will appear here.");
    get("announcementPreviewSender").textContent = state.user?.username || "";
    get("announcementPreviewAcknowledgement").hidden = !get("announcementAcknowledgement").checked;
    get("sendAnnouncementButton").disabled = !isOwner() || scope === "people" && !selected.size;
  }
  async function search() {
    if (!isOwner()) return;
    controller?.abort(); controller = new AbortController(); const request = ++generation;
    const who = `${state.user?.username}:${state.csrfToken}`;
    try {
      const data = await api(`/api/announcements/recipients?q=${encodeURIComponent(get("announcementRecipientSearch").value.trim())}`, { signal: controller.signal });
      if (request !== generation || who !== `${state.user?.username}:${state.csrfToken}`) return;
      results = data.people; render();
    } catch (error) { if (error.name !== "AbortError" && request === generation) notify(error.message); }
  }
  window.refreshAnnouncementComposer = () => {
    const key = `${state.user?.username}:${state.csrfToken}`;
    if (key !== identity) { identity = key; selected.clear(); results = []; get("announcementRecipientSearch").value = ""; }
    render();
    if (get("announcementScope").value === "people" && !results.length) void search();
  };
  document.querySelectorAll("[data-announcement-audience]").forEach((node, index, nodes) => {
    const activate = () => { get("announcementScope").value = node.dataset.announcementAudience; get("announcementScope").dispatchEvent(new Event("change")); };
    node.onclick = activate;
    node.onkeydown = (event) => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? nodes.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + nodes.length) % nodes.length; nodes[next].click(); nodes[next].focus(); };
  });
  for (const id of ["announcementTitle", "announcementMessage", "announcementAcknowledgement", "announcementRoom"]) get(id).addEventListener("input", render);
  get("announcementRecipientSearch").oninput = () => { generation++; controller?.abort(); clearTimeout(timer); timer = setTimeout(search, 220); };
  window.addEventListener("connectifi-language", render);
  render();
})();
