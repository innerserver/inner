import assert from 'node:assert/strict';
import {test,before,after,beforeEach} from 'node:test';
import {readFile,writeFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {once} from 'node:events';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(path.join(root,'server.js'));
const {monthLater}=require('./lib/grade-progression');
const directory=await mkdtemp(path.join(tmpdir(),'connectifi-grades-'));
let clock=Date.parse('2026-11-16T10:00:00Z');
class ClockDate extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
const source=await readFile(path.join(root,'server.js'),'utf8');
const context=vm.createContext({require,__dirname:root,Buffer,URL,Date:ClockDate,AbortSignal,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,console,fetch,process:{env:{INNER_LOCALHOST_MODE:'true',INNER_DATA_DIR:directory},pid:process.pid}});
vm.runInContext(source.slice(0,source.lastIndexOf('main().catch('))+';globalThis.app={route,createInnerServer,sessions,FILES,websocketServer,getGradeProgression,writeJson};',context);
const app=context.app;let server,origin,users;
const tokens={admin2:'admin2',teacher:'teacher',student0:'student0',graduate:'graduate'};
before(async()=>{await mkdir(path.join(directory,'backups'));await mkdir(path.join(directory,'uploads'));server=app.createInnerServer((req,res)=>app.route(req,res).catch(error=>{if(!res.headersSent){res.writeHead(error.statusCode||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}}));server.listen(0,'127.0.0.1');await once(server,'listening');origin=`http://127.0.0.1:${server.address().port}`;});
beforeEach(async()=>{
 clock=Date.parse('2026-11-16T10:00:00Z');app.sessions.clear();
 users=[{username:'admin2',role:'admin',grade:'12A'}, {username:'teacher',role:'moderator',grade:'8A'}, ...Array.from({length:8},(_,i)=>({username:`student${i}`,role:'member',parentEmails:['parent@example.test'],grade:`8${'ABC'[i%3]}`,passwordHash:'test-hash'})),{username:'older',role:'member',parentEmails:['parent@example.test'],grade:'9B',passwordHash:'test-hash'},{username:'nextsenior',role:'member',parentEmails:['parent@example.test'],grade:'11C',passwordHash:'test-hash'},{username:'graduate',role:'member',parentEmails:['parent@example.test'],grade:'12A',passwordHash:'test-hash'}];
 const fixtures={users,gradeProgression:{plans:[],deleted:[]},settings:{serverEnabled:true},rooms:[{id:'main',name:'Main'},{id:'private9',name:'Private group',private:true,allowedUsers:['older']}],profiles:{graduate:{displayName:'Graduate'}},passkeys:[{username:'graduate',id:'old-credential'}],passkeyPreferences:{graduate:{disabled:true}},friends:{requests:[{from:'graduate',to:'student0'}],friendships:[{users:['graduate','student0']}]},userPins:{graduate:{}},accountRequests:[],messages:[{id:'public',roomId:'main',user:'older',text:'Public history'},{id:'secret',roomId:'private9',user:'older',text:'Hidden'}],dms:[{id:'mine',participants:['graduate','student0'],from:'graduate',text:'My DM'},{id:'other',participants:['student0','older'],text:'Other DM'}]};
 for(const[key,value]of Object.entries(fixtures))await writeFile(app.FILES[key],JSON.stringify(value));
 for(const [name,token]of Object.entries(tokens)){const user=users.find(entry=>entry.username===name);app.sessions.set(token,{...user,csrfToken:'test-csrf',expiresAt:clock+1e10});}
});
after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));app.websocketServer.close();await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});});
async function call(name,url,body,extra={}){const res=await fetch(origin+url,{method:body===undefined?'GET':'POST',headers:{Origin:origin,Cookie:`server_app_session=${tokens[name]}`,'X-CSRF-Token':'test-csrf','Content-Type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body)});return{status:res.status,data:await res.json()};}
const preview=async(scope='all')=>call('admin2','/api/admin/grade-progression/preview',{cycle:'2026-2027',scope});
const approve=async(id)=>call('admin2','/api/admin/grade-progression/approve',{id});
test('normal admin previews balanced A/B/C rosters without modifying accounts',async()=>{
 assert.equal((await call('teacher','/api/admin/grade-progression')).status,403);
 assert.equal((await call('student0','/api/admin/grade-progression/preview',{cycle:'2026-2027'})).status,403);
 const result=await preview();assert.equal(result.status,201);const moves=result.data.plan.moves;
 assert.equal(moves.length,11);assert.equal(moves.some(move=>move.username==='admin2'||move.username==='teacher'),false);
 const eight=moves.filter(move=>move.from.startsWith('8'));const sizes=Array.from('ABC',letter=>eight.filter(move=>move.to===`9${letter}`).length);assert.ok(Math.max(...sizes)-Math.min(...sizes)<=3);
 assert.equal(JSON.parse(await readFile(app.FILES.users)).find(user=>user.username==='student0').grade,'8A');
 assert.equal((await call('admin2','/api/admin/grade-progression/approve',{id:result.data.plan.id},{'X-CSRF-Token':'bad'})).status,403);
});
test('approval moves each original grade once, updates rooms and schedules only original Grade 12',async()=>{
 const plan=(await preview()).data.plan;assert.equal((await approve(plan.id)).status,200);
 const saved=JSON.parse(await readFile(app.FILES.users));
 assert.equal(saved.find(user=>user.username==='student0').grade.startsWith('9'),true);
 assert.equal(saved.find(user=>user.username==='older').grade,'10A');
 assert.equal(saved.find(user=>user.username==='nextsenior').grade,'12A');assert.equal(saved.find(user=>user.username==='nextsenior').graduation,undefined);
 assert.equal(saved.find(user=>user.username==='graduate').graduation.deleteAfter,'2026-12-16T10:00:00.000Z');
 assert.equal((await call('graduate','/api/state?fast=1')).data.user.graduation.deleteAfter,'2026-12-16T10:00:00.000Z');
 assert.equal(saved.find(user=>user.username==='admin2').grade,'12A');
 assert.equal(app.sessions.get(tokens.student0).grade.startsWith('9'),true);
 const rooms=JSON.parse(await readFile(app.FILES.rooms));assert.equal(rooms.find(room=>room.name==='Grade 9').allowedUsers.includes('student0'),true);
 assert.equal((await approve(plan.id)).data.alreadyApplied,true);assert.equal((await preview()).status,400);
});
test('changed or expired previews cannot apply a stale roster',async()=>{
 let plan=(await preview('8')).data.plan;users.push({username:'newstudent',role:'member',parentEmails:['parent@example.test'],grade:'8B'});await writeFile(app.FILES.users,JSON.stringify(users));assert.equal((await approve(plan.id)).status,409);
 plan=(await preview('8')).data.plan;clock+=31*60*1000;assert.equal((await approve(plan.id)).status,409);
});
test('chat export includes only accessible messages and participating DMs',async()=>{
 const result=await call('graduate','/api/chats/export');assert.equal(result.status,200);
 assert.deepEqual(result.data.messages.map(message=>message.id),['public']);assert.deepEqual(result.data.dms.map(dm=>dm.id),['mine']);
 assert.equal(result.data.messages[0].sourceIp,undefined);
});

test('graduate export includes current groups and personal DMs across grades, excluding other or former groups',async()=>{
 const groups=[{id:'joined',name:'My group',participants:['graduate','student0']},{id:'other-group',name:'Another grade group',participants:['student0','older']}];
 await writeFile(app.FILES.dmGroups,JSON.stringify(groups));
 await writeFile(app.FILES.rooms,JSON.stringify([{id:'my-room',name:'Joined room',private:true,allowedUsers:['graduate']},{id:'grade-8',name:'Grade 8',classGrade:'8',private:true,allowedUsers:['student0']} ]));
 await writeFile(app.FILES.messages,JSON.stringify([{id:'shared',roomId:'my-room',user:'student0',text:'Room history'}, {id:'wrong-grade',roomId:'grade-8',user:'student0',text:'Grade 8 private history'}]));
 await writeFile(app.FILES.dms,JSON.stringify([
  {id:'personal',participants:['graduate','student0'],text:'Across grades'},
  {id:'joined-message',groupId:'joined',participants:['graduate','student0'],text:'My group message'},
  {id:'former-message',groupId:'other-group',participants:['graduate','student0'],text:'Old membership'},
  {id:'missing-group-message',groupId:'removed-group',participants:['graduate','student0'],text:'Removed group'},
  {id:'malformed-group-message',kind:'group',participants:['graduate','student0'],text:'Missing group ID'},
  {id:'not-my-message',groupId:'joined',participants:['student0','older'],text:'Not my history'},
 ]));
 const plan=(await preview('12')).data.plan;assert.equal((await approve(plan.id)).status,200);
 const result=await call('graduate','/api/chats/export');assert.equal(result.status,200);
 assert.deepEqual(result.data.dmGroups.map(group=>group.id),['joined']);
 assert.deepEqual(result.data.messages.map(message=>message.id),['shared']);
 assert.deepEqual(result.data.dms.map(dm=>dm.id),['personal','joined-message']);
});

test('grade promotion preserves personal and group conversations while updating class membership',async()=>{
 const groups=[{id:'friends',name:'Friends',participants:['student0','older']}];
 const dms=[{id:'personal',participants:['student0','older'],text:'Personal history'},{id:'group-message',groupId:'friends',participants:['student0','older'],text:'Group history'}];
 await writeFile(app.FILES.dmGroups,JSON.stringify(groups));await writeFile(app.FILES.dms,JSON.stringify(dms));
 const plan=(await preview('8')).data.plan;assert.equal((await approve(plan.id)).status,200);
 assert.deepEqual(JSON.parse(await readFile(app.FILES.dmGroups)),groups);assert.deepEqual(JSON.parse(await readFile(app.FILES.dms)),dms);
 const exported=(await call('student0','/api/chats/export')).data;
 assert.deepEqual(exported.dms.map(dm=>dm.id),['personal','group-message']);
});

test('shared room synchronization retains section privacy across startup, login and promotion',async()=>{
 const rooms=[{id:'main',name:'Main'},{id:'section-a',name:'Class 8A',classGrade:'8A',private:true,allowedUsers:['student1']},{id:'section-b',name:'Class 8B',classGrade:'8B',private:true,allowedUsers:['student0']}];
 await writeFile(app.FILES.rooms,JSON.stringify(rooms));await vm.runInContext('ensureRooms()',context);
 let saved=JSON.parse(await readFile(app.FILES.rooms));
 assert.deepEqual(saved.find(room=>room.id==='section-a').allowedUsers,['student0','student3','student6']);
 assert.deepEqual(saved.find(room=>room.id==='section-b').allowedUsers,['student1','student4','student7']);
 context.classStudent=users.find(user=>user.username==='student0');await vm.runInContext('syncClassRoom(classStudent)',context);
 assert.deepEqual(JSON.parse(await readFile(app.FILES.rooms)),saved);
 const plan=(await preview('8')).data.plan;assert.equal((await approve(plan.id)).status,200);
 saved=JSON.parse(await readFile(app.FILES.rooms));assert.deepEqual(saved.find(room=>room.id==='section-a').allowedUsers,[]);
 assert.equal(saved.find(room=>room.id==='grade-9').allowedUsers.includes('student0'),true);
});
test('one-month deadline blocks access and deletes credentials, including stale-write resurrection',async()=>{
 const original=structuredClone(users),plan=(await preview('12')).data.plan;await approve(plan.id);
 clock=Date.parse('2026-12-16T10:00:01Z');assert.equal((await call('graduate','/api/chats/export')).status,401);
 await app.getGradeProgression().sweep();assert.equal(JSON.parse(await readFile(app.FILES.users)).some(user=>user.username==='graduate'),false);
 assert.equal(JSON.parse(await readFile(app.FILES.passkeys)).some(key=>key.username==='graduate'),false);
 assert.equal(JSON.parse(await readFile(app.FILES.profiles)).graduate,undefined);
 await app.writeJson(app.FILES.users,original);assert.equal(JSON.parse(await readFile(app.FILES.users)).some(user=>user.username==='graduate'),false);
 assert.equal(JSON.parse(await readFile(app.FILES.messages)).length,2);
});
test('stale account writes cannot undo an approved grade change',async()=>{
 const original=structuredClone(users),plan=(await preview('8')).data.plan;await approve(plan.id);await app.writeJson(app.FILES.users,original);
 assert.equal(JSON.parse(await readFile(app.FILES.users)).find(user=>user.username==='student0').grade.startsWith('9'),true);
});
test('month calculations clamp month ends, including leap years',()=>{
 assert.equal(monthLater(Date.parse('2027-01-31T10:00:00Z')),'2027-02-28T10:00:00.000Z');assert.equal(monthLater(Date.parse('2028-01-31T10:00:00Z')),'2028-02-29T10:00:00.000Z');
});
test('an interrupted approval recovers on the next sweep without promoting twice',async()=>{
 const plan=(await preview('8')).data.plan;
 vm.runInContext("globalThis.gradeOriginalWrite=writeJsonNow; writeJsonNow=async(file,value)=>{if(file===FILES.rooms){writeJsonNow=gradeOriginalWrite;throw new Error('Simulated room write interruption');}return gradeOriginalWrite(file,value);};",context);
 assert.equal((await approve(plan.id)).status,500);
 assert.equal(JSON.parse(await readFile(app.FILES.gradeProgression)).plans[0].status,'applying');
 await app.getGradeProgression().sweep();
 assert.equal(JSON.parse(await readFile(app.FILES.gradeProgression)).plans[0].status,'applied');
 assert.equal(JSON.parse(await readFile(app.FILES.users)).find(user=>user.username==='student0').grade.startsWith('9'),true);
 assert.equal((await approve(plan.id)).data.alreadyApplied,true);
});
test('late students can join a grade and promote into the smallest existing destination classes',async()=>{
 const first=(await preview('8')).data.plan;assert.equal((await approve(first.id)).status,200);
 const saved=JSON.parse(await readFile(app.FILES.users)),placements=new Map(saved.map(user=>[user.username,user.grade]));
 const newcomers=[{username:'lateone',role:'member',parentEmails:['parent@example.test'],grade:'8A',passwordHash:'new-one'},{username:'latetwo',role:'member',parentEmails:['parent@example.test'],grade:'8C',passwordHash:'new-two'}];
 await app.writeJson(app.FILES.users,saved.concat(newcomers));
 context.lateStudent=newcomers[0];await vm.runInContext('syncClassRoom(lateStudent)',context);
 assert.ok(JSON.parse(await readFile(app.FILES.rooms)).find(room=>room.name==='Grade 8').allowedUsers.includes('lateone'));
 const next=(await preview('8')).data.plan;
 assert.deepEqual(next.moves.map(move=>move.username).sort(),['lateone','latetwo']);
 const counts=Object.values(next.destinationCounts[0].after);assert.equal(counts.reduce((sum,count)=>sum+count,0),11);assert.ok(Math.max(...counts)-Math.min(...counts)<=3);
 assert.equal((await approve(next.id)).status,200);
 const final=JSON.parse(await readFile(app.FILES.users));
 for(const [name,grade]of placements)assert.equal(final.find(user=>user.username===name).grade,grade);
 for(const name of ['lateone','latetwo'])assert.ok(final.find(user=>user.username===name).grade.startsWith('9'));
});
test('a new destination-grade student invalidates an older balancing preview',async()=>{
 const plan=(await preview('8')).data.plan;
 const saved=JSON.parse(await readFile(app.FILES.users));saved.push({username:'newdestination',role:'member',parentEmails:['parent@example.test'],grade:'9A',passwordHash:'new-destination'});await app.writeJson(app.FILES.users,saved);
 assert.equal((await approve(plan.id)).status,409);
});
