import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {buildPtmSchedule}=require('../lib/ptm');
const createSchool=require('../lib/school');
const at=(time,day='2050-01-10')=>`${day}T${time}:00.000Z`;
const draft=(extra={})=>({teacher:'teacher',subject:'Mathematics',grade:'8',title:'January PTM',slotMinutes:10,timeZone:'UTC',days:[{startsAt:at('09:00'),endsAt:at('10:00'),breaks:[{startsAt:at('09:20'),endsAt:at('09:35')}]}],...extra});
function setup(){
 const users=[{username:'admin',role:'admin'},{username:'teacher',role:'moderator'},{username:'teacher2',role:'moderator'},{username:'alice',role:'member',grade:'8A'},{username:'bob',role:'member',grade:'8B'},{username:'cara',role:'member',grade:'9A'}];
 const store={users,rooms:[],announcements:[],school:{}};
 const school=createSchool({FILES:Object.fromEntries(Object.keys(store).map(key=>[key,key])),readJson:async(key,fallback)=>structuredClone(store[key]??fallback),writeJson:async(key,data)=>{store[key]=structuredClone(data);},canManage:user=>user.role==='admin',canModerate:user=>['admin','moderator'].includes(user.role),canAccessRoom:()=>false,readJsonBody:async req=>req.body,json:(_res,status,data)=>({status,data}),broadcast(){}});
 const call=async(username,route,body)=>{try{return await school.handle({method:body===undefined?'GET':'POST',body},{},users.find(user=>user.username===username),new URL(route,'http://local'));}catch(error){return {status:error.statusCode||500,data:{error:error.message}};}};
 return {store,school,call};
}
test('generation excludes breaks, restarts after each break and drops partial slots',()=>{
 const {schedule,slots}=buildPtmSchedule(draft(),0);
 assert.equal(schedule.grade,'8');assert.equal(slots.length,4);
 assert.deepEqual(slots.map(slot=>slot.startsAt),['09:00','09:10','09:35','09:45'].map(time=>at(time)));
 assert.equal(slots.at(-1).endsAt,at('09:55'));
});
test('multiple dates retain per-day availability and time zone',()=>{
 const day2={startsAt:at('11:00','2050-01-11'),endsAt:at('12:00','2050-01-11'),breaks:[]};
 const result=buildPtmSchedule(draft({days:[...draft().days,day2]}),0);assert.equal(result.slots.length,10);assert.equal(result.schedule.days.length,2);
 const india=buildPtmSchedule(draft({timeZone:'Asia/Kolkata'}),0);assert.equal(india.schedule.timeZone,'Asia/Kolkata');
});
test('invalid windows, duplicate days, breaks, empty slots and excessive schedules fail',()=>{
 const bad=[{slotMinutes:0},{slotMinutes:2.5},{grade:'college'},{subject:''},{timeZone:'not/a-zone'},{days:[]},{days:[...draft().days,...draft().days]},{days:[{startsAt:at('09:00'),endsAt:at('08:00')}]},{days:[{startsAt:at('09:00'),endsAt:at('10:00'),breaks:[{startsAt:at('08:00'),endsAt:at('09:15')}]}]},{days:[{startsAt:at('09:00'),endsAt:at('10:00'),breaks:[{startsAt:at('09:10'),endsAt:at('09:30')},{startsAt:at('09:20'),endsAt:at('09:40')}]}]},{slotMinutes:120}];
 for(const extra of bad)assert.throws(()=>buildPtmSchedule(draft(extra),0),{statusCode:400});
 assert.throws(()=>buildPtmSchedule(draft(),Date.parse('2051-01-01')),{statusCode:400});
 const days=Array.from({length:4},(_,index)=>({startsAt:at('01:00',`2050-01-${10+index}`),endsAt:at('18:00',`2050-01-${10+index}`)}));
 assert.throws(()=>buildPtmSchedule(draft({slotMinutes:5,days}),0),/250 slots/);
});
test('PTMs are admin-created, grade-wide across classes and private outside that grade',async()=>{
 const f=setup();assert.equal((await f.call('teacher','/api/school/ptm',draft())).status,403);
 assert.equal((await f.call('admin','/api/school/ptm',draft())).status,200);
 for(const name of ['alice','bob','teacher','admin']){const result=await f.call(name,'/api/school');assert.equal(result.data.ptmSchedules.length,1);assert.equal(result.data.events.length,4);}
 const other=await f.call('cara','/api/school');assert.equal(other.data.events.length,0);assert.equal(other.data.ptmSchedules.length,0);assert.deepEqual(other.data.ptmStudents,[]);
 const member=await f.call('alice','/api/school');assert.equal(member.data.events[0].bookings,undefined);
});
test('racing bookings have one winner, enforce one teacher slot per student and record class',async()=>{
 const f=setup();await f.call('admin','/api/school/ptm',draft());
 const [slot,next]=f.store.school.events;
 assert.equal((await f.call('cara',`/api/school/events/${slot.id}/book`,{})).status,404);
 assert.equal((await f.call('alice',`/api/school/events/${slot.id}/book`,{username:'bob'})).status,403);
 const results=await Promise.all(['alice','bob'].map(name=>f.call(name,`/api/school/events/${slot.id}/book`,{})));assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);
 const winner=f.store.school.bookings[0].username;
 assert.equal(f.store.school.bookings[0].grade,winner==='alice'?'8A':'8B');
 assert.equal((await f.call(winner,`/api/school/events/${next.id}/book`,{})).status,409);
 assert.equal((await f.call(winner,`/api/school/events/${slot.id}/cancel-booking`,{})).status,200);
 assert.equal((await f.call(winner,`/api/school/events/${next.id}/book`,{})).status,200);
});
test('admins book for students, teacher and student conflicts are blocked, cancellation releases slots',async()=>{
 const f=setup();await f.call('admin','/api/school/ptm',draft());const slot=f.store.school.events[0];
 assert.equal((await f.call('admin',`/api/school/events/${slot.id}/book`,{username:'alice'})).status,200);
 assert.equal((await f.call('admin',`/api/school/events/${slot.id}/book`,{username:'cara'})).status,403);
 assert.equal((await f.call('admin','/api/school/ptm',draft({grade:'9'}))).status,409);
 const legacy={kind:'event',teacher:'teacher',title:'Conflicting event',startsAt:slot.startsAt,endsAt:slot.endsAt,capacity:30};
 assert.equal((await f.call('admin','/api/school/events',legacy)).status,409);
 assert.equal((await f.call('admin','/api/school/ptm',draft({teacher:'teacher2'}))).status,200);
 const second=f.store.school.events.find(entry=>entry.teacher==='teacher2');
 assert.equal((await f.call('alice',`/api/school/events/${second.id}/book`,{})).status,409);
 const teacher=await f.call('teacher','/api/school');assert.equal(teacher.data.events[0].bookings[0].username,'alice');
 const schedule=f.store.school.ptmSchedules.find(entry=>entry.teacher==='teacher');
 assert.equal((await f.call('alice',`/api/school/ptm/${schedule.id}/cancel`,{})).status,403);
 assert.equal((await f.call('admin',`/api/school/ptm/${schedule.id}/cancel`,{})).status,200);
 assert.equal((await f.call('bob',`/api/school/events/${slot.id}/book`,{})).status,409);
 assert.equal((await f.call('alice',`/api/school/events/${second.id}/book`,{})).status,200);
});

test('an admin can cancel an old booking after the student moves grade or leaves',async()=>{
 const f=setup();await f.call('admin','/api/school/ptm',draft());const slot=f.store.school.events[0];
 await f.call('alice',`/api/school/events/${slot.id}/book`,{});
 f.store.users.find(entry=>entry.username==='alice').grade='9A';
 assert.equal((await f.call('admin',`/api/school/events/${slot.id}/cancel-booking`,{username:'alice'})).status,200);
 assert.equal(f.store.school.bookings.length,0);
});
