import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../public/passkeys.js', import.meta.url), 'utf8');
const manager = source.slice(source.indexOf('  const loginForm ='), source.indexOf('  async function registerPasskey('));
const action = source.slice(source.indexOf('  async function action('), source.indexOf('  async function refresh('));
const manual = source.slice(source.indexOf('  login.onclick ='), source.indexOf('  add.onclick ='));
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup({ available=true, supported=true, platform=false }={}) {
  const elements = new Map(), calls=[], gets=[], timers=[];
  const classes = (...names) => { const set=new Set(names);return {contains:name=>set.has(name),add:name=>set.add(name),remove:name=>set.delete(name)}; };
  const submit={disabled:false},login={disabled:false};
  for (const id of ['loginForm','loginView','loginError','passkeyLoginHint','loginUsername','passwordResetRequestForm','passwordResetCompleteForm']) elements.set(id,{classList:classes(...(id.startsWith('passwordReset')?['hidden']:[])),textContent:'',querySelector:()=>submit});
  const state={loggedIn:false},document={hidden:false},els={loginPassword:{value:'old password'}};
  const context=vm.createContext({supported,state,document,els,login,busy:false,password:{value:''},status:{textContent:''},AbortController,byId:id=>elements.get(id),
    PublicKeyCredential:{isConditionalMediationAvailable:async()=>available,isUserVerifyingPlatformAuthenticatorAvailable:async()=>platform},
    decode:value=>new Uint8Array(Buffer.from(value,'base64url')),serialize:credential=>({id:credential.id}),errorText:error=>error.message,
    api:async(route,options)=>{calls.push({route,options});return route.endsWith('/options')?{challenge:'AQ',allowCredentials:[{id:'Ag'}],userVerification:'required'}:{};},
    navigator:{credentials:{get:options=>new Promise((resolve,reject)=>{gets.push({options,resolve,reject});options.signal?.addEventListener('abort',()=>reject(Object.assign(new Error('Cancelled'),{name:'AbortError'})),{once:true});})}},
    showApp:()=>{state.loggedIn=true;elements.get('loginView').classList.add('hidden');},showLogin:()=>{},loadState:async()=>{},
    setTimeout:(fn,ms)=>{const item={fn,ms};timers.push(item);return item;},clearTimeout:timer=>{if(timer)timer.cleared=true;},
  });
  vm.runInContext(manager+action+manual,context);
  return {context,elements,calls,gets,timers,state,document,submit,login,els};
}
test('autofill starts one conditional discoverable-credential request without blocking passwords',async()=>{
  const f=setup();const task=f.context.startAutofill();f.context.startAutofill();await tick();
  assert.equal(f.gets.length,1);assert.equal(f.gets[0].options.mediation,'conditional');assert.equal(f.gets[0].options.publicKey.allowCredentials.length,0);
  assert.equal(f.gets[0].options.publicKey.userVerification,'required');assert.equal(f.submit.disabled,false);assert.equal(f.login.disabled,false);
  assert.equal(f.timers[0].ms,240000);
  await f.context.stopAutofill();await task;
  assert.equal(f.elements.get('loginError').textContent,'');
});
test('selecting a saved passkey verifies and enters the workspace',async()=>{
  const f=setup();const task=f.context.startAutofill();await tick();f.gets[0].resolve({id:'saved-passkey'});await task;
  assert.equal(f.calls.filter(call=>call.route.endsWith('/verify')).length,1);assert.equal(f.state.loggedIn,true);assert.equal(f.els.loginPassword.value,'');assert.equal(f.submit.disabled,false);
});
test('password sign-in aborts autofill and resumes it only after a failed password attempt',async()=>{
  const f=setup();f.context.startAutofill();await tick();
  assert.equal(await f.context.beginPasswordLogin(),true);assert.equal(f.gets[0].options.signal.aborted,true);
  assert.equal(await f.context.beginPasswordLogin(),false);f.context.startAutofill();await tick();assert.equal(f.gets.length,1);
  f.context.endPasswordLogin();await tick();assert.equal(f.gets.length,2);await f.context.stopAutofill();
});
test('unsupported browsers and cancellation leave password sign-in quiet and available',async()=>{
  for (const available of [false,true]) {
    const f=setup({available});const task=f.context.startAutofill();await tick();
    if(available)f.gets[0].reject(Object.assign(new Error('No passkey selected'),{name:'NotAllowedError'}));await task;
    assert.equal(f.elements.get('loginError').textContent,'');assert.equal(f.submit.disabled,false);
    if(!available)assert.equal(f.calls.length,0);
  }
});
test('challenge renewal aborts the previous request before starting a fresh one',async()=>{
  const f=setup();f.context.startAutofill();await tick();f.timers[0].fn();await tick();await tick();
  assert.equal(f.gets[0].options.signal.aborted,true);assert.equal(f.gets.length,2);await f.context.stopAutofill();
});
test('hidden login/reset screens do not request passkeys and a late selection cannot sign in',async()=>{
  const f=setup();f.elements.get('passwordResetRequestForm').classList.remove('hidden');await f.context.startAutofill();assert.equal(f.calls.length,0);
  f.elements.get('passwordResetRequestForm').classList.add('hidden');const task=f.context.startAutofill();await tick();
  f.elements.get('loginView').classList.add('hidden');f.gets[0].resolve({id:'late'});await task;
  assert.equal(f.calls.some(call=>call.route.endsWith('/verify')),false);
});

test('the explicit passkey button cancels pending autofill before starting its normal prompt',async()=>{
  const f=setup();f.context.startAutofill();await tick();
  const task=f.login.onclick();await tick();assert.equal(f.gets[0].options.signal.aborted,true);assert.equal(f.gets.length,2);
  assert.equal(f.gets[1].options.mediation,undefined);f.gets[1].resolve({id:'explicit-key'});await task;assert.equal(f.state.loggedIn,true);
});

test('the explicit passkey button cannot race an active password submission',async()=>{
  const f=setup();assert.equal(await f.context.beginPasswordLogin(),true);await f.login.onclick();assert.equal(f.calls.length,0);
});

test('the device prompt waits for confirmed sign-out and replaces pending autofill',async()=>{
  const f=setup({platform:true});f.context.startAutofill();await tick();
  assert.equal(f.gets[0].options.mediation,'conditional');
  f.context.offerLogin();await tick();await tick();
  assert.equal(f.gets[0].options.signal.aborted,true);assert.equal(f.gets.length,2);
  assert.equal(f.gets[1].options.mediation,'optional');
  assert.equal(f.gets[1].options.publicKey.hints[0],'client-device');
  assert.equal(f.gets[1].options.publicKey.userVerification,'required');
  f.gets[1].resolve({id:'device-passkey'});await tick();
  assert.equal(f.state.loggedIn,true);assert.equal(f.calls.filter(call=>call.route.endsWith('/verify')).length,1);
});

test('dismissed automatic prompt falls back to autofill and never repeatedly prompts',async()=>{
  const f=setup({platform:true});f.context.offerLogin();await tick();
  assert.equal(f.gets[0].options.mediation,'optional');
  f.gets[0].reject(Object.assign(new Error('Dismissed'),{name:'NotAllowedError'}));await tick();await tick();
  assert.equal(f.gets.length,2);assert.equal(f.gets[1].options.mediation,'conditional');
  f.context.offerLogin();await tick();assert.equal(f.gets.length,2);
  assert.equal(f.elements.get('loginError').textContent,'');assert.equal(f.submit.disabled,false);
  await f.context.stopAutofill();
});

test('explicit logout suppresses an automatic prompt, while keeping quiet autofill',async()=>{
  const f=setup({platform:true});f.context.offerLogin({automatic:false});await tick();
  assert.equal(f.gets.length,1);assert.equal(f.gets[0].options.mediation,'conditional');
  f.context.offerLogin();await tick();assert.equal(f.gets.length,1);await f.context.stopAutofill();
});

test('password submission cancels the automatic prompt before posting a password',async()=>{
  const f=setup({platform:true});f.context.offerLogin();await tick();
  assert.equal(await f.context.beginPasswordLogin(),true);assert.equal(f.gets[0].options.signal.aborted,true);
  f.context.endPasswordLogin();await tick();assert.equal(f.gets[1].options.mediation,'conditional');await f.context.stopAutofill();
});
