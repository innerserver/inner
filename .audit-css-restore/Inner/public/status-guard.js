(() => {
  let scheduled = false;

  function normalizeStatus() {
    const status = document.getElementById("connectionStatus");
    const current = status ? status.textContent.trim() : "";
    if (status && !/^(live|not live)$/i.test(current)) {
      status.textContent = "Not live";
    }
    const serverPill = document.getElementById("serverPill");
    const buildBadge = document.getElementById("buildBadge");
    if (serverPill && !serverPill.classList.contains("hidden")) serverPill.classList.add("hidden");
    if (buildBadge && !buildBadge.classList.contains("hidden")) buildBadge.classList.add("hidden");
  }

  function scheduleNormalize() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      normalizeStatus();
    });
  }

  document.addEventListener("DOMContentLoaded", normalizeStatus);
  new MutationObserver(scheduleNormalize).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  window.InnerStatusGuard = { normalizeStatus, scheduleNormalize };
})();
