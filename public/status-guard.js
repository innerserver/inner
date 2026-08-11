(() => {
  function normalizeStatus() {
    const status = document.getElementById("connectionStatus");
    if (status && !/^(realtime live|server live|offline|realtime offline)$/i.test(status.textContent.trim())) {
      status.textContent = "Realtime offline";
    }
    document.getElementById("serverPill")?.classList.add("hidden");
    document.getElementById("buildBadge")?.classList.add("hidden");
  }

  document.addEventListener("DOMContentLoaded", normalizeStatus);
  new MutationObserver(normalizeStatus).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  window.InnerStatusGuard = { normalizeStatus };
})();
