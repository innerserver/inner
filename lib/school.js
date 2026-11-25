const crypto = require("crypto");
const { announcementAudience } = require("./announcements");
const { gradeYear } = require('../public/grade-utils');
const { buildPtmSchedule } = require('./ptm');

module.exports = function createSchool(deps) {
  const { readJson, writeJson, FILES, canManage, canModerate, canAccessRoom, questionnaireAudience, readJsonBody, json, broadcast } = deps;
  let queue = Promise.resolve();
  const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
  const text = (value, max = 2000) => String(value || "").trim().slice(0, max);
  const date = (value) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : "";
  const empty = () => ({ tasks: [], events: [], ptmSchedules: [], ptmRequests: [], bookings: [], acknowledgements: [], preferences: {} });
  async function load() { return { ...empty(), ...await readJson(FILES.school, {}) }; }
  function serial(operation) {
    const next = queue.then(operation); queue = next.catch(() => {}); return next;
  }
  const inRoom = (id, user, rooms) => rooms.some((room) => room.id === id && canAccessRoom(room, user));
  const visibleEvent = (event, user, rooms) => canManage(user) || event.teacher === user.username || (event.ptmScheduleId ? user.role === 'member' && gradeYear(user.grade) === event.grade : (!event.roomId || inRoom(event.roomId, user, rooms)));
  const canRequestStudent = (teacher, student, rooms) => student?.role === 'member' && (canManage(teacher) || rooms.some(room => room.id !== 'main' && canAccessRoom(room, teacher) && canAccessRoom(room, student)));
  async function snapshot(user) {
    const [data, rooms, users, announcements] = await Promise.all([load(), readJson(FILES.rooms, []), readJson(FILES.users, []), readJson(FILES.announcements, [])]);
    const tasks = data.tasks.filter((task) => !task.archived && inRoom(task.roomId, user, rooms));
    const ptmRequests = data.ptmRequests.filter(entry => canManage(user) || entry.teacher === user.username || entry.student === user.username);
    const ptmRecipients = canModerate(user) ? users.filter(student => canRequestStudent(user, student, rooms)).map(student => ({username:student.username,grade:student.grade})) : [];
    const events = data.events.filter((event) => visibleEvent(event, user, rooms)).map((event) => {
      const bookings = data.bookings.filter((entry) => entry.eventId === event.id);
      return { ...event, bookedCount: bookings.length, booked: bookings.some((entry) => entry.username === user.username), bookings: canManage(user) || event.teacher === user.username ? bookings : undefined };
    });
    const notices = announcements.filter((notice) => notice.active !== false && notice.requireAcknowledgement && (canManage(user) || announcementAudience(notice, user, rooms, canAccessRoom))).map((notice) => {
      const receipts = data.acknowledgements.filter((entry) => entry.announcementId === notice.id);
      const eligible = users.filter((entry) => announcementAudience(notice, entry, rooms, canAccessRoom) && (notice.scope === "people" || !canManage(entry)));
      return { id: notice.id, title: notice.title, message: notice.message, canAcknowledge: announcementAudience(notice, user, rooms, canAccessRoom), acknowledged: receipts.some((entry) => entry.username === user.username), receipts: canManage(user) ? receipts : undefined, pending: canManage(user) ? eligible.filter((entry) => !receipts.some((receipt) => receipt.username === entry.username)).map((entry) => entry.username) : undefined };
    });
    return { tasks, events, ptmRequests, ptmRecipients, ptmSchedules: data.ptmSchedules.filter((entry) => canManage(user) || entry.teacher === user.username || (user.role === 'member' && gradeYear(user.grade) === entry.grade)), ptmStudents: canManage(user) ? users.filter((entry) => entry.role === 'member' && /^(6|7|8|9|10|11|12)$/.test(gradeYear(entry.grade))).map((entry) => ({ username: entry.username, grade: entry.grade })) : [], notices, language: Object.hasOwn(data.preferences, user.username) ? data.preferences[user.username].language : "en", languages: ["en", "es", "fr", "hi"], teachers: canManage(user) ? users.filter(canModerate).map((entry) => ({ username: entry.username, role: entry.role })) : [] };
  }
  async function handle(req, res, sessionUser, url) {
    const users = await readJson(FILES.users, []);
    const user = users.find((entry) => entry.username === sessionUser.username);
    if (!user) throw error("Account unavailable", 403);
    if (req.method === "GET" && url.pathname === "/api/school") return json(res, 200, await snapshot(user));
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    const body = await readJsonBody(req);
    return serial(async () => {
      const data = await load(), rooms = await readJson(FILES.rooms, []);
      const route = url.pathname;
      if (route === "/api/school/language") {
        if (!["en", "es", "fr", "hi"].includes(body.language)) throw error("Unsupported language");
        data.preferences = { ...data.preferences, [user.username]: { language: body.language } };
      } else if (route === "/api/school/tasks") {
        if (!canModerate(user) || !inRoom(body.roomId, user, rooms)) throw error("Teacher access to this room required", 403);
        const files = await readJson(FILES.uploads, []);
        const fileIds = [...new Set(Array.isArray(body.fileIds) ? body.fileIds.map(String) : [])];
        if (fileIds.length > 10 || fileIds.some((id) => !files.some((file) => file.id === id && file.user === user.username && file.schoolContext === `task:${body.roomId}` && file.validatedUpload === true))) throw error("Choose task files uploaded for this room");
        const title = text(body.title, 120), instructions = text(body.instructions, 10000);
        if (!title || !instructions) throw error("Task title and instructions required");
        const dueAt = date(body.dueAt);
        if (body.dueAt && !dueAt) throw error("Invalid task deadline");
        if (data.tasks.length >= 2000) data.tasks = data.tasks.filter((entry) => !entry.archived);
        if (data.tasks.length >= 2000) throw error("Task limit reached. Archive older tasks.");
        data.tasks.unshift({ id: crypto.randomUUID(), roomId: body.roomId, title, instructions, dueAt, files: fileIds.map((id) => { const file = files.find((entry) => entry.id === id); return { id, name: file.originalName }; }), createdBy: user.username, createdAt: new Date().toISOString(), archived: false });
      } else if (/^\/api\/school\/tasks\/[^/]+\/archive$/.test(route)) {
        const task = data.tasks.find((entry) => entry.id === route.split("/")[4]);
        if (!task) throw error("Task not found", 404);
        if (!canManage(user) && !(canModerate(user) && task.createdBy === user.username && inRoom(task.roomId, user, rooms))) throw error("Only the task teacher can archive it", 403);
        task.archived = true;
      } else if (route === '/api/school/ptm-requests') {
        if (!canModerate(user)) throw error('Teacher access required', 403);
        const student = users.find(entry => entry.username === body.student);
        if (!canRequestStudent(user, student, rooms)) throw error('Choose a student from your rooms', 403);
        const schedule = body.scheduleId ? data.ptmSchedules.find(entry => entry.id === body.scheduleId && !entry.cancelled && entry.teacher === user.username && entry.grade === gradeYear(student.grade) && entry.days.some(day => Date.parse(day.endsAt)>Date.now())) : null;
        if (body.scheduleId && !schedule) throw error('Choose your active PTM schedule for this grade');
        const subject = text(schedule?.subject || body.subject,100), message = text(body.message,2000);
        if (!subject || !message) throw error('Teaching subject and meeting message required');
        const expiresAt = body.expiresAt ? date(body.expiresAt) : new Date(Date.now()+14*86400000).toISOString();
        if (!expiresAt || Date.parse(expiresAt)<=Date.now() || Date.parse(expiresAt)>Date.now()+90*86400000) throw error('Choose an expiry within the next 90 days');
        if (data.ptmRequests.length >= 2000) throw error('PTM request limit reached');
        if (data.ptmRequests.some(entry => entry.teacher===user.username && entry.student===student.username && ['pending','accepted'].includes(entry.status) && Date.parse(entry.expiresAt)>Date.now() && entry.scheduleId===(schedule?.id||''))) throw error('An active request already exists for this student',409);
        data.ptmRequests.unshift({id:crypto.randomUUID(),teacher:user.username,student:student.username,grade:student.grade,subject,message,scheduleId:schedule?.id||'',status:'pending',createdAt:new Date().toISOString(),expiresAt});
      } else if (/^\/api\/school\/ptm-requests\/[^/]+\/(accept|decline|cancel)$/.test(route)) {
        const id=route.split('/')[4], action=route.split('/')[5], entry=data.ptmRequests.find(value=>value.id===id);
        if (!entry || (action==='cancel' ? !canManage(user)&&entry.teacher!==user.username : entry.student!==user.username)) throw error('PTM request not found',404);
        if (Date.parse(entry.expiresAt)<=Date.now() || !['pending','accepted'].includes(entry.status) || (action!=='cancel' && entry.status!=='pending')) throw error('This request is no longer awaiting a response',409);
        entry.status={accept:'accepted',decline:'declined',cancel:'cancelled'}[action];entry.respondedAt=new Date().toISOString();
      } else if (route === '/api/school/ptm') {
        if (!canManage(user)) throw error('Only admins create PTM schedules', 403);
        const teacher = users.find((entry) => entry.username === body.teacher && canModerate(entry));
        if (!teacher) throw error('Choose an active teacher');
        const { schedule, slots } = buildPtmSchedule(body);
        if (data.ptmSchedules.length >= 500 || data.events.length + slots.length > 2000) throw error('Schedule or event limit reached');
        const overlap = (left, right) => Date.parse(left.startsAt) < Date.parse(right.endsAt) && Date.parse(left.endsAt) > Date.parse(right.startsAt);
        if (slots.some((slot) => data.events.some((entry) => !entry.cancelled && entry.teacher === teacher.username && overlap(slot, entry)))) throw error('This teacher already has an event or appointment during these slots', 409);
        schedule.createdBy = user.username; schedule.createdAt = new Date().toISOString();
        data.ptmSchedules.unshift(schedule);
        data.events.push(...slots.map((slot) => ({ id: crypto.randomUUID(), ptmScheduleId: schedule.id, title: schedule.title, description: schedule.description, teacher: teacher.username, subject: schedule.subject, grade: schedule.grade, location: schedule.location, timeZone: schedule.timeZone, kind: 'appointment', capacity: 1, roomId: '', ...slot, createdBy: user.username, createdAt: schedule.createdAt, cancelled: false })));
      } else if (/^\/api\/school\/ptm\/[^/]+\/cancel$/.test(route)) {
        if (!canManage(user)) throw error('Admin access required', 403);
        const schedule = data.ptmSchedules.find((entry) => entry.id === route.split('/')[4]);
        if (!schedule) throw error('PTM schedule not found', 404);
        schedule.cancelled = true;
        data.events.filter((entry) => entry.ptmScheduleId === schedule.id).forEach((entry) => { entry.cancelled = true; });
      } else if (route === "/api/school/events") {
        if (!canManage(user)) throw error("Only admins set teacher events and appointments", 403);
        const teacher = users.find((entry) => entry.username === body.teacher && canModerate(entry));
        const startsAt = date(body.startsAt), endsAt = date(body.endsAt), roomId = text(body.roomId, 80);
        const capacity = Number(body.capacity), kind = body.kind === "appointment" ? "appointment" : "event";
        if (!teacher || !text(body.title, 120) || !startsAt || !endsAt || Date.parse(startsAt) <= Date.now() || Date.parse(endsAt) <= Date.parse(startsAt) || !Number.isInteger(capacity) || capacity < 1 || capacity > 500 || (roomId && (!inRoom(roomId, user, rooms) || !inRoom(roomId, teacher, rooms)))) throw error("Check the teacher, room, dates and capacity");
        if (data.events.some((entry) => !entry.cancelled && (kind === "appointment" || entry.ptmScheduleId) && entry.teacher === teacher.username && Date.parse(entry.startsAt) < Date.parse(endsAt) && Date.parse(entry.endsAt) > Date.parse(startsAt))) throw error("This teacher already has an overlapping booking window", 409);
        if (data.events.length >= 2000) throw error("Event limit reached");
        data.events.unshift({ id: crypto.randomUUID(), title: text(body.title, 120), description: text(body.description), location: text(body.location, 200), teacher: teacher.username, kind, roomId, startsAt, endsAt, capacity: kind === "appointment" ? 1 : capacity, createdBy: user.username, createdAt: new Date().toISOString(), cancelled: false });
      } else if (/^\/api\/school\/events\/[^/]+\/(book|cancel-booking|cancel)$/.test(route)) {
        const [, , , , id, action] = route.split("/");
        const event = data.events.find((entry) => entry.id === id);
        if (!event || !visibleEvent(event, user, rooms)) throw error("Event not found", 404);
        const bookingUsername = body.username || user.username;
        if (bookingUsername !== user.username && !canManage(user)) throw error('Only admins can book for another student', 403);
        const student = users.find((entry) => entry.username === bookingUsername);
        if (action === 'book' && !student) throw error('Student account not found', 404);
        if (action === 'book' && event.ptmScheduleId && (!student || student.role !== 'member' || gradeYear(student.grade) !== event.grade)) throw error('Choose a student from this grade', 403);
        if (action === "cancel") {
          if (!canManage(user)) throw error("Admin access required", 403);
          event.cancelled = true;
        } else if (action === "cancel-booking") {
          data.bookings = data.bookings.filter((entry) => entry.eventId !== id || entry.username !== bookingUsername);
        } else {
          if (event.cancelled || Date.parse(event.startsAt) <= Date.now()) throw error("Booking is closed", 409);
          if (event.teacher === bookingUsername) throw error("Teachers cannot book their own appointment");
          if (!data.bookings.some((entry) => entry.eventId === id && entry.username === bookingUsername)) {
            if (event.ptmScheduleId && data.bookings.some((entry) => entry.username === bookingUsername && data.events.some((other) => other.id === entry.eventId && !other.cancelled && other.ptmScheduleId === event.ptmScheduleId))) throw error('This student already has a slot with this teacher in this PTM schedule. Cancel it before choosing another', 409);
            if (data.bookings.filter((entry) => entry.eventId === id).length >= event.capacity) throw error("This event is full", 409);
            if (data.bookings.some((entry) => entry.username === bookingUsername && data.events.some((other) => other.id === entry.eventId && !other.cancelled && Date.parse(other.startsAt) < Date.parse(event.endsAt) && Date.parse(other.endsAt) > Date.parse(event.startsAt)))) throw error("This student has another booking at this time", 409);
            data.bookings.push({ eventId: id, username: bookingUsername, ...(event.ptmScheduleId ? { grade: student.grade } : {}), bookedAt: new Date().toISOString() });
            if (event.ptmScheduleId) data.ptmRequests.filter(entry=>entry.student===bookingUsername && entry.scheduleId===event.ptmScheduleId && ['pending','accepted'].includes(entry.status)).forEach(entry=>{entry.status='booked';entry.respondedAt=new Date().toISOString();});
          }
        }
      } else if (/^\/api\/school\/announcements\/[^/]+\/acknowledge$/.test(route)) {
        const id = route.split("/")[4], notices = await readJson(FILES.announcements, []);
        const notice = notices.find((entry) => entry.id === id && entry.active !== false && entry.requireAcknowledgement);
        if (!notice || !announcementAudience(notice, user, rooms, canAccessRoom)) throw error("Notice not found", 404);
        if (!data.acknowledgements.some((entry) => entry.announcementId === id && entry.username === user.username)) data.acknowledgements.push({ announcementId: id, username: user.username, acknowledgedAt: new Date().toISOString() });
      } else return json(res, 404, { error: "School route not found" });
      if (Buffer.byteLength(JSON.stringify(data)) > 12 * 1024 * 1024) throw error("School data limit reached. Ask an admin to archive and export older records.");
      await writeJson(FILES.school, data);
      broadcast({ type: "school:update" });
      return json(res, 200, { ok: true });
    });
  }
  async function uploadAccess(context, user) {
    if (!context) return null;
    const rooms = await readJson(FILES.rooms, []);
    if (context.startsWith("task:")) {
      const roomId = context.slice(5);
      if (!canModerate(user) || !inRoom(roomId, user, rooms)) throw error("Teacher access to this room required", 403);
      return { schoolContext: context, releaseRoom: roomId, private: false, schoolReaders: [] };
    }
    if (context.startsWith("form:")) {
      const forms = await readJson(FILES.questionnaires, []), form = forms.find((entry) => entry.id === context.slice(5));
      if (!form || form.closed || (form.closesAt && Date.parse(form.closesAt) <= Date.now()) || !questionnaireAudience(form, user, rooms)) throw error("Form is not accepting files from this account", 403);
      return { schoolContext: context, releaseRoom: "", private: true, schoolReaders: [form.createdBy] };
    }
    throw error("Unknown upload context");
  }
  return { handle, snapshot, uploadAccess };
};
