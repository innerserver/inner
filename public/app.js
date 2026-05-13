const state = {
  user: null,
  settings: { serverEnabled: true, roomName: "Inner" },
  rooms: [],
  selectedRoomId: "main",
  messages: [],
  dms: [],
  people: [],
  selectedDmUser: "",
  adminDmFilter: "all",
  files: [],
  vpn: {},
  locations: [],
  users: [],
  backups: [],
  store: { items: [], orders: [] },
  aiRequests: [],
  aiConfigured: false,
  ws: null,
  reconnectTimer: null,
  clientId: "",
  peers: new Map(),
  peerLocations: new Map(),
  peerConnections: new Map(),
  pendingCandidates: new Map(),
  localStream: null,
  remoteFrom: "",
  activeView: "messages",
  loggedIn: false,
  installPrompt: null,
  notificationsEnabled: false,
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  state.notificationsEnabled = getStoredFlag("innerNotifications");
  cacheElements();
  bindEvents();
  loadState().catch((error) => showLogin(error.status === 401 ? "" : error.message));
});

function cacheElements() {
  [
    "loginView",
    "appView",
    "loginForm",
    "loginUsername",
    "loginPassword",
    "loginError",
    "logoutButton",
    "roomName",
    "serverPill",
    "currentUser",
    "connectionStatus",
    "messageCount",
    "fileCount",
    "peerCount",
    "installButton",
    "notificationsButton",
    "messagesView",
    "dmsView",
    "storeView",
    "filesView",
    "screenView",
    "adminView",
    "adminNavButton",
    "messageState",
    "roomSelect",
    "messageList",
    "messageForm",
    "messageInput",
    "messageAttachment",
    "sendMessageButton",
    "dmState",
    "dmPeerSelect",
    "dmList",
    "dmForm",
    "dmInput",
    "dmAttachment",
    "sendDmButton",
    "uploadForm",
    "fileInput",
    "fileCategory",
    "uploadButton",
    "uploadStatus",
    "fileList",
    "storeList",
    "orderList",
    "screenStatus",
    "startShareButton",
    "stopShareButton",
    "remoteVideo",
    "emptyScreen",
    "localVideo",
    "peerList",
    "vpnState",
    "vpnForm",
    "vpnUsername",
    "vpnPassword",
    "vpnLocation",
    "vpnEnabled",
    "saveVpnButton",
    "vpnLocationStatus",
    "vpnUserStatus",
    "vpnPasswordStatus",
    "serverStateText",
    "serverForm",
    "roomNameInput",
    "serverEnabled",
    "saveServerButton",
    "passwordForm",
    "ownerPasswordForm",
    "createAccountForm",
    "accountManager",
    "accountList",
    "currentPassword",
    "nextPassword",
    "resetUser",
    "resetPassword",
    "resetPasswordButton",
    "newAccountUsername",
    "newAccountPassword",
    "newAccountRole",
    "newAccountPersistent",
    "createAccountButton",
    "featureLockForm",
    "featureName",
    "featureMinutes",
    "featureReason",
    "saveFeatureLockButton",
    "featureLockList",
    "roomForm",
    "newRoomName",
    "createRoomButton",
    "roomManagerList",
    "storeItemForm",
    "storeItemName",
    "storeItemPrice",
    "storeItemCurrency",
    "storeItemPaymentLink",
    "storeItemDescription",
    "createStoreItemButton",
    "adminStoreList",
    "adminOrderList",
    "aiForm",
    "aiKeyForm",
    "aiState",
    "aiPrompt",
    "aiApiKey",
    "askAiButton",
    "saveAiKeyButton",
    "clearAiKeyButton",
    "aiResponseList",
    "adminDmFilter",
    "adminDmList",
    "createBackupButton",
    "backupList",
    "toast",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.loginForm.addEventListener("submit", handleLogin);
  els.logoutButton.addEventListener("click", handleLogout);
  els.roomSelect.addEventListener("change", () => {
    state.selectedRoomId = els.roomSelect.value || "main";
    renderMessages();
    updateControls();
  });
  els.messageForm.addEventListener("submit", sendMessage);
  els.dmPeerSelect.addEventListener("change", () => {
    state.selectedDmUser = els.dmPeerSelect.value;
    renderDms();
    updateControls();
  });
  els.dmForm.addEventListener("submit", sendDm);
  els.uploadForm.addEventListener("submit", uploadFile);
  els.startShareButton.addEventListener("click", startShare);
  els.stopShareButton.addEventListener("click", stopShare);
  els.vpnForm.addEventListener("submit", saveVpn);
  els.serverForm.addEventListener("submit", saveServer);
  els.passwordForm.addEventListener("submit", changePassword);
  els.ownerPasswordForm.addEventListener("submit", resetUserPassword);
  els.createAccountForm.addEventListener("submit", createAccount);
  els.featureLockForm.addEventListener("submit", saveFeatureLock);
  els.roomForm.addEventListener("submit", createRoom);
  els.storeItemForm.addEventListener("submit", createStoreItem);
  els.aiForm.addEventListener("submit", askAi);
  els.aiKeyForm.addEventListener("submit", saveAiKey);
  els.clearAiKeyButton.addEventListener("click", clearAiKey);
  els.adminDmFilter.addEventListener("change", () => {
    state.adminDmFilter = els.adminDmFilter.value || "all";
    renderAdminDms();
  });
  els.createBackupButton.addEventListener("click", createBackup);
  els.notificationsButton.addEventListener("click", handleNotifications);
  els.installButton.addEventListener("click", installApp);

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    els.installButton.textContent = "Install app";
  });

  window.addEventListener("appinstalled", () => {
    state.installPrompt = null;
    els.installButton.textContent = "Installed";
    notify("Inner installed");
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }
}

async function handleLogin(event) {
  event.preventDefault();
  els.loginError.textContent = "";

  try {
    await api("/api/login", {
      method: "POST",
      json: {
        username: els.loginUsername.value.trim(),
        password: els.loginPassword.value,
      },
    });
    els.loginPassword.value = "";
    await loadState();
  } catch (error) {
    els.loginError.textContent = error.message;
  }
}

async function handleLogout() {
  state.loggedIn = false;
  closeSocket();
  stopShare({ silent: true });
  await api("/api/logout", { method: "POST" }).catch(() => {});
  showLogin();
}

async function loadState() {
  const data = await api("/api/state");
  state.user = data.user;
  state.settings = data.settings;
  state.rooms = data.rooms || [];
  state.messages = data.messages || [];
  state.dms = data.dms || [];
  state.files = data.files || [];
  state.vpn = data.vpn || {};
  state.locations = data.locations || [];
  state.users = data.users || [];
  state.people = data.people || [];
  state.backups = data.backups || [];
  state.store = data.store || { items: [], orders: [] };
  state.aiRequests = data.aiRequests || [];
  state.aiConfigured = Boolean(data.aiConfigured);
  state.loggedIn = true;

  showApp();
  renderAll();
  connectSocket();
}

function showLogin(message = "") {
  state.loggedIn = false;
  els.loginView.classList.remove("hidden");
  els.appView.classList.add("hidden");
  els.loginError.textContent = message;
  setConnection("Offline");
  setTimeout(() => els.loginPassword.focus(), 0);
}

function showApp() {
  els.loginView.classList.add("hidden");
  els.appView.classList.remove("hidden");
}

function showView(viewName) {
  if (viewName === "admin" && !isOwner()) viewName = "messages";
  state.activeView = viewName;
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `${viewName}View`);
  });
}

async function sendMessage(event) {
  event.preventDefault();
  const text = els.messageInput.value.trim();
  const file = els.messageAttachment.files[0];
  if (!text && !file) return;

  try {
    els.sendMessageButton.disabled = true;
    const attachment = file ? await uploadChatAttachment(file) : null;
    await api("/api/messages", { method: "POST", json: { text, attachment, roomId: state.selectedRoomId || "main" } });
    els.messageInput.value = "";
    els.messageAttachment.value = "";
  } catch (error) {
    notify(error.message);
  } finally {
    updateControls();
  }
}

async function sendDm(event) {
  event.preventDefault();
  const text = els.dmInput.value.trim();
  const to = els.dmPeerSelect.value;
  const file = els.dmAttachment.files[0];
  if (!to) return notify("Choose an account");
  if (!text && !file) return;

  try {
    els.sendDmButton.disabled = true;
    const attachment = file ? await uploadChatAttachment(file) : null;
    await api("/api/dms", { method: "POST", json: { to, text, attachment } });
    els.dmInput.value = "";
    els.dmAttachment.value = "";
  } catch (error) {
    notify(error.message);
  } finally {
    updateControls();
  }
}

async function uploadFile(event) {
  event.preventDefault();
  const file = els.fileInput.files[0];
  if (!file) return notify("Choose a file first");

  try {
    els.uploadButton.disabled = true;
    els.uploadStatus.textContent = `Uploading ${file.name}`;
    const response = await fetch("/api/upload", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "x-file-name": encodeURIComponent(file.name),
        "x-file-type": file.type || "application/octet-stream",
        "x-file-category": els.fileCategory.value,
      },
      body: file,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Upload failed");
    els.fileInput.value = "";
    els.uploadStatus.textContent = "";
    notify("File uploaded");
  } catch (error) {
    els.uploadStatus.textContent = "";
    notify(error.message);
  } finally {
    updateControls();
  }
}

async function uploadChatAttachment(file) {
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    throw new Error("Chat attachments must be photos or videos");
  }
  const response = await fetch("/api/upload", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "x-file-name": encodeURIComponent(file.name),
      "x-file-type": file.type || "application/octet-stream",
      "x-file-category": file.type.startsWith("image/") ? "image" : "video",
    },
    body: file,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Attachment upload failed");
  return data.file;
}

async function saveServer(event) {
  event.preventDefault();
  if (!isOwner()) return notify("Admin access required");

  try {
    const data = await api("/api/settings", {
      method: "POST",
      json: {
        roomName: els.roomNameInput.value.trim(),
        serverEnabled: els.serverEnabled.checked,
      },
    });
    state.settings = data.settings;
    renderAll();
    notify("Server settings saved");
  } catch (error) {
    notify(error.message);
  }
}

async function saveVpn(event) {
  event.preventDefault();
  if (!isOwner()) return notify("Admin access required");

  try {
    const data = await api("/api/vpn", {
      method: "POST",
      json: {
        username: els.vpnUsername.value.trim(),
        password: els.vpnPassword.value,
        location: els.vpnLocation.value,
        enabled: els.vpnEnabled.checked,
      },
    });
    state.vpn = data.vpn;
    els.vpnPassword.value = "";
    renderVpn();
    notify("VPN profile saved");
  } catch (error) {
    notify(error.message);
  }
}

async function changePassword(event) {
  event.preventDefault();
  try {
    await api("/api/change-password", {
      method: "POST",
      json: {
        currentPassword: els.currentPassword.value,
        nextPassword: els.nextPassword.value,
      },
    });
    els.currentPassword.value = "";
    els.nextPassword.value = "";
    notify("Password changed");
  } catch (error) {
    notify(error.message);
  }
}

async function resetUserPassword(event) {
  event.preventDefault();
  if (!isOwner()) return notify("Admin access required");

  try {
    const data = await api("/api/users/reset-password", {
      method: "POST",
      json: {
        username: els.resetUser.value,
        nextPassword: els.resetPassword.value,
      },
    });
    state.users = data.users || state.users;
    els.resetPassword.value = "";
    renderUsers();
    notify("Password reset");
  } catch (error) {
    notify(error.message);
  }
}

async function createAccount(event) {
  event.preventDefault();
  if (!isOwner()) return notify("Admin access required");

  try {
    const data = await api("/api/users", {
      method: "POST",
      json: {
        username: els.newAccountUsername.value,
        password: els.newAccountPassword.value,
        role: els.newAccountRole.value,
        allowPersistentLogin: els.newAccountPersistent.checked,
      },
    });
    state.users = data.users || state.users;
    els.newAccountUsername.value = "";
    els.newAccountPassword.value = "";
    els.newAccountRole.value = "member";
    els.newAccountPersistent.checked = false;
    renderUsers();
    notify("Account created");
  } catch (error) {
    notify(error.message);
  }
}

async function saveFeatureLock(event) {
  event.preventDefault();
  if (!isOwner()) return notify("Admin access required");

  try {
    const data = await api("/api/features/lock", {
      method: "POST",
      json: {
        feature: els.featureName.value,
        minutes: Number(els.featureMinutes.value || 0),
        reason: els.featureReason.value,
      },
    });
    state.settings = data.settings || state.settings;
    els.featureReason.value = "";
    renderAll();
    notify(Number(els.featureMinutes.value || 0) > 0 ? "Feature locked" : "Feature unlocked");
  } catch (error) {
    notify(error.message);
  }
}

async function createRoom(event) {
  event.preventDefault();
  if (!isOwner()) return notify("Admin access required");

  try {
    const data = await api("/api/rooms", {
      method: "POST",
      json: { name: els.newRoomName.value },
    });
    state.rooms = data.rooms || [...state.rooms, data.room].filter(Boolean);
    state.selectedRoomId = data.room ? data.room.id : state.selectedRoomId;
    els.newRoomName.value = "";
    renderRooms();
    renderMessages();
    notify("Room created");
  } catch (error) {
    notify(error.message);
  }
}

async function createStoreItem(event) {
  event.preventDefault();
  if (!isOwner()) return notify("Admin access required");
  try {
    const data = await api("/api/store/items", {
      method: "POST",
      json: {
        name: els.storeItemName.value,
        description: els.storeItemDescription.value,
        priceCents: Math.round(Number(els.storeItemPrice.value || 0) * 100),
        currency: els.storeItemCurrency.value,
        paymentLink: els.storeItemPaymentLink.value,
      },
    });
    state.store = data.store || state.store;
    els.storeItemName.value = "";
    els.storeItemPrice.value = "";
    els.storeItemPaymentLink.value = "";
    els.storeItemDescription.value = "";
    renderStore();
    renderAdminStore();
    notify("Paid item created");
  } catch (error) {
    notify(error.message);
  }
}

async function askAi(event) {
  event.preventDefault();
  if (!isOwner()) return notify("Admin access required");
  try {
    els.askAiButton.disabled = true;
    const data = await api("/api/ai/suggest", {
      method: "POST",
      json: { prompt: els.aiPrompt.value },
    });
    state.aiRequests = data.aiRequests || state.aiRequests;
    els.aiPrompt.value = "";
    renderAiRequests();
    notify(data.request && data.request.configured ? "AI answered" : "AI request saved");
  } catch (error) {
    notify(error.message);
  } finally {
    els.askAiButton.disabled = false;
  }
}

async function saveAiKey(event) {
  event.preventDefault();
  if (!isOwner()) return notify("Admin access required");
  try {
    const data = await api("/api/ai/key", {
      method: "POST",
      json: { apiKey: els.aiApiKey.value },
    });
    state.aiConfigured = Boolean(data.aiConfigured);
    els.aiApiKey.value = "";
    renderAiRequests();
    notify("AI key saved");
  } catch (error) {
    notify(error.message);
  }
}

async function clearAiKey() {
  if (!isOwner()) return notify("Admin access required");
  try {
    const data = await api("/api/ai/key", {
      method: "POST",
      json: { mode: "clear" },
    });
    state.aiConfigured = Boolean(data.aiConfigured);
    els.aiApiKey.value = "";
    renderAiRequests();
    notify("Saved AI key cleared");
  } catch (error) {
    notify(error.message);
  }
}

async function createBackup() {
  if (!isOwner()) return notify("Admin access required");

  try {
    const data = await api("/api/backups", { method: "POST" });
    state.backups = data.backups || state.backups;
    renderBackups();
    notify("Backup created");
  } catch (error) {
    notify(error.message);
  }
}

async function installApp() {
  if (!state.installPrompt) {
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) {
      return notify("Inner is already installed");
    }
    return notify("Use the browser menu to install Inner. Browser install works best on localhost or HTTPS.");
  }
  state.installPrompt.prompt();
  await state.installPrompt.userChoice.catch(() => {});
  state.installPrompt = null;
  els.installButton.textContent = "Install app";
}

async function handleNotifications() {
  if (!("Notification" in window)) {
    return notify("This browser does not support system alerts. In-app popups still work.");
  }
  if (!window.isSecureContext) {
    return notify("System alerts need localhost or HTTPS. In-app popups still work on this link.");
  }
  if (Notification.permission === "denied") {
    return notify("Alerts are blocked in browser settings");
  }
  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return notify("Alerts were not enabled");
  }

  state.notificationsEnabled = !state.notificationsEnabled;
  setStoredFlag("innerNotifications", state.notificationsEnabled);
  updateNotificationButton();
  notify(state.notificationsEnabled ? "Alerts enabled" : "Alerts disabled");
}

function connectSocket() {
  closeSocket();
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
  state.ws = ws;

  ws.addEventListener("open", () => setConnection("Live"));
  ws.addEventListener("close", () => {
    if (state.ws !== ws) return;
    setConnection("Offline");
    if (state.loggedIn) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = setTimeout(connectSocket, 1600);
    }
  });
  ws.addEventListener("error", () => setConnection("Offline"));
  ws.addEventListener("message", (event) => {
    try {
      handleSocketMessage(JSON.parse(event.data));
    } catch (error) {
      notify("Could not read live update");
    }
  });
}

function closeSocket() {
  clearTimeout(state.reconnectTimer);
  state.reconnectTimer = null;
  if (state.ws) {
    const ws = state.ws;
    state.ws = null;
    ws.close();
  }
  state.peers.clear();
  state.peerLocations.clear();
  renderPeers();
}

function handleSocketMessage(message) {
  if (message.type === "hello") {
    state.clientId = message.clientId;
    state.peers = new Map((message.peers || []).map((peer) => [peer.id, peer]));
    renderPeers();
    return;
  }

  if (message.type === "peer:joined") {
    state.peers.set(message.peer.id, message.peer);
    renderPeers();
    if (state.localStream) makeOffer(message.peer.id);
    return;
  }

  if (message.type === "peer:left") {
    state.peers.delete(message.peerId);
    closePeer(message.peerId);
    if (state.remoteFrom === message.peerId) clearRemoteVideo();
    renderPeers();
    return;
  }

  if (message.type === "message:new") {
    const incoming = state.user && message.message && message.message.user !== state.user.username;
    addMessage(message.message);
    if (incoming) showIncomingMessageAlert(message.message);
    return;
  }

  if (message.type === "message:delete") {
    state.messages = state.messages.filter((entry) => entry.id !== message.id);
    renderShell();
    renderMessages();
    return;
  }

  if (message.type === "room:new") {
    if (!state.rooms.some((room) => room.id === message.room.id)) state.rooms.push(message.room);
    renderRooms();
    return;
  }

  if (message.type === "room:delete") {
    state.rooms = state.rooms.filter((room) => room.id !== message.id);
    state.messages = state.messages.filter((entry) => (entry.roomId || "main") !== message.id);
    if (state.selectedRoomId === message.id) state.selectedRoomId = "main";
    renderRooms();
    renderMessages();
    return;
  }

  if (message.type === "dm:new") {
    const incoming = state.user && message.dm && message.dm.from !== state.user.username;
    addDm(message.dm);
    if (incoming) showIncomingDmAlert(message.dm);
    return;
  }

  if (message.type === "dm:delete") {
    state.dms = state.dms.filter((entry) => entry.id !== message.id);
    renderDms();
    renderAdminDms();
    return;
  }

  if (message.type === "file:new") {
    addFile(message.file);
    return;
  }

  if (message.type === "file:delete") {
    state.files = state.files.filter((entry) => entry.id !== message.id);
    renderShell();
    renderFiles();
    return;
  }

  if (message.type === "users:update" && isOwner()) {
    state.users = message.users || [];
    state.people = message.users || state.people;
    renderUsers();
    renderDms();
    renderAdminDms();
    return;
  }

  if (message.type === "state:update") {
    state.settings = message.settings;
    if (!state.settings.serverEnabled && state.localStream) stopShare();
    renderAll();
    return;
  }

  if (message.type === "backups:update" && isOwner()) {
    state.backups = message.backups || [];
    renderBackups();
    return;
  }

  if (message.type === "store:update") {
    state.store = message.store || { items: [], orders: [] };
    renderStore();
    renderAdminStore();
    return;
  }

  if (message.type === "ai:update" && isOwner()) {
    state.aiRequests = message.aiRequests || [];
    renderAiRequests();
    return;
  }

  if (message.type === "vpn:update") {
    state.vpn = message.vpn;
    renderVpn();
    return;
  }

  if (message.type === "screen:status") {
    const peer = state.peers.get(message.from) || {
      id: message.from,
      username: message.fromUser,
    };
    peer.sharing = message.sharing;
    state.peers.set(message.from, peer);
    if (!message.sharing && state.remoteFrom === message.from) clearRemoteVideo();
    renderPeers();
    return;
  }

  if (message.type === "signal") {
    handleSignal(message.from, message.fromUser, message.signal).catch((error) => {
      notify(error.message || "Screen share signal failed");
    });
    return;
  }

  if (message.type === "screen:request") {
    answerScreenRequest(message.from, message.fromUser);
    return;
  }

  if (message.type === "location:request") {
    answerLocationRequest(message.from, message.fromUser);
    return;
  }

  if (message.type === "location:share") {
    const peer = state.peers.get(message.from) || { id: message.from, username: message.fromUser || "Peer" };
    peer.location = message.location;
    state.peers.set(message.from, peer);
    if (message.location) state.peerLocations.set(message.from, message.location);
    renderPeers();
    notify(`${peer.username} shared location`);
    return;
  }

  if (message.type === "error") {
    notify(message.error);
  }
}

async function startShare() {
  if (!state.settings.serverEnabled && !isOwner()) return notify("Server room is off");
  if (!featureAvailable("screen")) return notify(lockMessage("screen"));
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    return notify("Screen sharing is not available in this browser");
  }

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: "always" },
      audio: true,
    });
    state.localStream = stream;
    els.localVideo.srcObject = stream;
    stream.getTracks().forEach((track) => {
      track.addEventListener("ended", () => stopShare());
    });
    sendWs({ type: "screen:status", sharing: true });
    for (const peer of state.peers.values()) {
      await makeOffer(peer.id);
    }
    renderScreen();
  } catch (error) {
    notify(error.message || "Screen sharing was cancelled");
  }
}

async function answerScreenRequest(target, fromUser) {
  if (!window.confirm(`${fromUser || "Admin"} is requesting your screen. Share it now?`)) return;
  await startShare();
  if (target && state.localStream) makeOffer(target).catch(() => {});
}

function answerLocationRequest(target, fromUser) {
  if (!navigator.geolocation) return notify("Location is not available in this browser");
  if (!window.confirm(`${fromUser || "Admin"} is requesting your location. Share it now?`)) return;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      sendWs({
        type: "location:share",
        target,
        location: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        },
      });
      notify("Location shared");
    },
    (error) => notify(error.message || "Location sharing failed"),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
  );
}

function requestPeerScreen(peerId) {
  if (!isOwner()) return notify("Admin access required");
  sendWs({ type: "screen:request", target: peerId });
  notify("Screen request sent");
}

function requestPeerLocation(peerId) {
  if (!isOwner()) return notify("Admin access required");
  sendWs({ type: "location:request", target: peerId });
  notify("Location request sent");
}

function stopShare(options = {}) {
  const stream = state.localStream;
  state.localStream = null;
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  els.localVideo.srcObject = null;

  for (const [peerId, pc] of state.peerConnections) {
    if (pc.hasLocalShare) closePeer(peerId);
  }

  if (!options.silent) sendWs({ type: "screen:status", sharing: false });
  renderScreen();
}

async function makeOffer(peerId) {
  const pc = createPeer(peerId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sendSignal(peerId, { description: pc.localDescription });
}

function createPeer(peerId) {
  const existing = state.peerConnections.get(peerId);
  if (existing && existing.signalingState !== "closed") return existing;

  const pc = new RTCPeerConnection({ iceServers: [] });
  pc.hasLocalShare = false;
  pc.onicecandidate = (event) => {
    if (event.candidate) sendSignal(peerId, { candidate: event.candidate });
  };
  pc.ontrack = (event) => {
    const stream = event.streams[0];
    if (!stream) return;
    state.remoteFrom = peerId;
    els.remoteVideo.srcObject = stream;
    renderScreen();
  };
  pc.onconnectionstatechange = renderScreen;

  if (state.localStream) {
    state.localStream.getTracks().forEach((track) => pc.addTrack(track, state.localStream));
    pc.hasLocalShare = true;
  }

  state.peerConnections.set(peerId, pc);
  return pc;
}

async function handleSignal(from, fromUser, signal) {
  const peer = state.peers.get(from) || { id: from, username: fromUser || "Peer", sharing: false };
  state.peers.set(from, peer);
  const pc = createPeer(from);

  if (signal.description) {
    await pc.setRemoteDescription(signal.description);
    await flushCandidates(from, pc);
    if (signal.description.type === "offer") {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(from, { description: pc.localDescription });
    }
  }

  if (signal.candidate) {
    if (pc.remoteDescription) {
      await pc.addIceCandidate(signal.candidate);
    } else {
      const pending = state.pendingCandidates.get(from) || [];
      pending.push(signal.candidate);
      state.pendingCandidates.set(from, pending);
    }
  }

  renderPeers();
}

async function flushCandidates(peerId, pc) {
  const pending = state.pendingCandidates.get(peerId) || [];
  state.pendingCandidates.delete(peerId);
  for (const candidate of pending) {
    await pc.addIceCandidate(candidate);
  }
}

function sendSignal(target, signal) {
  sendWs({ type: "signal", target, signal });
}

function sendWs(payload) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
  state.ws.send(JSON.stringify(payload));
}

function closePeer(peerId) {
  const pc = state.peerConnections.get(peerId);
  if (pc) pc.close();
  state.peerConnections.delete(peerId);
  state.pendingCandidates.delete(peerId);
}

function clearRemoteVideo() {
  els.remoteVideo.srcObject = null;
  state.remoteFrom = "";
  renderScreen();
}

function renderAll() {
  renderShell();
  renderRooms();
  renderMessages();
  renderDms();
  renderStore();
  renderFiles();
  renderScreen();
  renderVpn();
  renderServer();
  renderUsers();
  renderFeatureLocks();
  renderRoomManager();
  renderAdminDms();
  renderAdminStore();
  renderAiRequests();
  renderBackups();
  updateControls();
}

function renderShell() {
  const enabled = Boolean(state.settings.serverEnabled);
  els.roomName.textContent = state.settings.roomName || "Inner";
  els.serverPill.textContent = enabled ? "Server on" : "Server off";
  els.serverPill.classList.toggle("on", enabled);
  els.serverPill.classList.toggle("off", !enabled);
  els.currentUser.textContent = state.user ? `${state.user.username} (${state.user.role})` : "-";
  els.messageCount.textContent = String(state.messages.length);
  els.fileCount.textContent = String(state.files.length);
  els.peerCount.textContent = String(state.peers.size + (state.loggedIn ? 1 : 0));
  document.querySelectorAll(".owner-only").forEach((element) => {
    element.classList.toggle("hidden", !isOwner());
  });
  updateNotificationButton();
  if (!isOwner() && state.activeView === "admin") showView("messages");
}

function renderRooms() {
  if (!state.rooms.some((room) => room.id === "main")) {
    state.rooms.unshift({ id: "main", name: "Main" });
  }
  if (!state.rooms.some((room) => room.id === state.selectedRoomId)) state.selectedRoomId = "main";

  els.roomSelect.replaceChildren(
    ...state.rooms.map((room) => {
      const option = document.createElement("option");
      option.value = room.id;
      option.textContent = room.name;
      return option;
    })
  );
  els.roomSelect.value = state.selectedRoomId;
}

function renderMessages() {
  const room = state.rooms.find((entry) => entry.id === state.selectedRoomId) || { id: "main", name: "Main" };
  const visibleMessages = state.messages.filter((message) => (message.roomId || "main") === room.id);
  const locked = featureLock("messages") || (room.id !== "main" ? featureLock("rooms") : null);
  els.messageState.textContent = locked
    ? `${room.name} paused until ${formatDate(locked.disabledUntil)}`
    : state.settings.serverEnabled
      ? room.name
      : "Room paused";
  const shouldStick =
    els.messageList.scrollTop + els.messageList.clientHeight >= els.messageList.scrollHeight - 24;
  els.messageList.replaceChildren();

  if (!visibleMessages.length) {
    els.messageList.append(emptyBlock("No messages yet"));
  } else {
    visibleMessages.forEach((message) => {
      const item = document.createElement("article");
      item.className = `message ${message.user === state.user.username ? "mine" : ""}`;

      const meta = document.createElement("div");
      meta.className = "message-meta";
      meta.append(textNode(message.user), textNode(formatDate(message.createdAt)));
      if (isOwner()) {
        meta.append(textNode(`From ${message.sourceIp || "unknown"}`));
      }

      const body = document.createElement("div");
      body.className = "message-text";
      body.textContent = message.text;

      item.append(meta, body);
      appendMessageAttachment(item, message.attachment);
      if (isOwner()) {
        const actions = document.createElement("div");
        actions.className = "message-actions";
        const deleteButton = document.createElement("button");
        deleteButton.className = "ghost-light-button compact-button";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => deleteMessage(message.id));
        actions.append(deleteButton);
        item.append(actions);
      }
      els.messageList.append(item);
    });
  }

  if (shouldStick) els.messageList.scrollTop = els.messageList.scrollHeight;
}

function renderDms() {
  const people = dmPeople();
  if (!state.selectedDmUser && people.length) state.selectedDmUser = people[0].username;
  if (state.selectedDmUser && !people.some((person) => person.username === state.selectedDmUser)) {
    state.selectedDmUser = people[0] ? people[0].username : "";
  }

  els.dmPeerSelect.replaceChildren(
    ...people.map((person) => {
      const option = document.createElement("option");
      option.value = person.username;
      option.textContent = `${person.username} (${person.role})`;
      return option;
    })
  );
  els.dmPeerSelect.value = state.selectedDmUser;

  const locked = featureLock("dms");
  els.dmState.textContent = locked
    ? `DMs paused until ${formatDate(locked.disabledUntil)}`
    : "Direct messages are visible to admins for safety review";
  els.dmList.replaceChildren();

  if (!state.selectedDmUser) {
    els.dmList.append(emptyBlock("No accounts available"));
    return;
  }

  const visible = state.dms.filter((dm) => dmBetween(dm, state.user.username, state.selectedDmUser));
  if (!visible.length) {
    els.dmList.append(emptyBlock("No DMs yet"));
    return;
  }

  visible.forEach((dm) => {
    els.dmList.append(renderMessageBubble({
      mine: dm.from === state.user.username,
      title: `${dm.from} to ${dm.to}`,
      text: dm.text,
      createdAt: dm.createdAt,
      sourceIp: dm.sourceIp,
      attachment: dm.attachment,
      onDelete: isOwner() ? () => deleteDm(dm.id) : null,
    }));
  });
}

function renderFiles() {
  els.fileList.replaceChildren();

  if (!state.files.length) {
    els.fileList.append(emptyBlock("No files uploaded"));
    return;
  }

  state.files.forEach((file) => {
    const card = document.createElement("article");
    card.className = "file-card";

    const header = document.createElement("header");
    const title = document.createElement("h3");
    title.textContent = file.originalName;
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = file.category;
    header.append(title, tag);

    const meta = document.createElement("div");
    meta.className = "file-meta";
    meta.append(textNode(`${file.kind} - ${formatBytes(file.size)}`), textNode(`Uploaded by ${file.user}`), textNode(formatDate(file.createdAt)));
    if (isOwner()) {
      meta.append(textNode(`From ${file.sourceIp || "unknown"}`));
      if (file.sourceAgent) meta.append(textNode(file.sourceAgent));
    }

    const preview = createFilePreview(file);
    const link = document.createElement("a");
    link.href = file.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Open file";

    const actions = document.createElement("div");
    actions.className = "file-actions";
    actions.append(link);
    const downloadButton = document.createElement("button");
    downloadButton.className = "ghost-light-button compact-button";
    downloadButton.type = "button";
    downloadButton.textContent = "Download";
    downloadButton.addEventListener("click", () => downloadUrl(`${file.url}?download=1`, file.originalName));
    actions.append(downloadButton);
    if (isOwner()) {
      const deleteButton = document.createElement("button");
      deleteButton.className = "ghost-light-button compact-button";
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => deleteFile(file.id));
      actions.append(deleteButton);
    }

    card.append(header, meta);
    if (preview) card.append(preview);
    card.append(actions);
    els.fileList.append(card);
  });
}

function renderStore() {
  els.storeList.replaceChildren();
  const items = (state.store.items || []).filter((item) => item.active !== false);
  if (!items.length) {
    els.storeList.append(emptyBlock("No paid items yet"));
  } else {
    items.forEach((item) => {
      const card = document.createElement("article");
      card.className = "file-card";
      const header = document.createElement("header");
      const title = document.createElement("h3");
      title.textContent = item.name;
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = formatMoney(item.priceCents, item.currency);
      header.append(title, tag);
      const meta = document.createElement("div");
      meta.className = "file-meta";
      if (item.description) meta.append(textNode(item.description));
      const actions = document.createElement("div");
      actions.className = "file-actions";
      const request = accountButton("Request", () => requestStoreItem(item.id));
      actions.append(request);
      if (item.paymentLink) {
        const pay = accountButton("Pay link", () => window.open(item.paymentLink, "_blank", "noopener"));
        actions.append(pay);
      }
      card.append(header, meta, actions);
      els.storeList.append(card);
    });
  }

  renderOrders(els.orderList, state.store.orders || [], false);
}

function createFilePreview(file) {
  if (file.kind === "image") {
    const image = document.createElement("img");
    image.className = "file-preview image-preview";
    image.src = file.url;
    image.alt = file.originalName || "Image";
    image.loading = "lazy";
    return image;
  }

  if (file.kind === "video") {
    const video = document.createElement("video");
    video.className = "file-preview";
    video.src = file.url;
    video.controls = true;
    video.preload = "metadata";
    return video;
  }

  if (file.kind === "audio") {
    const audio = document.createElement("audio");
    audio.className = "file-preview";
    audio.src = file.url;
    audio.controls = true;
    audio.preload = "metadata";
    return audio;
  }

  return null;
}

function appendMessageAttachment(item, attachment) {
  if (!attachment) return;
  const preview = createFilePreview(attachment);
  if (preview) {
    preview.classList.add("message-attachment");
    item.append(preview);
  }
  const actions = document.createElement("div");
  actions.className = "message-actions";
  const open = document.createElement("a");
  open.href = attachment.url;
  open.target = "_blank";
  open.rel = "noopener";
  open.textContent = attachment.originalName || "Open attachment";
  const download = document.createElement("button");
  download.className = "ghost-light-button compact-button";
  download.type = "button";
  download.textContent = "Download";
  download.addEventListener("click", () => downloadUrl(`${attachment.url}?download=1`, attachment.originalName || "attachment"));
  actions.append(open, download);
  item.append(actions);
}

function renderScreen() {
  const sharing = Boolean(state.localStream);
  const remoteActive = Boolean(els.remoteVideo.srcObject);
  els.startShareButton.disabled = sharing || (!state.settings.serverEnabled && !isOwner()) || !featureAvailable("screen");
  els.stopShareButton.disabled = !sharing;
  els.emptyScreen.classList.toggle("hidden", remoteActive);

  if (sharing) {
    els.screenStatus.textContent = "Sharing your screen";
  } else if (remoteActive) {
    const peer = state.peers.get(state.remoteFrom);
    els.screenStatus.textContent = `${peer ? peer.username : "Peer"} is sharing`;
  } else if (!featureAvailable("screen")) {
    els.screenStatus.textContent = lockMessage("screen");
  } else {
    els.screenStatus.textContent = state.settings.serverEnabled || isOwner() ? "No active share" : "Room paused";
  }
}

function renderPeers() {
  if (!els.peerList) return;
  els.peerList.replaceChildren();

  if (!state.peers.size) {
    els.peerList.append(emptyBlock("No other users online"));
  } else {
    state.peers.forEach((peer) => {
      const item = document.createElement("div");
      item.className = "peer";
      const name = document.createElement("span");
      name.textContent = peer.username;
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = peer.sharing ? "Sharing" : "Online";

      const details = document.createElement("div");
      details.className = "peer-details";
      details.append(name, tag);

      const location = state.peerLocations.get(peer.id) || peer.location;
      if (location) {
        const locationLink = document.createElement("a");
        locationLink.href = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
        locationLink.target = "_blank";
        locationLink.rel = "noopener";
        locationLink.textContent = "Location";
        details.append(locationLink);
      }

      item.append(details);
      if (isOwner()) {
        const actions = document.createElement("div");
        actions.className = "peer-actions";
        const screenButton = document.createElement("button");
        screenButton.className = "ghost-light-button compact-button";
        screenButton.type = "button";
        screenButton.textContent = "Screen";
        screenButton.addEventListener("click", () => requestPeerScreen(peer.id));
        const locationButton = document.createElement("button");
        locationButton.className = "ghost-light-button compact-button";
        locationButton.type = "button";
        locationButton.textContent = "Location";
        locationButton.addEventListener("click", () => requestPeerLocation(peer.id));
        actions.append(screenButton, locationButton);
        item.append(actions);
      }
      els.peerList.append(item);
    });
  }

  els.peerCount.textContent = String(state.peers.size + (state.loggedIn ? 1 : 0));
}

function renderVpn() {
  els.vpnLocation.replaceChildren(
    ...state.locations.map((location) => {
      const option = document.createElement("option");
      option.value = location;
      option.textContent = location;
      return option;
    })
  );

  els.vpnUsername.value = state.vpn.username || "";
  els.vpnLocation.value = state.vpn.location || state.locations[0] || "United States";
  els.vpnEnabled.checked = Boolean(state.vpn.enabled);
  els.vpnState.textContent = state.vpn.enabled ? "Enabled" : "Off";
  els.vpnLocationStatus.textContent = state.vpn.location || "-";
  els.vpnUserStatus.textContent = state.vpn.username || "-";
  els.vpnPasswordStatus.textContent = state.vpn.passwordSet ? "Set" : "Not set";

  const admin = isOwner();
  [els.vpnUsername, els.vpnPassword, els.vpnLocation, els.vpnEnabled, els.saveVpnButton].forEach((input) => {
    input.disabled = !admin;
  });
}

function renderServer() {
  const enabled = Boolean(state.settings.serverEnabled);
  els.serverStateText.textContent = enabled ? "Active" : "Paused";
  els.roomNameInput.value = state.settings.roomName || "Inner";
  els.serverEnabled.checked = enabled;

  const admin = isOwner();
  [els.roomNameInput, els.serverEnabled, els.saveServerButton].forEach((input) => {
    input.disabled = !admin;
  });
}

function renderUsers() {
  if (!els.ownerPasswordForm) return;
  const admin = isOwner();
  [els.ownerPasswordForm, els.createAccountForm, els.accountManager, els.featureLockForm, els.roomForm].forEach((element) => {
    element.classList.toggle("hidden", !admin);
  });
  if (!admin) return;

  els.resetUser.replaceChildren(
    ...state.users.map((user) => {
      const option = document.createElement("option");
      option.value = user.username;
      option.textContent = `${user.username} (${user.role})`;
      return option;
    })
  );
  els.resetPasswordButton.disabled = state.users.length === 0;

  els.accountList.replaceChildren();
  if (!state.users.length) {
    els.accountList.append(emptyBlock("No accounts yet"));
    return;
  }

  state.users.forEach((user) => {
    const username = user.username.toLowerCase();
    const isMainAdmin = username === "admin";
    const isCurrentUser = state.user && username === state.user.username.toLowerCase();
    const item = document.createElement("article");
    item.className = "account-card";

    const head = document.createElement("div");
    head.className = "account-head";
    const name = document.createElement("strong");
    name.textContent = user.username;
    const badge = document.createElement("span");
    badge.className = "tag";
    badge.textContent = user.banned ? "Banned" : user.role;
    head.append(name, badge);

    const meta = document.createElement("div");
    meta.className = "account-meta";
    meta.append(textNode(`Access ${user.role}`));
    meta.append(textNode(`Persistent login ${user.allowPersistentLogin ? "allowed" : "off"}`));
    meta.append(textNode(`Created ${formatDate(user.createdAt) || "-"}`));
    if (user.createdBy) meta.append(textNode(`By ${user.createdBy}`));
    if (user.lastLoginAt) meta.append(textNode(`Last login ${formatDate(user.lastLoginAt)}`));
    if (user.lastLoginIp) meta.append(textNode(`From ${user.lastLoginIp}`));
    if (user.bannedUntil) meta.append(textNode(`Ban until ${formatDate(user.bannedUntil)}`));
    if (user.banReason) meta.append(textNode(user.banReason));

    const actions = document.createElement("div");
    actions.className = "account-actions";
    const roleButton = accountButton(user.role === "admin" ? "Make member" : "Make admin", () =>
      updateUser(user.username, { role: user.role === "admin" ? "member" : "admin" })
    );
    roleButton.disabled = isMainAdmin;
    const persistentButton = accountButton(user.allowPersistentLogin ? "Disable persistent" : "Allow persistent", () =>
      updateUser(user.username, { allowPersistentLogin: !user.allowPersistentLogin })
    );
    const banShort = accountButton("Ban 15m", () => banUser(user.username, 15));
    const banHour = accountButton("Ban 1h", () => banUser(user.username, 60));
    const banDay = accountButton("Ban 24h", () => banUser(user.username, 1440));
    const unban = accountButton("Unban", () => banUser(user.username, 0));
    const remove = accountButton("Delete", () => deleteUser(user.username));
    banShort.disabled = isMainAdmin;
    banHour.disabled = isMainAdmin;
    banDay.disabled = isMainAdmin;
    unban.disabled = isMainAdmin;
    remove.disabled = isMainAdmin || isCurrentUser;
    actions.append(roleButton, persistentButton, banShort, banHour, banDay, unban, remove);

    item.append(head, meta, actions);
    els.accountList.append(item);
  });
}

function renderFeatureLocks() {
  if (!els.featureLockList) return;
  els.featureLockList.replaceChildren();
  const locks = Object.entries(state.settings.featureLocks || {});
  if (!locks.length) {
    els.featureLockList.append(emptyBlock("No active locks"));
    return;
  }

  locks.forEach(([feature, lock]) => {
    const item = document.createElement("article");
    item.className = "account-card";
    const head = document.createElement("div");
    head.className = "account-head";
    const name = document.createElement("strong");
    name.textContent = featureLabel(feature);
    const badge = document.createElement("span");
    badge.className = "tag";
    badge.textContent = "Locked";
    head.append(name, badge);

    const meta = document.createElement("div");
    meta.className = "account-meta";
    meta.append(textNode(`Until ${formatDate(lock.disabledUntil)}`));
    if (lock.disabledBy) meta.append(textNode(`By ${lock.disabledBy}`));
    if (lock.reason) meta.append(textNode(lock.reason));

    const unlock = accountButton("Unlock", () => quickFeatureUnlock(feature));
    item.append(head, meta, unlock);
    els.featureLockList.append(item);
  });
}

function renderRoomManager() {
  if (!els.roomManagerList) return;
  els.roomManagerList.replaceChildren();
  state.rooms.forEach((room) => {
    const item = document.createElement("article");
    item.className = "account-card";
    const head = document.createElement("div");
    head.className = "account-head";
    const name = document.createElement("strong");
    name.textContent = room.name;
    const badge = document.createElement("span");
    badge.className = "tag";
    badge.textContent = room.id === "main" ? "Main" : "Side";
    head.append(name, badge);

    const meta = document.createElement("div");
    meta.className = "account-meta";
    meta.append(textNode(`Created ${formatDate(room.createdAt) || "-"}`));
    if (room.createdBy) meta.append(textNode(`By ${room.createdBy}`));

    const actions = document.createElement("div");
    actions.className = "account-actions";
    const open = accountButton("Open", () => {
      state.selectedRoomId = room.id;
      renderRooms();
      showView("messages");
      renderMessages();
    });
    const remove = accountButton("Delete", () => deleteRoom(room.id));
    remove.disabled = room.id === "main";
    actions.append(open, remove);

    item.append(head, meta, actions);
    els.roomManagerList.append(item);
  });
}

function renderAdminDms() {
  if (!els.adminDmList || !isOwner()) return;
  const people = [{ username: "all", role: "filter" }, ...state.people];
  els.adminDmFilter.replaceChildren(
    ...people.map((person) => {
      const option = document.createElement("option");
      option.value = person.username;
      option.textContent = person.username === "all" ? "All DMs" : person.username;
      return option;
    })
  );
  if (!people.some((person) => person.username === state.adminDmFilter)) state.adminDmFilter = "all";
  els.adminDmFilter.value = state.adminDmFilter;

  els.adminDmList.replaceChildren();
  const visible =
    state.adminDmFilter === "all"
      ? state.dms
      : state.dms.filter((dm) => dm.from === state.adminDmFilter || dm.to === state.adminDmFilter);

  if (!visible.length) {
    els.adminDmList.append(emptyBlock("No DMs to review"));
    return;
  }

  visible.slice(-250).forEach((dm) => {
    els.adminDmList.append(renderMessageBubble({
      mine: false,
      title: `${dm.from} to ${dm.to}`,
      text: dm.text,
      createdAt: dm.createdAt,
      sourceIp: dm.sourceIp,
      attachment: dm.attachment,
      onDelete: () => deleteDm(dm.id),
    }));
  });
}

function renderBackups() {
  if (!els.backupList || !isOwner()) return;
  els.backupList.replaceChildren();
  if (!state.backups.length) {
    els.backupList.append(emptyBlock("No backups yet"));
    return;
  }

  state.backups.forEach((backup) => {
    const item = document.createElement("article");
    item.className = "account-card";
    const head = document.createElement("div");
    head.className = "account-head";
    const name = document.createElement("strong");
    name.textContent = backup.fileName;
    const badge = document.createElement("span");
    badge.className = "tag";
    badge.textContent = formatBytes(backup.size);
    head.append(name, badge);

    const meta = document.createElement("div");
    meta.className = "account-meta";
    meta.append(textNode(`Created ${formatDate(backup.createdAt)}`));

    const actions = document.createElement("div");
    actions.className = "account-actions";
    const download = accountButton("Download", () => {
      downloadUrl(`/api/backups/${encodeURIComponent(backup.fileName)}`, backup.fileName);
    });
    const remove = accountButton("Delete", () => deleteBackup(backup.fileName));
    actions.append(download, remove);

    item.append(head, meta, actions);
    els.backupList.append(item);
  });
}

function renderAdminStore() {
  if (!isOwner()) return;
  if (els.adminStoreList) {
    els.adminStoreList.replaceChildren();
    const items = state.store.items || [];
    if (!items.length) {
      els.adminStoreList.append(emptyBlock("No paid items"));
    } else {
      items.forEach((item) => {
        const card = adminCard(item.name, formatMoney(item.priceCents, item.currency), [
          item.description || "No description",
          item.paymentLink ? `Payment link ${item.paymentLink}` : "No payment link",
          `Created ${formatDate(item.createdAt)}`,
        ]);
        const actions = document.createElement("div");
        actions.className = "account-actions";
        actions.append(accountButton("Delete", () => deleteStoreItem(item.id)));
        card.append(actions);
        els.adminStoreList.append(card);
      });
    }
  }
  if (els.adminOrderList) renderOrders(els.adminOrderList, state.store.orders || [], true);
}

function renderOrders(container, orders, adminMode) {
  container.replaceChildren();
  if (!orders.length) {
    container.append(emptyBlock("No orders yet"));
    return;
  }
  orders.forEach((order) => {
    const card = adminCard(`${order.itemName}`, order.status, [
      `${formatMoney(order.priceCents, order.currency)} by ${order.user}`,
      `Created ${formatDate(order.createdAt)}`,
      order.note ? `Note: ${order.note}` : "",
      order.sourceIp && adminMode ? `From ${order.sourceIp}` : "",
    ].filter(Boolean));
    if (adminMode) {
      const actions = document.createElement("div");
      actions.className = "account-actions";
      ["pending", "paid", "cancelled", "refunded"].forEach((status) => {
        actions.append(accountButton(status, () => updateOrder(order.id, status)));
      });
      card.append(actions);
    } else if (order.paymentLink && order.status === "pending") {
      const actions = document.createElement("div");
      actions.className = "account-actions";
      actions.append(accountButton("Pay link", () => window.open(order.paymentLink, "_blank", "noopener")));
      card.append(actions);
    }
    container.append(card);
  });
}

function renderAiRequests() {
  if (!els.aiResponseList || !isOwner()) return;
  if (els.aiState) {
    els.aiState.textContent = state.aiConfigured
      ? "AI key is configured. Ask for small safe changes."
      : "AI key is not configured. Add a key below or start Inner with OPENAI_API_KEY set.";
  }
  els.aiResponseList.replaceChildren();
  if (!state.aiRequests.length) {
    els.aiResponseList.append(emptyBlock("No AI requests yet"));
    return;
  }
  state.aiRequests.slice().reverse().forEach((request) => {
    const card = adminCard(request.prompt, request.configured ? "AI" : "Saved", [
      request.response,
      `By ${request.createdBy} at ${formatDate(request.createdAt)}`,
    ]);
    els.aiResponseList.append(card);
  });
}

function updateControls() {
  const serverEnabled = Boolean(state.settings.serverEnabled) || isOwner();
  const room = state.rooms.find((entry) => entry.id === state.selectedRoomId) || { id: "main" };
  const messagesEnabled = serverEnabled && featureAvailable("messages") && (room.id === "main" || featureAvailable("rooms"));
  const dmsEnabled = serverEnabled && featureAvailable("dms") && Boolean(state.selectedDmUser);
  const filesEnabled = serverEnabled && featureAvailable("files");
  const screenEnabled = serverEnabled && featureAvailable("screen");
  els.roomSelect.disabled = !featureAvailable("rooms") && room.id !== "main";
  els.messageInput.disabled = !messagesEnabled;
  els.messageAttachment.disabled = !messagesEnabled;
  els.sendMessageButton.disabled = !messagesEnabled;
  els.dmPeerSelect.disabled = !dmsEnabled && !state.selectedDmUser;
  els.dmInput.disabled = !dmsEnabled;
  els.dmAttachment.disabled = !dmsEnabled;
  els.sendDmButton.disabled = !dmsEnabled;
  els.fileInput.disabled = !filesEnabled;
  els.fileCategory.disabled = !filesEnabled;
  els.uploadButton.disabled = !filesEnabled;
  els.startShareButton.disabled = !screenEnabled || Boolean(state.localStream);
}

function addMessage(message) {
  if (state.messages.some((entry) => entry.id === message.id)) return;
  message.roomId = message.roomId || "main";
  state.messages.push(message);
  state.messages = state.messages.slice(-500);
  renderShell();
  renderMessages();
}

function addDm(dm) {
  if (state.dms.some((entry) => entry.id === dm.id)) return;
  state.dms.push(dm);
  state.dms = state.dms.slice(-500);
  renderDms();
  renderAdminDms();
}

function addFile(file) {
  if (state.files.some((entry) => entry.id === file.id)) return;
  state.files.unshift(file);
  renderShell();
  renderFiles();
}

async function deleteMessage(id) {
  if (!isOwner()) return notify("Admin access required");
  try {
    await api(`/api/messages/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (error) {
    notify(error.message);
  }
}

async function deleteFile(id) {
  if (!isOwner()) return notify("Admin access required");
  try {
    await api(`/api/files/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (error) {
    notify(error.message);
  }
}

async function requestStoreItem(itemId) {
  try {
    const note = window.prompt("Optional note for admin") || "";
    const data = await api("/api/store/orders", {
      method: "POST",
      json: { itemId, note },
    });
    state.store = data.store || state.store;
    renderStore();
    notify("Request sent");
    if (data.order && data.order.paymentLink) window.open(data.order.paymentLink, "_blank", "noopener");
  } catch (error) {
    notify(error.message);
  }
}

async function deleteStoreItem(id) {
  if (!isOwner()) return notify("Admin access required");
  if (!window.confirm("Delete this paid item?")) return;
  try {
    const data = await api(`/api/store/items/${encodeURIComponent(id)}`, { method: "DELETE" });
    state.store = data.store || state.store;
    renderStore();
    renderAdminStore();
    notify("Item deleted");
  } catch (error) {
    notify(error.message);
  }
}

async function updateOrder(id, status) {
  if (!isOwner()) return notify("Admin access required");
  try {
    const data = await api("/api/store/orders/update", {
      method: "POST",
      json: { id, status },
    });
    state.store = data.store || state.store;
    renderStore();
    renderAdminStore();
    notify("Order updated");
  } catch (error) {
    notify(error.message);
  }
}

async function deleteDm(id) {
  if (!isOwner()) return notify("Admin access required");
  try {
    await api(`/api/dms/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (error) {
    notify(error.message);
  }
}

async function deleteRoom(id) {
  if (!isOwner()) return notify("Admin access required");
  if (id === "main") return notify("Main room cannot be deleted");
  if (!window.confirm("Delete this room and its messages?")) return;
  try {
    const data = await api(`/api/rooms/${encodeURIComponent(id)}`, { method: "DELETE" });
    state.rooms = data.rooms || state.rooms.filter((room) => room.id !== id);
    state.messages = state.messages.filter((entry) => (entry.roomId || "main") !== id);
    if (state.selectedRoomId === id) state.selectedRoomId = "main";
    renderRooms();
    renderMessages();
    renderRoomManager();
    notify("Room deleted");
  } catch (error) {
    notify(error.message);
  }
}

async function quickFeatureUnlock(feature) {
  if (!isOwner()) return notify("Admin access required");
  try {
    const data = await api("/api/features/lock", {
      method: "POST",
      json: { feature, minutes: 0 },
    });
    state.settings = data.settings || state.settings;
    renderAll();
    notify("Feature unlocked");
  } catch (error) {
    notify(error.message);
  }
}

async function deleteBackup(fileName) {
  if (!isOwner()) return notify("Admin access required");
  if (!window.confirm("Delete this backup?")) return;
  try {
    const data = await api(`/api/backups/${encodeURIComponent(fileName)}`, { method: "DELETE" });
    state.backups = data.backups || [];
    renderBackups();
    notify("Backup deleted");
  } catch (error) {
    notify(error.message);
  }
}

function accountButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ghost-light-button compact-button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function adminCard(titleText, badgeText, lines) {
  const item = document.createElement("article");
  item.className = "account-card";
  const head = document.createElement("div");
  head.className = "account-head";
  const title = document.createElement("strong");
  title.textContent = titleText;
  const badge = document.createElement("span");
  badge.className = "tag";
  badge.textContent = badgeText;
  head.append(title, badge);
  const meta = document.createElement("div");
  meta.className = "account-meta";
  lines.filter(Boolean).forEach((line) => meta.append(textNode(line)));
  item.append(head, meta);
  return item;
}

async function updateUser(username, changes) {
  if (!isOwner()) return notify("Admin access required");
  const existing = state.users.find((user) => user.username === username) || {};
  try {
    const data = await api("/api/users/update", {
      method: "POST",
      json: {
        username,
        role: changes.role || existing.role || "member",
        allowPersistentLogin:
          typeof changes.allowPersistentLogin === "boolean"
            ? changes.allowPersistentLogin
            : Boolean(existing.allowPersistentLogin),
      },
    });
    state.users = data.users || state.users;
    renderUsers();
    notify("Account updated");
  } catch (error) {
    notify(error.message);
  }
}

async function banUser(username, minutes) {
  if (!isOwner()) return notify("Admin access required");
  try {
    const data = await api("/api/users/ban", {
      method: "POST",
      json: {
        username,
        minutes,
        reason: minutes ? `Temporary ban for ${minutes} minutes` : "",
      },
    });
    state.users = data.users || state.users;
    renderUsers();
    notify(minutes ? "Account banned" : "Account unbanned");
  } catch (error) {
    notify(error.message);
  }
}

async function deleteUser(username) {
  if (!isOwner()) return notify("Admin access required");
  if (!window.confirm(`Delete account ${username}?`)) return;
  try {
    const data = await api(`/api/users/${encodeURIComponent(username)}`, { method: "DELETE" });
    state.users = data.users || state.users;
    renderUsers();
    notify("Account deleted");
  } catch (error) {
    notify(error.message);
  }
}

function dmPeople() {
  const current = state.user ? state.user.username.toLowerCase() : "";
  return (state.people || [])
    .filter((person) => person.username && person.username.toLowerCase() !== current && !person.banned)
    .sort((a, b) => a.username.localeCompare(b.username));
}

function dmBetween(dm, first, second) {
  const pair = new Set([String(first || ""), String(second || "")]);
  return pair.has(dm.from) && pair.has(dm.to);
}

function featureLock(feature) {
  const lock = (state.settings.featureLocks || {})[feature];
  if (!lock) return null;
  const until = Date.parse(lock.disabledUntil);
  if (!Number.isFinite(until) || until <= Date.now()) return null;
  return lock;
}

function featureAvailable(feature) {
  return isOwner() || !featureLock(feature);
}

function lockMessage(feature) {
  const lock = featureLock(feature);
  if (!lock) return "";
  return `${featureLabel(feature)} disabled until ${formatDate(lock.disabledUntil)}`;
}

function featureLabel(feature) {
  const labels = {
    dms: "DMs",
    files: "Files",
    messages: "Messages",
    rooms: "Side rooms",
    screen: "Screen",
    vpn: "VPN",
  };
  return labels[feature] || feature;
}

function renderMessageBubble({ mine, title, text, createdAt, sourceIp, attachment, onDelete }) {
  const item = document.createElement("article");
  item.className = `message ${mine ? "mine" : ""}`;

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.append(textNode(title), textNode(formatDate(createdAt)));
  if (isOwner() && sourceIp) meta.append(textNode(`From ${sourceIp}`));

  const body = document.createElement("div");
  body.className = "message-text";
  body.textContent = text;
  item.append(meta, body);
  appendMessageAttachment(item, attachment);

  if (onDelete) {
    const actions = document.createElement("div");
    actions.className = "message-actions";
    const deleteButton = document.createElement("button");
    deleteButton.className = "ghost-light-button compact-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", onDelete);
    actions.append(deleteButton);
    item.append(actions);
  }

  return item;
}

function showIncomingMessageAlert(message) {
  const room = state.rooms.find((entry) => entry.id === (message.roomId || "main")) || { name: "Main" };
  const title = `${message.user} in ${room.name}`;
  const body = previewText(message.text);
  notify(`${title}: ${body}`);
  showSystemAlert(title, body, `message-${message.id}`, () => {
    state.selectedRoomId = message.roomId || "main";
    renderRooms();
    showView("messages");
    renderMessages();
  });
}

function showIncomingDmAlert(dm) {
  const title = `DM from ${dm.from}`;
  const body = previewText(dm.text);
  notify(`${title}: ${body}`);
  showSystemAlert(title, body, `dm-${dm.id}`, () => {
    state.selectedDmUser = dm.from === state.user.username ? dm.to : dm.from;
    showView("dms");
    renderDms();
  });
}

function showSystemAlert(title, body, tag, onClick) {
  if (!state.notificationsEnabled) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible" && document.hasFocus()) return;

  try {
    const alert = new Notification(title, {
      body,
      icon: "/icon.svg",
      tag,
    });
    alert.onclick = () => {
      window.focus();
      if (typeof onClick === "function") onClick();
      alert.close();
    };
  } catch (error) {
    // Some browsers only allow notifications on localhost or HTTPS.
  }
}

function updateNotificationButton() {
  if (!els.notificationsButton) return;
  if (!("Notification" in window)) {
    els.notificationsButton.textContent = "Alerts unavailable";
    els.notificationsButton.disabled = true;
    return;
  }
  if (Notification.permission === "denied") {
    els.notificationsButton.textContent = "Alerts blocked";
    els.notificationsButton.disabled = false;
    return;
  }
  if (state.notificationsEnabled && Notification.permission === "granted") {
    els.notificationsButton.textContent = "Alerts on";
  } else {
    els.notificationsButton.textContent = "Enable alerts";
  }
  els.notificationsButton.disabled = false;
}

function previewText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > 90 ? `${text.slice(0, 87)}...` : text;
}

function getStoredFlag(key) {
  try {
    return localStorage.getItem(key) === "on";
  } catch (error) {
    return false;
  }
}

function setStoredFlag(key, value) {
  try {
    if (value) {
      localStorage.setItem(key, "on");
    } else {
      localStorage.removeItem(key);
    }
  } catch (error) {
    // Local storage can be disabled; alerts still work for this session.
  }
}

function downloadUrl(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "";
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}

function formatMoney(priceCents, currency) {
  try {
    return new Intl.NumberFormat([], {
      style: "currency",
      currency: currency || "USD",
    }).format(Number(priceCents || 0) / 100);
  } catch (error) {
    return `${currency || "USD"} ${(Number(priceCents || 0) / 100).toFixed(2)}`;
  }
}

async function api(path, options = {}) {
  const init = {
    method: options.method || "GET",
    credentials: "same-origin",
    headers: options.headers || {},
  };

  if (options.json !== undefined) {
    init.headers = { ...init.headers, "Content-Type": "application/json" };
    init.body = JSON.stringify(options.json);
  }

  let response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    const startupError = new Error(
      "Inner server is still starting or is stopped. Keep this window open for a moment, then try again."
    );
    startupError.network = true;
    throw startupError;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function isOwner() {
  return state.user && (state.user.role === "owner" || state.user.role === "admin");
}

function setConnection(value) {
  if (els.connectionStatus) els.connectionStatus.textContent = value;
}

function notify(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => els.toast.classList.add("hidden"), 2600);
}

function emptyBlock(message) {
  const block = document.createElement("div");
  block.className = "empty-state-inline";
  block.textContent = message;
  return block;
}

function textNode(value) {
  const span = document.createElement("span");
  span.textContent = value;
  return span;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat([], {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
