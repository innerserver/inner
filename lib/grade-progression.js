const crypto = require('node:crypto');
const { gradeYear } = require('../public/grade-utils');
const accountKey = (user) => crypto.createHash('sha256').update(JSON.stringify([user.username, user.passwordHash || '', user.createdAt || ''])).digest('hex');
const student = (user) => user.role === 'member' && !['admin','admin2','hmd','dev'].includes(String(user.username).toLowerCase());
const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
function monthLater(now) {
  const date = new Date(now), day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + 1);
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, end)); return date.toISOString();
}
// Merge approved academic changes into old in-flight account snapshots.
function protectUserWrite(users, journal) {
  const deleted = new Set((journal.deleted || []).map((entry) => entry.key));
  const latest = new Map();
  for (const plan of journal.plans || []) if (['applying','applied'].includes(plan.status)) for (const move of plan.moves) latest.set(move.key, { plan, move });
  return users.filter((user) => !deleted.has(accountKey(user))).map((user) => {
    const item = latest.get(accountKey(user));
    if (!item || user.lastPromotionId === item.plan.id) return user;
    const {plan,move} = item;
    return { ...user, grade: move.to || move.from, lastPromotionId:plan.id, lastPromotionCycle: plan.cycle, lastPromotionAt: plan.approvedAt, gradeUpdatedAt: plan.approvedAt, ...(move.to ? {} : { graduation: { startedAt: plan.approvedAt, deleteAfter: plan.deleteAfter } }) };
  });
}
module.exports = function createGradeProgression(d) {
  let queue = Promise.resolve();
  const serial = (fn) => { const promise = queue.then(fn); queue = promise.catch(() => {}); return promise; };
  const snapshot = (users, cycle, scope) => users.filter((user) => student(user) && !user.graduation && user.lastPromotionCycle !== cycle && /^([6-9]|1[0-2])$/.test(gradeYear(user.grade)) && (scope === 'all' || gradeYear(user.grade) === scope));
  const fingerprint = (users) => crypto.createHash('sha256').update(JSON.stringify(users.map((user) => [accountKey(user), user.grade, user.role]).sort((a,b) => a[0].localeCompare(b[0])))).digest('hex');
  const publicPlan = (plan) => plan && ({ id: plan.id, cycle: plan.cycle, scope: plan.scope, status: plan.status, createdAt: plan.createdAt, approvedAt: plan.approvedAt || '', deleteAfter: plan.deleteAfter || '', moves: plan.moves.map(({username,from,to}) => ({username,from,to})) });
  async function reconcile(plan) {
    const users = await d.users();
    const keys = new Set(plan.moves.map((move) => move.key));
    await d.sync(users.filter((entry) => keys.has(accountKey(entry))));
  }
  async function sweep() { return serial(async () => {
    const journal = await d.journal();
    for (const plan of journal.plans || []) if (plan.status === 'applying') {
      await d.exclusiveUsers(async (users,commit) => commit(protectUserWrite(users, journal)));
      await reconcile(plan); plan.status = 'applied'; await d.writeJournal(journal);
    }
    await d.exclusiveUsers(async (users,commit) => {
    const now = d.now();
    const expired = users.filter((user) => student(user) && user.graduation?.deleteAfter && Date.parse(user.graduation.deleteAfter) <= now);
    const keys = new Set(expired.map(accountKey));
    if (!keys.size && !(journal.deleted || []).some((entry) => !entry.cleaned)) return;
    journal.deleted ||= [];
    for (const user of expired) if (!journal.deleted.some((entry) => entry.key === accountKey(user))) journal.deleted.push({ key: accountKey(user), username: user.username, deletedAt: new Date(now).toISOString(), cleaned: false });
    await d.writeJournal(journal); // Tombstone first so stale account writes cannot restore credentials.
    await commit(users.filter((user) => !keys.has(accountKey(user))));
    for (const entry of journal.deleted.filter((item) => !item.cleaned)) {
      if (users.some((user) => user.username === entry.username && accountKey(user) !== entry.key)) { entry.cleaned = true; continue; }
      d.expire(entry.username); await d.cleanup(entry.username); entry.cleaned = true;
    }
    await d.writeJournal(journal);
    });
  }); }
  async function route(req,res,url,user) {
    if (url.pathname === '/api/chats/export' && req.method === 'GET') {
      const current = (await d.users()).find((entry) => entry.username === user.username);
      if (!current || (current.graduation?.deleteAfter && Date.parse(current.graduation.deleteAfter) <= d.now())) throw error('Your export period has ended.',403);
      const chats = await d.chats(current);
      res.setHeader('Content-Disposition','attachment; filename="connectifi-chats.json"');
      res.setHeader('Cache-Control','no-store'); d.json(res,200,{ exportedAt:new Date(d.now()).toISOString(), username:current.username, ...chats }); return true;
    }
    if (!url.pathname.startsWith('/api/admin/grade-progression')) return false;
    if (!d.admin(user)) throw error('Admin access required.',403);
    res.setHeader('Cache-Control','no-store');
    if (req.method === 'GET' && url.pathname === '/api/admin/grade-progression') {
      const journal = await d.journal(), users = await d.users();
      d.json(res,200,{ plans:(journal.plans || []).map(publicPlan).reverse(), graduates:users.filter((entry) => student(entry) && entry.graduation).map((entry) => ({username:entry.username,...entry.graduation})) }); return true;
    }
    if (req.method !== 'POST') throw error('Grade progression route not found.',404);
    const body = await d.body(req);
    await serial(async () => {
      const journal = await d.journal(); journal.plans ||= [];
      if (url.pathname === '/api/admin/grade-progression/preview') {
        const cycle = String(body.cycle || ''), scope = String(body.scope || 'all');
        const match = cycle.match(/^(20\d{2})-(20\d{2})$/);
        if (!match || Number(match[2]) !== Number(match[1])+1) throw error('Enter an academic year such as 2026-2027.');
        if (!['all','6','7','8','9','10','11','12'].includes(scope)) throw error('Choose Grades 6–12 or one grade.');
        const users = snapshot(await d.users(),cycle,scope), moves = [];
        if (!users.length) throw error('No students are eligible. They may already be promoted for this academic year.');
        for (let year=6;year<=12;year++) {
          const group = users.filter((entry) => gradeYear(entry.grade) === String(year));
          for (let i=group.length-1;i>0;i--) { const j=crypto.randomInt(i+1); [group[i],group[j]]=[group[j],group[i]]; }
          group.forEach((entry,index) => moves.push({ key:accountKey(entry), username:entry.username, from:entry.grade, to:year===12 ? null : `${year+1}${'ABC'[index%3]}` }));
        }
        const now = new Date(d.now()).toISOString();
        const plan={id:crypto.randomUUID(),cycle,scope,createdAt:now,createdBy:user.username,status:'preview',fingerprint:fingerprint(users),moves};
        journal.plans = journal.plans.filter((entry) => entry.status !== 'preview' || entry.createdBy !== user.username); journal.plans.push(plan);
        await d.writeJournal(journal); d.json(res,201,{plan:publicPlan(plan)});
      } else if (url.pathname === '/api/admin/grade-progression/approve') {
        const plan=journal.plans.find((entry)=>entry.id===body.id);
        if (!plan) throw error('Preview not found. Create a new preview.',404);
        if (plan.status === 'applied') { d.json(res,200,{plan:publicPlan(plan),alreadyApplied:true}); return; }
        if (plan.status !== 'preview' || d.now()-Date.parse(plan.createdAt)>30*60*1000) throw error('Preview expired. Create a fresh preview.',409);
        await d.exclusiveUsers(async (users,commit) => {
        if (fingerprint(snapshot(users,plan.cycle,plan.scope))!==plan.fingerprint) throw error('The roster changed. Create a fresh preview before approval.',409);
        await d.backup(user.username);
        plan.status='applying';plan.approvedAt=new Date(d.now()).toISOString();plan.approvedBy=user.username;plan.deleteAfter=monthLater(d.now());
        await d.writeJournal(journal);
        await commit(protectUserWrite(users,journal));
        await reconcile(plan);
        plan.status='applied';await d.writeJournal(journal);
        await d.log('grades.promoted',user.username,{cycle:plan.cycle,count:plan.moves.length,planId:plan.id},req);
        d.json(res,200,{plan:publicPlan(plan)});
        });
      } else throw error('Grade progression route not found.',404);
    });
    return true;
  }
  return {route,sweep};
};
module.exports.protectUserWrite=protectUserWrite;
module.exports.monthLater=monthLater;
