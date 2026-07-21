const fs = require("fs");
const path = require("path");

const LOG_DIR = path.join(__dirname, "logs");

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function writeLog(type, message) {
  const file = path.join(LOG_DIR, `${type}.log`);
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(file, line);
}

module.exports = {
  writeLog
};


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
