(() => {
  const PANEL_SELECTOR = "#adminView .panel-form, #adminView .status-panel, #hmdView .panel-form, #hmdView .status-panel";

  function storageKey(panel, index) {
    const root = panel.closest("#adminView, #hmdView");
    const title = panel.querySelector("h3");
    return `innerPanelCollapsed:${root && root.id || "panel"}:${index}:${title && title.textContent || "panel"}`;
  }

  function readCollapsed(key) {
    try {
      return localStorage.getItem(key) === "1";
    } catch (error) {
      return false;
    }
  }

  function writeCollapsed(key, collapsed) {
    try {
      localStorage.setItem(key, collapsed ? "1" : "0");
    } catch (error) {}
  }

  function syncButton(panel, button) {
    const collapsed = panel.classList.contains("admin-collapsed");
    const nextText = collapsed ? "Expand" : "Collapse";
    const nextExpanded = collapsed ? "false" : "true";
    if (button.textContent !== nextText) button.textContent = nextText;
    if (button.getAttribute("aria-expanded") !== nextExpanded) button.setAttribute("aria-expanded", nextExpanded);
  }

  function ensurePanel(panel, index) {
    const title = panel.querySelector("h3");
    if (!title) return;
    let button = panel.querySelector(".collapse-toggle");
    if (!button) {
      button = document.createElement("button");
      button.className = "collapse-toggle";
      button.type = "button";
      const row = title.closest(".panel-title-row");
      if (row && panel.contains(row)) row.append(button);
      else title.insertAdjacentElement("afterend", button);
    }
    if (panel.dataset.uiBootCollapsible !== "1") {
      const key = storageKey(panel, index);
      panel.classList.toggle("admin-collapsed", readCollapsed(key));
      button.addEventListener("click", () => {
        const collapsed = !panel.classList.contains("admin-collapsed");
        panel.classList.toggle("admin-collapsed", collapsed);
        writeCollapsed(key, collapsed);
        syncButton(panel, button);
      });
      panel.dataset.uiBootCollapsible = "1";
      panel.dataset.collapsibleReady = "1";
    }
    syncButton(panel, button);
  }

  function setupCollapsibles() {
    document.querySelectorAll(PANEL_SELECTOR).forEach(ensurePanel);
  }

  let scheduled = false;

  function scheduleSetupCollapsibles() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      setupCollapsibles();
    });
  }

  function setGroupCollapsed(rootId, collapsed) {
    setupCollapsibles();
    document.querySelectorAll(`#${rootId} .panel-form, #${rootId} .status-panel`).forEach((panel, index) => {
      const button = panel.querySelector(".collapse-toggle");
      const key = storageKey(panel, index);
      panel.classList.toggle("admin-collapsed", Boolean(collapsed));
      writeCollapsed(key, collapsed);
      if (button) syncButton(panel, button);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupCollapsibles();
    document.getElementById("collapseAdminPanelsButton")?.addEventListener("click", () => setGroupCollapsed("adminView", true));
    document.getElementById("expandAdminPanelsButton")?.addEventListener("click", () => setGroupCollapsed("adminView", false));
    document.getElementById("collapseHmdPanelsButton")?.addEventListener("click", () => setGroupCollapsed("hmdView", true));
    document.getElementById("expandHmdPanelsButton")?.addEventListener("click", () => setGroupCollapsed("hmdView", false));
    new MutationObserver(scheduleSetupCollapsibles).observe(document.body, { childList: true, subtree: true });
  });

  window.InnerUiBoot = { setupCollapsibles, scheduleSetupCollapsibles, setGroupCollapsed };
})();
