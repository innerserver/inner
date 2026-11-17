import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('function currentAppearanceDraft('),source.indexOf('function normalizeThemeName('));
function setup(){
 const state={loggedIn:true,user:{username:'alice'},csrfToken:'session-a',settings:{customizations:{}},profiles:{alice:{theme:'dark',visualStyle:'forest',themeImageUrl:'data:image/png;base64,cGhvdG8='}}};
 const props=new Map(),body={dataset:{}},els={profileTheme:{value:'glass'},profileVisualStyle:{value:'ocean'},profileThemeImageUrl:{value:state.profiles.alice.themeImageUrl}};
 const context=vm.createContext({state,els,document:{body,documentElement:{style:{setProperty:(k,v)=>props.set(k,v),removeProperty:k=>props.delete(k)}}},currentProfileThemeEditor:()=>({bg:'#111111',surface:'#222222',ink:'#ffffff',accent:'#88ccaa'}),cssUrl:value=>String(value||''),normalizeVisualStyle:value=>value,normalizeThemeName:value=>value||'',applyCustomThemeVariables(){},syncThemeContrast(){}});
 vm.runInContext(helpers,context);return{state,els,body,props,context};
}
test('switching to Glass retains the personal photo and appearance draft on subsequent previews',()=>{
 const f=setup();f.context.captureAppearanceDraft();f.context.applyProfileTheme('glass');f.context.applyProfileTheme();
 assert.equal(f.body.dataset.theme,'glass');assert.equal(f.body.dataset.themeImage,'true');assert.equal(f.body.dataset.visualStyle,'ocean');
 assert.match(f.props.get('--account-theme-image'),/cGhvdG8=/);
});
test('removing a saved photo uses an explicit empty draft instead of restoring the saved URL',()=>{
 const f=setup();f.els.profileThemeImageUrl.value='';f.context.captureAppearanceDraft();f.context.applyProfileTheme();
 assert.equal(f.body.dataset.themeImage,undefined);assert.equal(f.props.has('--account-theme-image'),false);assert.equal(f.body.dataset.theme,'glass');
});
test('a global Glass palette keeps a member photo without replacing that palette',()=>{
 const f=setup();f.state.settings.customizations={globalTheme:'glass',globalVisualStyle:'forest'};f.context.applyProfileTheme();
 assert.equal(f.body.dataset.theme,'glass');assert.equal(f.body.dataset.themeImage,'true');assert.equal(f.body.dataset.visualStyle,'forest');
});
test('logout and account changes cannot reuse the previous account photo draft',()=>{
 const f=setup();f.context.captureAppearanceDraft();f.state.loggedIn=false;f.context.applyProfileTheme('system');
 assert.equal(f.body.dataset.themeImage,undefined);f.state.loggedIn=true;f.state.user={username:'bob'};f.state.csrfToken='session-b';f.context.applyProfileTheme();assert.equal(f.body.dataset.themeImage,undefined);assert.equal(f.context.currentAppearanceDraft(),null);
});

test('photo-generated custom colours remain in the account-scoped appearance draft',()=>{
 const f=setup();f.els.profileTheme.value='custom';f.context.captureAppearanceDraft();
 assert.equal(f.context.currentAppearanceDraft().customTheme.accent,'#88ccaa');
 f.context.applyProfileTheme();assert.equal(f.body.dataset.theme,'custom');
});

test('restoring a saved custom palette ignores stale colour inputs until a new draft exists',()=>{
 const f=setup();let applied;f.context.applyCustomThemeVariables=value=>{applied=value;};
 f.state.profiles.alice.theme='custom';f.state.profiles.alice.customTheme={bg:'#001122',surface:'#112233',ink:'#ffffff',accent:'#88aaff'};
 f.els.profileTheme.value='custom';f.els.profileThemeBg={value:'#ffffff'};
 f.context.applyProfileTheme();assert.equal(applied.accent,'#88aaff');
});
