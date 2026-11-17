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
  function createPtm() {
    const { dialog, close } = modal('Create PTM schedule'), form = node('form', undefined, 'school-editor');
    dialog.classList.add('ptm-dialog');
    const title = input(), teacher = select(snapshot.teachers.map((entry) => [entry.username, entry.username]));
    const subject = input(), grade = select([6,7,8,9,10,11,12].map((year) => [String(year), `Grade ${year}`]));
    const duration = input('number'), location = input('text', false), description = node('textarea');
    title.value = 'Parent teacher meeting'; title.maxLength = 120; subject.maxLength = 100;
    duration.value = '10'; duration.min = '5'; duration.max = '120'; duration.step = '1'; description.maxLength = 2000;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    description.rows = 2;
    const fields = node('div', undefined, 'ptm-editor-fields');
    fields.append(field('Title', title), field('Teacher', teacher), field('Teaching subject', subject), field('Grade', grade), field('Minutes per slot', duration), field('Location', location), field('Details', description));
    form.append(fields, node('p', `Times are entered in ${timeZone}. Each full slot is for one student. Grades include classes A, B and C.`, 'panel-note'));
    const days = node('div', undefined, 'ptm-days-editor'), rows = [], preview = node('p', 'Add dates, availability and any breaks, then preview the slots.', 'panel-note');
    preview.setAttribute('role', 'status');
    function addDay() {
      if (rows.length >= 30) return notify('Maximum 30 days per schedule');
      const panel = node('fieldset', undefined, 'ptm-day-editor'), legend = node('legend', 'Availability day');
      const day = input('date'), start = input('time'), end = input('time'), breaks = node('div', undefined, 'ptm-breaks');
      start.value = '09:00'; end.value = '13:00';
      const row = { day, start, end, breaks: [] }; rows.push(row);
      function addBreak() {
        if (row.breaks.length >= 12) return notify('Maximum 12 breaks per day');
        const line = node('div', undefined, 'ptm-time-row'), from = input('time'), to = input('time');
        const pause = { from, to }; row.breaks.push(pause);
        line.append(field('Break starts', from), field('Break ends', to), button('Remove break', () => { row.breaks.splice(row.breaks.indexOf(pause), 1); line.remove(); preview.textContent = 'Preview again after changing availability.'; })); breaks.append(line);
      }
      const line = node('div', undefined, 'ptm-time-row'); line.append(field('Date', day), field('From', start), field('Until', end));
      const actions = node('div', undefined, 'button-row'); actions.append(button('Add break', addBreak), button('Remove day', () => { rows.splice(rows.indexOf(row), 1); panel.remove(); preview.textContent = 'Preview again after changing availability.'; }));
      panel.append(legend, line, breaks, actions); days.append(panel);
    }
    function localInstant(day, time) {
      const parsed = new Date(`${day}T${time}`);
      const pad = (value) => String(value).padStart(2, '0');
      if (!day || !time || !Number.isFinite(parsed.getTime()) || `${parsed.getFullYear()}-${pad(parsed.getMonth()+1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}` !== `${day}T${time}`) throw new Error('Choose a valid local date and time');
      return parsed.toISOString();
    }
    function collect() {
      if (!rows.length) throw new Error('Add at least one PTM day');
      return rows.map((row) => ({ startsAt: localInstant(row.day.value, row.start.value), endsAt: localInstant(row.day.value, row.end.value), breaks: row.breaks.map((pause) => ({ startsAt: localInstant(row.day.value, pause.from.value), endsAt: localInstant(row.day.value, pause.to.value) })) }));
    }
    function previewSlots() {
      const minutes = Number(duration.value);
      if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) throw new Error('Choose 5 to 120 minutes per slot');
      const labels = collect().map((day) => {
        let cursor = Date.parse(day.startsAt), count = 0;
        const end = Date.parse(day.endsAt);
        if (cursor <= Date.now() || end <= cursor) throw new Error('Availability must start in the future and end after it starts');
        for (const pause of [...day.breaks].sort((a,b) => Date.parse(a.startsAt)-Date.parse(b.startsAt))) {
          const from = Date.parse(pause.startsAt), to = Date.parse(pause.endsAt);
          if (from < cursor || to > end || to <= from) throw new Error('Breaks must be inside availability and cannot overlap');
          count += Math.floor((from-cursor)/(minutes*60000)); cursor = to;
        }
        count += Math.floor((end-cursor)/(minutes*60000));
        return `${when(day.startsAt)}: ${count} slots, ${day.breaks.length} breaks`;
      });
      preview.textContent = `${labels.join(' · ')}. Partial slots are left unavailable. The server checks teacher conflicts before saving.`;
    }
    const dayActions = node('div', undefined, 'button-row'); dayActions.append(button('Add day', addDay), button('Preview slots', previewSlots));
    form.append(days, dayActions, preview);
    const send = node('button', 'Create schedule', 'primary-button'); send.type = 'submit'; form.append(send);
    form.onsubmit = async (event) => {
      event.preventDefault(); send.disabled = true;
      try { previewSlots(); await write('/api/school/ptm', { title: title.value, teacher: teacher.value, subject: subject.value, grade: grade.value, slotMinutes: Number(duration.value), location: location.value, description: description.value, timeZone, days: collect() }); close(); }
      catch (error) { preview.textContent = error.message; } finally { send.disabled = false; }
    };
    addDay(); dialog.append(form);
  }
  const ptmSelections = new Map();
  function renderPtm() {
    const container = document.getElementById('schoolPtm'); if (!container) return;
    container.replaceChildren();
    const schedules = (snapshot.ptmSchedules || []).filter((entry) => !entry.cancelled && snapshot.events.some((slot) => slot.ptmScheduleId === entry.id && !slot.cancelled && Date.parse(slot.endsAt) > Date.now())).sort((a,b) => Number(a.grade)-Number(b.grade) || a.teacher.localeCompare(b.teacher));
    container.parentElement.hidden = !schedules.length;
    const groups = new Map();
    for (const schedule of schedules) {
      if (!groups.has(schedule.grade)) { const group = node('section', undefined, 'ptm-grade'); group.append(node('h4', `Grade ${schedule.grade}`)); groups.set(schedule.grade, group); container.append(group); }
      const card = node('article', undefined, 'school-card ptm-schedule');
      card.append(node('h5', `${schedule.teacher} · ${schedule.subject}`), node('p', schedule.title), node('p', `${schedule.slotMinutes} minutes per student · ${schedule.timeZone}${schedule.location ? ` · ${schedule.location}` : ''}`, 'panel-note'));
      if (schedule.description) card.append(node('p', schedule.description, 'school-text'));
      const selectionKey = `${state.user.username}:${state.csrfToken}:${schedule.id}`;
      let student;
      if (admin()) {
        student = select([['', 'Choose a student to book for'], ...(snapshot.ptmStudents || []).filter((entry) => window.ConnectifiGrades.gradeYear(entry.grade) === schedule.grade).map((entry) => [entry.username, `${entry.username} · ${entry.grade}`])]);
        student.value = ptmSelections.get(selectionKey) || '';
        card.append(field('Book for student', student));
        student.onchange = () => { ptmSelections.set(selectionKey, student.value); renderDays(); };
      }
      const days = node('div', undefined, 'ptm-schedule-days'); card.append(days);
      function renderDays() {
        days.replaceChildren();
        const slots = snapshot.events.filter((entry) => entry.ptmScheduleId === schedule.id && !entry.cancelled && Date.parse(entry.endsAt) > Date.now()).sort((a,b) => Date.parse(a.startsAt)-Date.parse(b.startsAt));
        const target = admin() ? student.value : state.user.username;
        const existing = snapshot.events.find((entry) => entry.ptmScheduleId === schedule.id && !entry.cancelled && (entry.bookings?.some((booking) => booking.username === target) || (!admin() && entry.booked)));
        if (existing) days.append(node('p', `Already booked: ${new Intl.DateTimeFormat(window.ConnectifiI18n?.language || 'en', { timeZone: schedule.timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(existing.startsAt))}. Cancel that slot before choosing another for this student.`, 'panel-note'));
        const byDay = new Map(), formatter = new Intl.DateTimeFormat(window.ConnectifiI18n?.language || 'en', { timeZone: schedule.timeZone, dateStyle: 'full' });
        const time = new Intl.DateTimeFormat(window.ConnectifiI18n?.language || 'en', { timeZone: schedule.timeZone, timeStyle: 'short' });
        const slotTime = (value) => time.format(new Date(value));
        for (const slot of slots) { const key = formatter.format(new Date(slot.startsAt)); if (!byDay.has(key)) byDay.set(key, []); byDay.get(key).push(slot); }
        let first = true;
        for (const [label, entries] of byDay) {
          const details = node('details', undefined, 'ptm-day'), list = node('ul', undefined, 'ptm-slot-list');
          details.open = first || entries.some((entry) => entry.booked || entry.id === existing?.id); first = false;
          details.append(node('summary', `${label} · ${entries.filter((entry) => !entry.bookedCount && Date.parse(entry.startsAt)>Date.now()).length} available`));
          const scheduleDay = schedule.days.find((day) => formatter.format(new Date(day.startsAt)) === label);
          if (scheduleDay) details.append(node('p', `Available: ${slotTime(scheduleDay.startsAt)} to ${slotTime(scheduleDay.endsAt)}${scheduleDay.breaks.length ? ` · Breaks: ${scheduleDay.breaks.map((pause) => `${slotTime(pause.startsAt)} to ${slotTime(pause.endsAt)}`).join('; ')}` : ''}`, 'panel-note'));
          for (const slot of entries) {
            const row = node('li', undefined, 'ptm-slot-row'), info = node('div');
            info.append(node('strong', `${slotTime(slot.startsAt)} to ${slotTime(slot.endsAt)}`));
            const booking = slot.bookings?.[0];
            info.append(node('small', booking ? `${booking.username} · ${booking.grade || ''}` : slot.booked ? 'Your booking' : slot.bookedCount ? 'Booked' : 'Available'));
            row.append(info);
            if (slot.booked || (admin() && booking)) row.append(button('Cancel booking', () => write(`/api/school/events/${slot.id}/cancel-booking`, booking ? { username: booking.username } : {})));
            else if (!slot.bookedCount && Date.parse(slot.startsAt)>Date.now() && (admin() || state.user.role === 'member')) {
              const book = button('Book slot', () => { if (admin() && !student.value) throw new Error('Choose a student first'); return write(`/api/school/events/${slot.id}/book`, admin() ? { username: student.value } : {}); }, true);
              book.disabled = Boolean(existing); row.append(book);
            }
            list.append(row);
          }
          details.append(list); days.append(details);
        }
      }
      renderDays();
      if (admin()) card.append(button('Cancel PTM schedule', async () => { if (confirm('Cancel this schedule and all its slots?')) await write(`/api/school/ptm/${schedule.id}/cancel`); }));
      groups.get(schedule.grade).append(card);
    }
  }
  function render() {
    const workspace = document.getElementById("schoolWorkspace"); if (!workspace || !state.loggedIn) return;
    const toolbar = document.getElementById("schoolActions"); toolbar.replaceChildren();
    if (staff()) toolbar.append(button("Post task", () => createTask(state.selectedRoomId), true));
    if (admin()) toolbar.append(button("Create event or appointment", createEvent));
    if (admin()) toolbar.append(button('Create PTM schedule', createPtm));
    const tasks = document.getElementById("schoolTasks"), events = document.getElementById("schoolEvents"), notices = document.getElementById("schoolAcknowledgements");
    tasks.replaceChildren(); events.replaceChildren(); notices.replaceChildren();
    const visibleTasks = [...snapshot.tasks].sort((a, b) => (Date.parse(a.dueAt) || Infinity) - (Date.parse(b.dueAt) || Infinity));
    tasks.parentElement.hidden = !visibleTasks.length;
    visibleTasks.forEach((task) => tasks.append(taskCard(task)));
    renderPtm();
    const upcoming = snapshot.events.filter((event) => !event.ptmScheduleId && !event.cancelled && Date.parse(event.endsAt) > Date.now()).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
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
      if (loaded !== key) ptmSelections.clear();
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
