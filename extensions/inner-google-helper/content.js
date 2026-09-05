(async function () {
  if (document.getElementById("inner-google-helper-button")) return;
  const stored = await chrome.storage.sync.get({ innerUrl: "" });
  const innerUrl = String(stored.innerUrl || "").replace(/\/+$/, "");
  if (!innerUrl) return;

  const button = document.createElement("button");
  button.id = "inner-google-helper-button";
  button.type = "button";
  button.textContent = "Share in Inner";
  button.addEventListener("click", () => {
    const title = encodeURIComponent(document.title || "Google Workspace link");
    const url = encodeURIComponent(location.href);
    window.open(`${innerUrl}/dms?shareUrl=${url}&shareTitle=${title}&shareType=link`, "_blank", "noopener");
  });
  document.documentElement.appendChild(button);
}());
