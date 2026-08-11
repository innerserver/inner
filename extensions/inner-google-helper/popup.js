const urls = {
  docs: {
    home: "https://docs.google.com/document/u/0/",
    create: "https://docs.google.com/document/create",
    type: "doc",
  },
  slides: {
    home: "https://docs.google.com/presentation/u/0/",
    create: "https://docs.google.com/presentation/create",
    type: "slides",
  },
  sheets: {
    home: "https://docs.google.com/spreadsheets/u/0/",
    create: "https://docs.google.com/spreadsheets/create",
    type: "sheet",
  },
};

const innerUrl = document.getElementById("innerUrl");
const statusEl = document.getElementById("status");

function setStatus(message) {
  statusEl.textContent = message || "";
}

function normalizeInnerUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.toString().replace(/\/+$/, "");
  } catch (error) {
    return "";
  }
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get({ innerUrl: "" });
  innerUrl.value = stored.innerUrl || "";
}

async function saveSettings() {
  const clean = normalizeInnerUrl(innerUrl.value);
  if (!clean) return setStatus("Paste your Inner Render URL first.");
  await chrome.storage.sync.set({ innerUrl: clean });
  innerUrl.value = clean;
  setStatus("Saved.");
}

async function openUrl(url) {
  await chrome.tabs.create({ url });
}

async function shareCurrentTab() {
  const stored = await chrome.storage.sync.get({ innerUrl: "" });
  const app = normalizeInnerUrl(stored.innerUrl || innerUrl.value);
  if (!app) return setStatus("Save your Inner URL first.");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = tab && tab.url ? tab.url : "";
  if (!/^https?:\/\//i.test(tabUrl)) return setStatus("Open a Docs/Slides/Sheets link first.");
  const title = encodeURIComponent(tab.title || "Google Workspace link");
  const url = encodeURIComponent(tabUrl);
  await chrome.tabs.create({ url: `${app}/dms?shareUrl=${url}&shareTitle=${title}&shareType=link` });
}

document.getElementById("saveUrl").addEventListener("click", saveSettings);
document.getElementById("shareCurrent").addEventListener("click", shareCurrentTab);
document.querySelectorAll("[data-open]").forEach((button) => {
  button.addEventListener("click", () => openUrl(urls[button.dataset.open].home));
});
document.querySelectorAll("[data-create]").forEach((button) => {
  button.addEventListener("click", () => openUrl(urls[button.dataset.create].create));
});

loadSettings().catch((error) => setStatus(error.message));
