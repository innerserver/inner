function validateSignup(body) {
  const required = [
    "email",
    "phone",
    "displayName"
  ];

  for (const field of required) {
    if (!body[field]) {
      return {
        success: false,
        error: `Missing ${field}`
      };
    }
  }

  return { success: true };
}

module.exports = { validateSignup };


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
