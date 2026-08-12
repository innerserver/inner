(() => {
  function normalizeStatus() {
    const status = document.getElementById("connectionStatus");
    if (status && !/^live$/i.test(status.textContent.trim())) {
      status.textContent = "Not live";
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
