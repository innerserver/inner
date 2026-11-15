(() => {
  const t = (key) => window.ConnectifiI18n?.t(key) || key;
  window.uploadResumableFile = async (file, category = "document", options = {}) => {
    if (!state.user || !state.loggedIn) throw new Error("Sign in before uploading");
    const username = state.user.username;
    const photo = /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name);
    if (!file.size || file.size > 250 * 1024 * 1024) throw new Error("Choose a file between 1 byte and 250 MiB");
    const bytes = await new Blob([file.slice(0, 65536), file.slice(-65536)]).arrayBuffer();
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((value) => value.toString(16).padStart(2, "0")).join("");
    const key = `connectifi-upload:${username}:${JSON.stringify([file.name, file.size, file.lastModified, options.schoolContext || "", Boolean(options.private), options.releaseRoom || "", digest])}`;
    let uploadId = localStorage.getItem(key), offset = 0;
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    window.currentUploadController = controller;
    const progress = (value, saving = false) => {
      options.onProgress?.(value, file.size, saving);
      if (els.uploadStatus) els.uploadStatus.textContent = saving ? `${file.name}: ${t(photo ? "Saving file" : "Checking document")}` : `${file.name}: ${Math.round(value / file.size * 100)}%`;
      const item = state.uploadQueue.find((entry) => entry.name === file.name);
      if (item) { item.progress = saving ? t(photo ? "Saving file" : "Checking document") : `${Math.round(value / file.size * 100)}%`; renderUploadQueue(); }
    };
    const request = async (url, settings = {}) => {
      if (!state.loggedIn || state.user?.username !== username) throw new Error("The upload account changed. Sign in again.");
      const response = await fetch(url, { ...settings, credentials: "same-origin", signal: controller.signal, headers: { "X-CSRF-Token": state.csrfToken, ...settings.headers } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(data.error || "Upload failed. Select the same file to resume."), { status: response.status, offset: data.offset });
      return data;
    };
    try {
      if (uploadId) {
        try {
          const existing = await request(`/api/uploads/resumable/${uploadId}`);
          if (existing.file) { localStorage.removeItem(key); return existing.file; }
          offset = existing.offset;
        } catch (error) {
          if (![404, 410].includes(error.status)) throw error;
          localStorage.removeItem(key); uploadId = null;
        }
      }
      if (!uploadId) {
        const created = await request("/api/uploads/resumable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, type: file.type, size: file.size, category, private: Boolean(options.private), schoolContext: options.schoolContext || "", releaseRoom: options.releaseRoom || "", releaseAt: options.releaseAt || "" }) });
        uploadId = created.uploadId; localStorage.setItem(key, uploadId);
      }
      progress(offset);
      let failures = 0;
      while (offset < file.size) {
        try {
          const data = await request(`/api/uploads/resumable/${uploadId}`, { method: "PATCH", headers: { "Content-Type": "application/octet-stream", "Upload-Offset": String(offset) }, body: file.slice(offset, offset + 2 * 1024 * 1024) });
          offset = data.offset; failures = 0; progress(offset);
        } catch (error) {
          if (controller.signal.aborted || ++failures > 3 || (error.status && ![409, 429, 500, 503].includes(error.status))) throw error;
          await new Promise((resolve) => setTimeout(resolve, failures * 500));
          const status = await request(`/api/uploads/resumable/${uploadId}`); offset = status.offset;
        }
      }
      progress(offset, true);
      const completed = await request(`/api/uploads/resumable/${uploadId}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      localStorage.removeItem(key);
      return completed.file;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Upload paused. Select the same file to resume within 24 hours.");
      throw error;
    } finally {
      options.signal?.removeEventListener("abort", abort);
      if (window.currentUploadController === controller) window.currentUploadController = null;
    }
  };
})();
