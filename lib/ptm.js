const crypto = require('crypto');
const { gradeYear } = require('../public/grade-utils');
const fail = (message) => { throw Object.assign(new Error(message), { statusCode: 400 }); };
const clean = (value, max) => String(value || '').trim().slice(0, max);
function buildPtmSchedule(body, now = Date.now()) {
  const grade = gradeYear(body.grade), slotMinutes = Number(body.slotMinutes);
  if (!/^(6|7|8|9|10|11|12)$/.test(grade) || !Number.isInteger(slotMinutes) || slotMinutes < 5 || slotMinutes > 120) fail('Choose a grade and a slot length from 5 to 120 minutes');
  const title = clean(body.title, 120), subject = clean(body.subject, 100), timeZone = clean(body.timeZone, 80);
  if (!title || !subject) fail('PTM title and teaching subject required');
  let dayKey;
  try { dayKey = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }); } catch { fail('Choose a valid schedule time zone'); }
  if (!timeZone || !Array.isArray(body.days) || !body.days.length || body.days.length > 30) fail('Choose between 1 and 30 PTM days');
  const instant = (value) => {
    if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/i.test(value) || !Number.isFinite(Date.parse(value))) fail('Each availability and break needs a valid time with a time zone');
    return Date.parse(value);
  };
  const days = [], slots = [], seen = new Set();
  for (const item of body.days) {
    const start = instant(item.startsAt), end = instant(item.endsAt), label = dayKey.format(start);
    if (start <= now || end <= start || end - start > 18 * 3600000 || dayKey.format(end) !== label || seen.has(label)) fail('Choose distinct future days, with availability ending on the same day (maximum 18 hours)');
    seen.add(label);
    if (item.breaks !== undefined && (!Array.isArray(item.breaks) || item.breaks.length > 12)) fail('Maximum 12 breaks per day');
    const breaks = (item.breaks || []).map((entry) => ({ start: instant(entry.startsAt), end: instant(entry.endsAt) })).sort((a, b) => a.start - b.start);
    let cursor = start;
    const addSlots = (until) => {
      while (cursor + slotMinutes * 60000 <= until) {
        slots.push({ startsAt: new Date(cursor).toISOString(), endsAt: new Date(cursor + slotMinutes * 60000).toISOString() });
        cursor += slotMinutes * 60000;
        if (slots.length > 250) fail('Maximum 250 slots per schedule. Use fewer days or longer slots');
      }
    };
    let previousEnd = start;
    for (const pause of breaks) {
      if (pause.start < start || pause.end > end || pause.end <= pause.start || pause.start < previousEnd) fail('Breaks must be inside availability and cannot overlap');
      addSlots(pause.start); cursor = pause.end; previousEnd = pause.end;
    }
    addSlots(end);
    days.push({ startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), breaks: breaks.map((pause) => ({ startsAt: new Date(pause.start).toISOString(), endsAt: new Date(pause.end).toISOString() })) });
  }
  if (!slots.length) fail('No full slots fit. Shorten the slot length or extend availability');
  return { schedule: { id: crypto.randomUUID(), title, subject, grade, teacher: clean(body.teacher, 80), location: clean(body.location, 200), description: clean(body.description, 2000), slotMinutes, timeZone, days, cancelled: false }, slots };
}
module.exports = { buildPtmSchedule };
