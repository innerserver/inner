export const THEMES = {
  default: {
    glass: false
  },
  dark: {
    glass: false
  },
  glass: {
    glass: true,
    blur: true,
    transparency: true
  }
};

export function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);

  if (theme === "glass") {
    document.body.classList.add("glass-theme");
  } else {
    document.body.classList.remove("glass-theme");
  }

  localStorage.setItem("theme", theme);
}


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
