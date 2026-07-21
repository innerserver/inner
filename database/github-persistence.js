const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureFile(name, fallback) {
  const file = path.join(DATA_DIR, name);

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
  }
}

ensureDataDir();

ensureFile('users.json', [
  {
    username: 'admin',
    role: 'admin',
    allowPersistentLogin: true
  }
]);

ensureFile('rooms.json', [
  {
    id: 'main',
    name: 'Main'
  }
]);

ensureFile('messages.json', []);
ensureFile('dms.json', []);
ensureFile('files.json', []);
ensureFile('settings.json', {
  serverEnabled: true,
  roomName: 'Inner',
  featureLocks: {}
});

console.log('[github-persistence] local persistence ready');


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
