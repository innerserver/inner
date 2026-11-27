(() => {
  const key = 'connectifiLoginPaletteV262';
  const names = ['--bg','--surface','--surface-muted','--ink','--muted','--line','--accent','--accent-soft','--on-accent'];
  const themes = new Set(['','connectifi','dark','bd-somani','midnight','ocean','forest','rose','slate','glass','custom']);
  const valid = value => typeof value === 'string' && value.length <= 64 && /^(#[\da-f]{3,8}|rgba?\([\d.,%\s/]+\))$/i.test(value) && CSS.supports('color',value);
  function safePhoto(value) {
    if (typeof value !== "string" || value.length > 1024 * 1024 || /["\\\r\n]/.test(value)) return "";
    if (/^data:image\/(?:png|jpe?g|gif|webp);base64,[\w+/=]+$/i.test(value)) return value;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
    } catch { return ""; }
  }
  let applied = false;
  function clear() {
    if (!applied) return;
    for (const name of names) { document.documentElement.style.removeProperty(name); document.body?.style.removeProperty(name); }
    document.documentElement.style.removeProperty("--account-theme-image");
    if (document.body) {
      delete document.body.dataset.themeImage;
      delete document.body.dataset.loginWallpaper;
    }
    applied = false;
  }
  function restore() {
    let data;
    try { data = JSON.parse(localStorage.getItem(key)); } catch { return false; }
    if (!data || !themes.has(data.theme) || !names.every(name => valid(data.tokens?.[name]))) return false;
    for (const name of names) document.documentElement.style.setProperty(name,data.tokens[name]);
    applied = true;
    const body = () => {
      if (!document.body) return false;
      document.body.dataset.theme=data.theme;
      document.body.dataset.visualStyle=data.visualStyle || "forest";
      document.body.dataset.colorMode=data.mode==='dark'?'dark':'light';
      const photo = safePhoto(data.photo);
      if (photo) {
        document.documentElement.style.setProperty("--account-theme-image", "url(" + JSON.stringify(photo) + ")");
        document.body.dataset.loginWallpaper = "true";
      } else {
        document.documentElement.style.removeProperty("--account-theme-image");
        delete document.body.dataset.loginWallpaper;
      }
      for (const name of names) document.body.style.setProperty(name,data.tokens[name]);
      return true;
    };
    if (!body()) { const observer = new MutationObserver(() => { if (body()) observer.disconnect(); });observer.observe(document.documentElement,{childList:true}); }
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=data.tokens['--bg'];
    return true;
  }
  function remember(photo) {
    const colors=getComputedStyle(document.body),tokens=Object.fromEntries(names.map(name=>[name,colors.getPropertyValue(name).trim()]));
    if (!names.every(name=>valid(tokens[name]))) return;
    const data = {
      theme: document.body.dataset.theme || "", mode: document.body.dataset.colorMode || "light",
      visualStyle: document.body.dataset.visualStyle, tokens, photo: safePhoto(photo),
    };
    try { localStorage.setItem(key, JSON.stringify(data)); }
    catch {
      try { localStorage.setItem(key, JSON.stringify({ ...data, photo: "" })); }
      catch { /* Storage can be unavailable. */ }
    }
  }
  window.ConnectifiLoginTheme={restore,clear,remember};restore();
})();
