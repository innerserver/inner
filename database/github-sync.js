const fs=require('fs');
const path=require('path');
const https=require('https');
const TOKEN=process.env.GITHUB_TOKEN||'';
const REPO=process.env.GITHUB_REPO||'devshah20-coder/inner';
const BRANCH=process.env.GITHUB_BRANCH||'main';
if(!TOKEN){console.log('[github-sync] disabled (missing token)');return;}
const DATA_DIR=path.join(process.cwd(),'data');
const TRACKED_FILES=['users.json','rooms.json','messages.json','dms.json','files.json','settings.json'];
function githubRequest(method,apiPath,body){return new Promise((resolve,reject)=>{const request=https.request({hostname:'api.github.com',path:apiPath,method,headers:{'User-Agent':'inner-sync','Authorization':'token '+TOKEN,'Accept':'application/vnd.github+json','Content-Type':'application/json'}},(response)=>{let data='';response.on('data',(chunk)=>data+=chunk);response.on('end',()=>{try{resolve(JSON.parse(data||'{}'));}catch(error){reject(error);}});});request.on('error',reject);if(body)request.write(JSON.stringify(body));request.end();});}
async function restoreFile(fileName){try{const result=await githubRequest('GET',`/repos/${REPO}/contents/data/${fileName}?ref=${BRANCH}`);if(!result.content)return;const decoded=Buffer.from(result.content,'base64').toString('utf8');fs.writeFileSync(path.join(DATA_DIR,fileName),decoded);console.log(`[github-sync] restored ${fileName}`);}catch{console.log(`[github-sync] restore skipped ${fileName}`);}}
async function uploadFile(fileName){try{const filePath=path.join(DATA_DIR,fileName);if(!fs.existsSync(filePath))return;const content=fs.readFileSync(filePath,'utf8');const encoded=Buffer.from(content).toString('base64');let sha;try{const existing=await githubRequest('GET',`/repos/${REPO}/contents/data/${fileName}?ref=${BRANCH}`);sha=existing.sha;}catch{}await githubRequest('PUT',`/repos/${REPO}/contents/data/${fileName}`,{message:`Auto sync ${fileName}`,content:encoded,branch:BRANCH,sha});console.log(`[github-sync] synced ${fileName}`);}catch(error){console.error('[github-sync] upload failed',error.message);}}
function watchFile(fileName){const filePath=path.join(DATA_DIR,fileName);let timeout=null;fs.watchFile(filePath,{interval:3000},()=>{clearTimeout(timeout);timeout=setTimeout(()=>uploadFile(fileName),2000);});}
(async()=>{for(const file of TRACKED_FILES){await restoreFile(file);}TRACKED_FILES.forEach(watchFile);console.log('[github-sync] active');})();

document.addEventListener("DOMContentLoaded",()=>{
 const u=localStorage.getItem("username")||"guest";
 const r=localStorage.getItem("role")||"user";
 const admin=(u==="devshah"||r==="admin");

 document.querySelectorAll("[data-feature='admin'],#adminBtn,.admin-btn,.admin-nav,.admin-panel").forEach(el=>{
   if(!admin){
      el.remove();
   }
 });

});
