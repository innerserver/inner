(() => {
  const t = (key) => window.ConnectifiI18n?.t(key) || key;
  let snapshot = { tasks: [], events: [], notices: [], teachers: [] }, loaded = "", loading = false, refreshPending = false;
  const staff = () => isModerator();
  const admin = () => ["admin", "hmd", "dev"].includes(state.user?.role);
  const node = (tag, text, className) => { const value = document.createElement(tag); if (text !== undefined) value.textContent = text; if (className) value.className = className; return value; };
  const button = (label, action, primary = false) => { const value = node("button", t(label), `${primary ? "primary" : "secondary"}-button compact-button`); value.type = "button"; value.onclick = async () => { value.disabled = true; try { await action(); } catch (error) { notify(error.message); } finally { value.disabled = false; } }; return value; };
  const field = (label, control) => { const wrapper = node("label", t(label)); wrapper.append(control); return wrapper; };
  const input = (type = "text", required = true) => { const value = node("input"); value.type = type; value.required = required; value.maxLength = 200; return value; };
  const select = (entries) => { const value = node("select"); for (const [id, label] of entries) { const option = node("option", label); option.value = id; value.append(option); } return value; };
  const when = (value) => value ? new Intl.DateTimeFormat(window.ConnectifiI18n?.language || "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : t("No deadline");
  const write = async (url, body = {}) => { await api(url, { method: "POST", json: body }); await window.refreshSchool(true); };
  function modal(title) {
    const dialog = node("dialog", undefined, "school-dialog");
    const header = node("header", undefined, "school-dialog-heading");
    const heading = node("h2", t(title)); heading.id = `school-title-${crypto.randomUUID()}`;
    dialog.setAttribute("aria-labelledby", heading.id);
    const controller = new AbortController();
    const close = () => { controller.abort(); dialog.close(); };
    header.append(heading, button("Close", close)); dialog.append(header);
    dialog.addEventListener("close", () => { controller.abort(); dialog.remove(); }, { once: true });
    document.body.append(dialog); dialog.showModal();
    return { dialog, close, signal: controller.signal };
  }
  function fileLinks(files) {
    const list = node("div", undefined, "school-file-list");
    for (const file of files) { const link = node("a", file.name); link.href = `/api/files/${encodeURIComponent(file.id)}/download`; link.target = "_blank"; link.rel = "noopener"; list.append(link); }
    return list;
  }
  function taskCard(task) {
    const card = node("article", undefined, "school-card");
    card.append(node("h4", task.title), node("p", `${state.rooms.find((room) => room.id === task.roomId)?.name || task.roomId} · ${task.createdBy}`, "panel-note"));
    const instructions = node("p", task.instructions, "school-text");
    card.append(instructions, node("p", `${t("Due date")}: ${when(task.dueAt)}`, "panel-note"), fileLinks(task.files));
    if (task.dueAt && Date.parse(task.dueAt) < Date.now()) card.append(node("span", t("Past due date"), "school-date-past"));
    if (admin() || (staff() && task.createdBy === state.user.username)) card.append(button("Archive", () => write(`/api/school/tasks/${task.id}/archive`)));
    return card;
  }
  function openRoomTasks() {
    const roomId = state.selectedRoomId || "main";
    const { dialog } = modal("Room tasks");
    dialog.append(node("p", state.rooms.find((room) => room.id === roomId)?.name || roomId, "panel-note"));
    if (staff()) dialog.append(button("Post task", () => createTask(roomId), true));
    const list = node("div", undefined, "school-list");
    const entries = snapshot.tasks.filter((task) => task.roomId === roomId);
    entries.forEach((task) => list.append(taskCard(task)));
    if (!entries.length) list.append(node("p", t("No tasks for this room"), "panel-note"));
    dialog.append(list);
  }
  function createTask(selectedRoom) {
    const { dialog, close, signal } = modal("Post task"), form = node("form", undefined, "school-editor");
    const room = select(state.rooms.map((entry) => [entry.id, entry.name]));
    if (selectedRoom) room.value = selectedRoom;
    const title = input(), instructions = node("textarea"), dueAt = input("datetime-local", false), files = input("file", false), status = node("p", "", "panel-note");
    title.maxLength = 120; instructions.maxLength = 10000; instructions.required = true; instructions.rows = 5; files.multiple = true;
    form.append(field("Room", room), field("Title", title), field("Instructions", instructions), field("Due date", dueAt), field("Reference files", files), status);
    const send = node("button", t("Post task"), "primary-button"); send.type = "submit"; form.append(send);
    form.onsubmit = async (event) => {
      event.preventDefault(); if (files.files.length > 10) return notify("Maximum 10 reference files");
      send.disabled = true;
      const roomId = room.value;
      try {
        const uploaded = [];
        for (const file of files.files) uploaded.push(await window.uploadResumableFile(file, "document", { schoolContext: `task:${roomId}`, signal, onProgress: (loaded, total, saving) => { status.textContent = `${file.name}: ${saving ? t("Saving file") : Math.round(loaded / total * 100) + "%"}`; } }));
        await write("/api/school/tasks", { roomId, title: title.value, instructions: instructions.value, dueAt: dueAt.value ? new Date(dueAt.value).toISOString() : "", fileIds: uploaded.map((file) => file.id) });
        close();
      } catch (error) { status.textContent = error.message; } finally { send.disabled = false; }
    };
    dialog.append(form);
  }
  function createEvent() {
    const { dialog, close } = modal("Create event or appointment"), form = node("form", undefined, "school-editor");
    const kind = select([["event", t("Event")], ["appointment", t("Appointment")]]), teacher = select(snapshot.teachers.map((entry) => [entry.username, entry.username]));
    const title = input(), description = node("textarea"), room = select([["", t("All rooms")], ...state.rooms.map((entry) => [entry.id, entry.name])]);
    const start = input("datetime-local"), end = input("datetime-local"), capacity = input("number"), location = input("text", false), status = node("p", "", "panel-note");
    title.maxLength = 120; description.maxLength = 2000; capacity.value = "30"; capacity.min = "1"; capacity.max = "500";
    kind.onchange = () => { capacity.value = kind.value === "appointment" ? "1" : "30"; capacity.disabled = kind.value === "appointment"; };
    form.append(field("Event", kind), field("Teacher", teacher), field("Title", title), field("Description", description), field("Room", room), field("Start", start), field("End", end), node("p", Intl.DateTimeFormat().resolvedOptions().timeZone, "panel-note"), field("Capacity", capacity), field("Location", location), status);
    const send = node("button", t("Create"), "primary-button"); send.type = "submit"; form.append(send);
    form.onsubmit = async (event) => {
      event.preventDefault(); send.disabled = true;
      try { await write("/api/school/events", { kind: kind.value, teacher: teacher.value, title: title.value, description: description.value, roomId: room.value, startsAt: new Date(start.value).toISOString(), endsAt: new Date(end.value).toISOString(), capacity: Number(capacity.value), location: location.value }); close(); }
      catch (error) { status.textContent = error.message; } finally { send.disabled = false; }
    };
    dialog.append(form);
  }
  function render() {
    const workspace = document.getElementById("schoolWorkspace"); if (!workspace || !state.loggedIn) return;
    const toolbar = document.getElementById("schoolActions"); toolbar.replaceChildren();
    if (staff()) toolbar.append(button("Post task", () => createTask(state.selectedRoomId), true));
    if (admin()) toolbar.append(button("Create event or appointment", createEvent));
    const tasks = document.getElementById("schoolTasks"), events = document.getElementById("schoolEvents"), notices = document.getElementById("schoolAcknowledgements");
    tasks.replaceChildren(); events.replaceChildren(); notices.replaceChildren();
    const visibleTasks = [...snapshot.tasks].sort((a, b) => (Date.parse(a.dueAt) || Infinity) - (Date.parse(b.dueAt) || Infinity));
    tasks.parentElement.hidden = !visibleTasks.length;
    visibleTasks.forEach((task) => tasks.append(taskCard(task)));
    const upcoming = snapshot.events.filter((event) => !event.cancelled && Date.parse(event.endsAt) > Date.now()).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    events.parentElement.hidden = !upcoming.length;
    for (const event of upcoming) {
      const card = node("article", undefined, "school-card");
      card.append(node("h4", event.title), node("p", `${t(event.kind === "appointment" ? "Appointment" : "Event")} · ${event.teacher}`, "panel-note"), node("p", `${when(event.startsAt)} – ${when(event.endsAt)}`), node("p", event.description, "school-text"));
      if (event.location) card.append(node("p", event.location));
      card.append(node("span", `${event.bookedCount}/${event.capacity}`, "panel-note"));
      const actions = node("div", undefined, "account-actions");
      if (event.booked) actions.append(button("Cancel booking", () => write(`/api/school/events/${event.id}/cancel-booking`)));
      else if (event.teacher !== state.user.username && Date.parse(event.startsAt) > Date.now()) {
        const book = button(event.bookedCount >= event.capacity ? "Full" : "Book", () => write(`/api/school/events/${event.id}/book`), true);
        book.disabled = event.bookedCount >= event.capacity; actions.append(book);
      }
      if (admin()) actions.append(button("Cancel event", async () => { if (confirm(t("Cancel event") + "?")) await write(`/api/school/events/${event.id}/cancel`); }));
      if (event.bookings) {
        const details = node("details"), summary = node("summary", t("Booked"));
        details.append(summary, node("p", event.bookings.map((entry) => `${entry.username} (${when(entry.bookedAt)})`).join(", ") || t("No bookings yet"))); card.append(details);
      }
      card.append(actions); events.append(card);
    }
    const pending = snapshot.notices.filter((notice) => admin() || !notice.acknowledged);
    notices.parentElement.hidden = !pending.length;
    for (const notice of pending) {
      const card = node("article", undefined, "school-card"); card.append(node("h4", notice.title), node("p", notice.message, "school-text"));
      if (!notice.acknowledged && notice.canAcknowledge !== false) card.append(button("Acknowledge", () => write(`/api/school/announcements/${notice.id}/acknowledge`), true));
      else if (notice.acknowledged) card.append(node("span", t("Acknowledged"), "panel-note"));
      if (notice.receipts) {
        const details = node("details"); details.append(node("summary", t("Acknowledgements")), node("p", notice.receipts.map((entry) => `${entry.username} (${when(entry.acknowledgedAt)})`).join(", ") || "0"), node("p", `${t("Awaiting acknowledgement")}: ${notice.pending.join(", ") || "0"}`)); card.append(details);
      }
      notices.append(card);
    }
  }
  window.refreshSchool = async (force = false) => {
    if (!state.user || !state.loggedIn) { loaded = ""; return; }
    const key = `${state.user.username}:${state.user.grade}:${state.csrfToken}`;
    if (loading) { if (force) refreshPending = true; return; }
    if (!force && loaded === key) return;
    loading = true;
    try {
      const data = await api("/api/school");
      if (!state.loggedIn || key !== `${state.user.username}:${state.user.grade}:${state.csrfToken}`) return;
      snapshot = data; loaded = key;
      window.ConnectifiI18n?.setLanguage(data.language);
      render();
    } catch (error) { if (force) notify(error.message); }
    finally { loading = false; if (refreshPending) { refreshPending = false; void window.refreshSchool(true); } }
  };
  document.getElementById("roomTasksButton").onclick = async () => { await window.refreshSchool(true); openRoomTasks(); };
  const picker = document.getElementById("schoolLanguage");
  picker.value = window.ConnectifiI18n.language;
  picker.onchange = async () => {
    const previous = window.ConnectifiI18n.language;
    try { await write("/api/school/language", { language: picker.value }); }
    catch (error) { picker.value = previous; notify(error.message); }
  };
  document.getElementById("pauseUploadButton").onclick = () => window.currentUploadController?.abort();
  const camera = document.getElementById("photoUploadInput");
  document.getElementById("takePhotoButton").onclick = () => camera.click();
  camera.onchange = async () => {
    const file = camera.files[0]; if (!file) return;
    const takePhoto = document.getElementById("takePhotoButton"); takePhoto.disabled = true;
    try { await uploadOneFile(file, "image", { private: els.privateUpload.checked }); notify(t("Upload complete")); }
    catch (error) { notify(error.message); }
    finally { takePhoto.disabled = false; camera.value = ""; if (els.uploadStatus) els.uploadStatus.textContent = ""; }
  };
  window.addEventListener("connectifi-language", () => { render(); window.refreshQuestionnaires?.(true); });
  setInterval(() => { if (state.loggedIn && !document.hidden) void window.refreshSchool(true); }, 60000);
})();
