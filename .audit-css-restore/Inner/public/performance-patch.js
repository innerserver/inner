
// FAST UI PATCH
document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("fast-ui");

  // lazy iframe loading
  document.querySelectorAll("iframe").forEach(frame => {
    frame.loading = "lazy";
  });

  // smoother buttons
  document.querySelectorAll("button").forEach(btn => {
    btn.style.transition = "0.15s ease";
  });

  // reduce animation lag
  const style = document.createElement("style");
  style.innerHTML = `
    *{
      scroll-behavior:smooth;
    }
    .fast-ui *{
      animation-duration:.15s !important;
      transition-duration:.15s !important;
    }
  `;
  document.head.appendChild(style);

  // preload game tabs
  window.openGameFast = function(url){
    const win = window.open("about:blank","_blank");
    if(win) win.location = url;
  };
});


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
