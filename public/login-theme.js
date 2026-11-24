(() => {
  const key = 'connectifiLoginPaletteV262';
  const names = ['--bg','--surface','--surface-muted','--ink','--muted','--line','--accent','--accent-soft','--on-accent'];
  const themes = new Set(['','connectifi','dark','bd-somani','midnight','ocean','forest','rose','slate','glass','custom']);
  const valid = value => typeof value === 'string' && value.length <= 64 && /^(#[\da-f]{3,8}|rgba?\([\d.,%\s/]+\))$/i.test(value) && CSS.supports('color',value);
  let applied = false;
  function clear() {
    if (!applied) return;
    for (const name of names) { document.documentElement.style.removeProperty(name); document.body?.style.removeProperty(name); }
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
      document.body.dataset.theme=data.theme;document.body.dataset.colorMode=data.mode==='dark'?'dark':'light';
      for (const name of names) document.body.style.setProperty(name,data.tokens[name]);
      return true;
    };
    if (!body()) { const observer = new MutationObserver(() => { if (body()) observer.disconnect(); });observer.observe(document.documentElement,{childList:true}); }
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=data.tokens['--bg'];
    return true;
  }
  function remember() {
    const colors=getComputedStyle(document.body),tokens=Object.fromEntries(names.map(name=>[name,colors.getPropertyValue(name).trim()]));
    if (!names.every(name=>valid(tokens[name]))) return;
    try { localStorage.setItem(key,JSON.stringify({theme:document.body.dataset.theme||'',mode:document.body.dataset.colorMode||'light',tokens})); } catch { /* Storage can be unavailable. */ }
  }
  window.ConnectifiLoginTheme={restore,clear,remember};restore();
})();
