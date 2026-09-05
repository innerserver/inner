const fs = require('fs');
const path = require('path');

const dataDir = process.env.INNER_DATA_DIR ? path.resolve(process.env.INNER_DATA_DIR) : path.join(process.cwd(), 'data');
const usersFile = path.join(dataDir, 'users.json');
const trackedMaps = [];
const RealMap = global.Map;

global.Map = class TrackedMap extends RealMap {
  constructor(...args) {
    super(...args);
    trackedMaps.push(this);
  }
};

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(usersFile, 'utf8')); }
  catch { return []; }
}

function locked(user) {
  if (!user) return false;
  if (user.banned === true || user.disabled === true) return true;
  if (user.bannedUntil && Date.parse(user.bannedUntil) > Date.now()) return true;
  return false;
}

function cleanup() {
  const names = new Set(loadUsers().filter(locked).map((u) => String(u.username || '').toLowerCase()).filter(Boolean));
  if (!names.size) return;

  for (const map of trackedMaps) {
    for (const [key, value] of map.entries()) {
      const name = String(value?.username || value?.user?.username || value?.session?.username || '').toLowerCase();
      if (!name || !names.has(name)) continue;
      try {
        const s = value.socket || value.ws || value.connection;
        if (s && typeof s.close === 'function') s.close();
      } catch {}
      map.delete(key);
    }
  }
}

setInterval(cleanup, 2000);
console.log('[phase1] session cleanup enabled');


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
