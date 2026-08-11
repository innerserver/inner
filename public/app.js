const state = {
  user: null,
  settings: { serverEnabled: true, roomName: "Inner" },
  uploadConfig: { directCloudinary: false, maxBytes: 250 * 1024 * 1024, maxLabel: "250 MB" },
  rooms: [],
  selectedRoomId: "main",
  messages: [],
  pendingSends: [],
  replyToMessage: null,
  dms: [],
  pendingDms: [],
  replyToDm: null,
  dmGroups: [],
  people: [],
  friendCandidates: [],
  friendSearch: "",
  friendGradeFilter: "",
  friendSearchTimer: 0,
  selectedDmUser: "",
  adminDmFilter: "all",
  accountSearch: "",
  accountGradeFilter: "",
  accountShowAll: false,
  logSearch: "",
  logDate: "",
  files: [],
  innerDocs: [],
  selectedInnerDocId: "",
  docsListCollapsed: false,
  googleWorkspaceKind: "docs",
  accountRequests: [],
  uploadQueue: [],
  vpn: {},
  locations: [],
  users: [],
  backups: [],
  profiles: {},
  friends: { friends: [], incoming: [], outgoing: [] },
  invites: [],
  reports: [],
  readReceipts: {},
  moderationLogs: [],
  logs: [],
  liveIpTracking: [],
  dev: null,
  presence: [],
  voiceRooms: [],
  voiceRoomId: "lobby",
  voiceStream: null,
  voicePeers: [],
  voiceConnections: new Map(),
  voicePendingCandidates: new Map(),
  voiceMuted: false,
  voiceDeafened: false,
  voiceVideoEnabled: false,
  voiceCameraOff: true,
  incomingCall: null,
  ringtoneContext: null,
  ringtoneTimer: null,
  bots: [],
  plugins: [],
  automod: {},
  announcements: [],
  emailStatus: null,
  store: { items: [], orders: [] },
  aiRequests: [],
  aiConfigured: false,
  ws: null,
  reconnectTimer: null,
  wsPingTimer: null,
  wsOutbox: [],
  wsEverConnected: false,
  restoredScrollKeys: new Set(),
  clientId: "",
  peers: new Map(),
  peerLocations: new Map(),
  peerConnections: new Map(),
  pendingCandidates: new Map(),
  localStream: null,
  screenRoomId: "",
  remoteScreenRoomId: "",
  remoteScreenStream: null,
  remoteFrom: "",
  activeView: "dashboard",
  loggedIn: false,
  installPrompt: null,
  notificationsEnabled: false,
  inviteAutoJoined: false,
};

window.state = state;

let rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ],
  iceCandidatePoolSize: 4,
};

const viewRoutes = {
  dashboard: "/",
  messages: "/messages",
  dms: "/dms",
  friends: "/friends",
  profile: "/profile",
  store: "/store",
  files: "/files",
  googleWorkspace: "/google-workspace",
  browser: "/browser",
  chess: "/chess",
  voice: "/voice",
  screen: "/screen",
  domain: "/domain",
  admin: "/admin",
  hmd: "/hmd",
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  state.notificationsEnabled = getStoredFlag("innerNotifications");
  restoreUiState();
  cacheElements();
  bindEvents();
  refreshSignupStatus().catch(() => {});
  loadState().catch((error) => showLogin(error.status === 401 ? "" : error.message));
});

function cacheElements() {
  [
    "loginView",
    "appView",
    "sidebarToggleButton",
    "sidebarBackdrop",
    "loginForm",
    "loginUsername",
    "loginPassword",
    "loginError",
    "signupEntryButton",
    "accountRequestForm",
    "requestUsername",
    "requestDisplayName",
    "requestEmail",
    "requestPhone",
    "requestGrade",
    "requestRole",
    "requestPassword",
    "requestNote",
    "submitAccountRequestButton",
    "requestBackButton",
    "accountRequestStatus",
    "signupForm",
    "signupUsername",
    "signupDisplayName",
    "signupEmail",
    "signupPhone",
    "signupGrade",
    "signupPassword",
    "signupButton",
    "signupBackButton",
    "signupStatus",
    "logoutButton",
    "roomName",
    "serverPill",
    "currentUser",
    "connectionStatus",
    "buildBadge",
    "messageCount",
    "fileCount",
    "peerCount",
    "installButton",
    "notificationsButton",
    "siteNotice",
    "dashboardView",
    "dashboardState",
    "dashboardGrid",
    "dashboardAnnouncementList",
    "onboardingPanel",
    "onboardingTitle",
    "onboardingSubtitle",
    "onboardingSteps",
    "dismissOnboardingButton",
    "showOnboardingButton",
    "phoneInstallGuide",
    "phoneInstallGuideButton",
    "presenceList",
    "mentionList",
    "messagesView",
    "dmsView",
    "friendsView",
    "profileView",
    "storeView",
    "filesView",
    "docsView",
    "googleWorkspaceView",
    "googleWorkspaceFrame",
    "googleWorkspaceNote",
    "openGoogleWorkspaceButton",
    "newGoogleWorkspaceButton",
    "shareGoogleWorkspaceButton",
    "googleDocsModeButton",
    "googleSlidesModeButton",
    "googleSheetsModeButton",
    "docsToggleListButton",
    "newInnerDocButton",
    "deleteInnerDocButton",
    "innerDocList",
    "innerDocForm",
    "innerDocTitle",
    "innerDocType",
    "innerDocBody",
    "innerDocPage",
    "docNewSlideButton",
    "innerDocShareTarget",
    "shareInnerDocButton",
    "docDownloadHtmlButton",
    "docDownloadTextButton",
    "innerDocStatus",
    "innerDocWordCount",
    "browserView",
    "publicBrowserForm",
    "publicBrowserUrl",
    "publicBrowserOpenButton",
    "publicBrowserFullTabButton",
    "publicBrowserShareButton",
    "publicBrowserShareTitle",
    "publicBrowserShareType",
    "publicBrowserShareTarget",
    "publicBrowserSendButton",
    "publicBrowserStatus",
    "publicBrowserFrame",
    "chessView",
    "chessFrame",
    "openChessButton",
    "continueChessButton",
    "shareChessButton",
    "voiceView",
    "screenView",
    "domainView",
    "adminView",
    "hmdView",
    "domainNavButton",
    "adminNavButton",
    "hmdNavButton",
    "messageState",
    "roomSelect",
    "inviteJoinForm",
    "inviteCodeInput",
    "joinInviteButton",
    "messageList",
    "messageJumpBottomButton",
    "messageForm",
    "messageInput",
    "messageAttachment",
    "messageSelfieInput",
    "messageSelfieButton",
    "sendMessageButton",
    "dmState",
    "dmPeerSelect",
    "dmGroupForm",
    "dmGroupName",
    "dmGroupMembers",
    "createDmGroupButton",
    "deleteDmGroupButton",
    "shareLinkForm",
    "shareLinkTitle",
    "shareLinkUrl",
    "shareLinkType",
    "shareLinkTarget",
    "shareLinkButton",
    "dmCallPanel",
    "dmCallState",
    "dmVoiceCallButton",
    "dmVideoCallButton",
    "dmShareScreenButton",
    "dmStopScreenButton",
    "dmLeaveCallButton",
    "dmAnswerCallButton",
    "dmDeclineCallButton",
    "dmLocalCallPreview",
    "dmRemoteCallList",
    "dmScreenVideo",
    "dmScreenEmpty",
    "dmList",
    "dmJumpBottomButton",
    "dmForm",
    "dmInput",
    "dmAttachment",
    "dmSelfieInput",
    "dmSelfieButton",
    "sendDmButton",
    "friendRequestForm",
    "friendSearchInput",
    "friendGradeSearch",
    "friendGradeSearchButton",
    "friendUserSelect",
    "sendFriendRequestButton",
    "friendList",
    "friendRequestList",
    "friendState",
    "profileForm",
    "profilePreview",
    "profilePreviewBanner",
    "profilePreviewAvatar",
    "profilePreviewName",
    "profilePreviewStatus",
    "profileDisplayName",
    "profileAvatarUrl",
    "profileBannerUrl",
    "profileBadges",
    "profileStatus",
    "profileCustomStatus",
    "profileGrade",
    "profileTheme",
    "customThemeFields",
    "profileThemeBg",
    "profileThemeSurface",
    "profileThemeInk",
    "profileThemeAccent",
    "profileBio",
    "profileInvisible",
    "saveProfileButton",
    "uploadForm",
    "fileInput",
    "filePickerSummary",
    "fileCategory",
    "privateUpload",
    "uploadButton",
    "uploadQueue",
    "uploadStatus",
    "fileList",
    "storeList",
    "orderList",
    "voiceState",
    "voiceRoomSelect",
    "joinVoiceButton",
    "joinVideoButton",
    "leaveVoiceButton",
    "muteVoiceButton",
    "deafenVoiceButton",
    "cameraVoiceButton",
    "localCallPreview",
    "voicePeerList",
    "remoteAudioList",
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
    "signupMode",
    "requireContact",
    "reportEmails",
    "chessUrlInput",
    "testEmailButton",
    "emailStatusText",
    "serverEnabled",
    "saveServerButton",
    "shutdownServerButton",
    "restartServerButton",
    "passwordForm",
    "ownerPasswordForm",
    "createAccountForm",
    "accountManager",
    "showAllAccountsButton",
    "accountGradeFilter",
    "accountSearchInput",
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
    "featureVisibilityForm",
    "visibilityFeatureName",
    "visibilityHidden",
    "visibilityAllowedUsers",
    "saveFeatureVisibilityButton",
    "featureVisibilityList",
    "paywallForm",
    "paywallFeatureName",
    "paywallItemId",
    "paywallEnabled",
    "paywallMessage",
    "savePaywallButton",
    "paywallList",
    "quickEditForm",
    "quickAppName",
    "quickConnectedLabel",
    "quickDisconnectedLabel",
    "quickServerOnLabel",
    "quickServerOffLabel",
    "quickVersionLabel",
    "quickUpdateTitle",
    "quickUpdateNote",
    "quickNotice",
    "quickAccent",
    "quickDensity",
    "quickRounded",
    "quickCustomCss",
    "saveQuickEditButton",
    "announcementForm",
    "announcementTitle",
    "announcementMessage",
    "announcementScope",
    "announcementRoomLabel",
    "announcementRoom",
    "sendAnnouncementButton",
    "announcementList",
    "roomForm",
    "newRoomName",
    "newRoomIcon",
    "newRoomCategory",
    "newRoomPassword",
    "newRoomTheme",
    "newRoomPrivate",
    "newRoomInviteOnly",
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
    "aiBaseUrl",
    "aiModel",
    "askAiButton",
    "saveAiKeyButton",
    "clearAiKeyButton",
    "aiResponseList",
    "adminAutomodForm",
    "adminAutomodEnabled",
    "adminAutomodWindow",
    "adminAutomodMax",
    "adminAutomodWords",
    "saveAdminAutomodButton",
    "adminDmFilter",
    "adminDmList",
    "adminReadReceiptList",
    "createBackupButton",
    "backupList",
    "accountRequestList",
    "liveIpList",
    "reportList",
    "exportModerationLogsButton",
    "moderationLogList",
    "logList",
    "exportLogsButton",
    "logSearchInput",
    "logDateInput",
    "serviceScaleForm",
    "serviceScaleList",
    "serviceScaleCostSummary",
    "domainBillSummary",
    "saveServiceScaleButton",
    "adminBrowserForm",
    "adminBrowserUrl",
    "adminBrowserOpenButton",
    "adminBrowserNewTabButton",
    "adminBrowserShareButton",
    "adminBrowserStatus",
    "adminBrowserFrame",
    "browserPolicyForm",
    "browserAllowOnly",
    "browserAllowedSites",
    "browserBlockedSites",
    "saveBrowserPolicyButton",
    "wipeLogsButton",
    "wipeReportsButton",
    "wipeUploadsButton",
    "wipeRoomsButton",
    "hmdState",
    "devConfigForm",
    "devEmergencyMode",
    "devMetricsEnabled",
    "devTheme",
    "saveDevConfigButton",
    "hmdMetricGrid",
    "databaseList",
    "storageList",
    "localhostToolList",
    "botForm",
    "botName",
    "botDescription",
    "botEnabled",
    "createBotButton",
    "botList",
    "pluginForm",
    "pluginName",
    "pluginHook",
    "pluginNotes",
    "pluginEnabled",
    "createPluginButton",
    "pluginList",
    "automodForm",
    "automodEnabled",
    "automodWindow",
    "automodMax",
    "automodWords",
    "saveAutomodButton",
    "toast",
    "cornerAd",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  if (els.sidebarToggleButton) els.sidebarToggleButton.addEventListener("click", toggleSidebar);
  if (els.sidebarBackdrop) els.sidebarBackdrop.addEventListener("click", closeSidebar);
  els.loginForm.addEventListener("submit", handleLogin);
  if (els.signupEntryButton) els.signupEntryButton.addEventListener("click", openSignupChoice);
  if (els.requestBackButton) els.requestBackButton.addEventListener("click", closeSignupChoice);
  if (els.signupBackButton) els.signupBackButton.addEventListener("click", closeSignupChoice);
  els.accountRequestForm.addEventListener("submit", submitAccountRequest);
  els.signupForm.addEventListener("submit", handleSignup);
  els.logoutButton.addEventListener("click", handleLogout);
  els.roomSelect.addEventListener("change", () => {
    state.selectedRoomId = els.roomSelect.value || "main";
    unlockRoomIfNeeded(state.selectedRoomId);
    saveUiState();
    renderMessages();
    updateControls();
  });
  els.inviteJoinForm.addEventListener("submit", joinInvite);
  els.messageForm.addEventListener("submit", sendMessage);
  els.messageList.addEventListener("scroll", () => {
    updateJumpButton(els.messageList, els.messageJumpBottomButton);
    saveScrollPosition("messages", state.selectedRoomId || "main", els.messageList);
  });
  els.messageJumpBottomButton.addEventListener("click", () => scrollToBottom(els.messageList, true));
  els.messageSelfieButton.addEventListener("click", () => els.messageSelfieInput.click());
  els.messageSelfieInput.addEventListener("change", () => sendSelfie("message"));
  els.dmPeerSelect.addEventListener("change", () => {
    state.selectedDmUser = els.dmPeerSelect.value;
    saveUiState();
    renderDms();
    renderDmCall();
    updateControls();
  });
  els.dmForm.addEventListener("submit", sendDm);
  els.dmList.addEventListener("scroll", () => {
    updateJumpButton(els.dmList, els.dmJumpBottomButton);
    saveScrollPosition("dm", receiptTargetForCurrentDm(), els.dmList);
  });
  els.dmJumpBottomButton.addEventListener("click", () => scrollToBottom(els.dmList, true));
  els.dmSelfieButton.addEventListener("click", () => els.dmSelfieInput.click());
  els.dmSelfieInput.addEventListener("change", () => sendSelfie("dm"));
  els.dmGroupForm.addEventListener("submit", createDmGroup);
  els.deleteDmGroupButton.addEventListener("click", deleteCurrentDmGroup);
  if (els.shareLinkForm) els.shareLinkForm.addEventListener("submit", shareLinkToFriends);
  if (els.shareChessButton) els.shareChessButton.addEventListener("click", () => fillShareLink(currentChessUrl(), "ChessVerse", "app"));
  if (els.openGoogleWorkspaceButton) els.openGoogleWorkspaceButton.addEventListener("click", () => openGoogleWorkspaceFullTab());
  if (els.newGoogleWorkspaceButton) els.newGoogleWorkspaceButton.addEventListener("click", () => openGoogleWorkspaceInApp(state.googleWorkspaceKind, true));
  if (els.shareGoogleWorkspaceButton) els.shareGoogleWorkspaceButton.addEventListener("click", () => shareGoogleWorkspace());
  document.querySelectorAll("[data-google-kind]").forEach((button) => {
    button.addEventListener("click", () => openGoogleWorkspaceInApp(button.dataset.googleKind || "docs"));
  });
  if (els.docsToggleListButton) els.docsToggleListButton.addEventListener("click", toggleDocsList);
  if (els.newInnerDocButton) els.newInnerDocButton.addEventListener("click", newInnerDoc);
  if (els.deleteInnerDocButton) els.deleteInnerDocButton.addEventListener("click", deleteInnerDoc);
  if (els.innerDocType) els.innerDocType.addEventListener("change", syncInnerDocMode);
  if (els.docNewSlideButton) els.docNewSlideButton.addEventListener("click", insertInnerSlide);
  if (els.docDownloadHtmlButton) els.docDownloadHtmlButton.addEventListener("click", () => downloadInnerDoc("html"));
  if (els.docDownloadTextButton) els.docDownloadTextButton.addEventListener("click", () => downloadInnerDoc("txt"));
  if (els.innerDocForm) els.innerDocForm.addEventListener("submit", saveInnerDoc);
  if (els.shareInnerDocButton) els.shareInnerDocButton.addEventListener("click", shareInnerDoc);
  document.querySelectorAll("[data-doc-command],[data-doc-block]").forEach((button) => button.addEventListener("click", handleDocTool));
  if (els.innerDocPage) {
    els.innerDocPage.addEventListener("input", () => {
      updateInnerDocHiddenBody();
      updateInnerDocStats();
    });
    els.innerDocPage.addEventListener("paste", cleanInnerDocPaste);
  }
  if (els.publicBrowserForm) els.publicBrowserForm.addEventListener("submit", openPublicBrowser);
  if (els.publicBrowserFullTabButton) els.publicBrowserFullTabButton.addEventListener("click", openPublicBrowserFullTab);
  if (els.publicBrowserShareButton) els.publicBrowserShareButton.addEventListener("click", sharePublicBrowserLink);
  if (els.publicBrowserSendButton) els.publicBrowserSendButton.addEventListener("click", sendPublicBrowserLink);
  els.dmVoiceCallButton.addEventListener("click", () => startDmCall(false));
  els.dmVideoCallButton.addEventListener("click", () => startDmCall(true));
  els.dmShareScreenButton.addEventListener("click", () => startDmScreenShare());
  els.dmStopScreenButton.addEventListener("click", () => stopShare());
  els.dmLeaveCallButton.addEventListener("click", leaveVoice);
  els.dmAnswerCallButton.addEventListener("click", answerIncomingCall);
  els.dmDeclineCallButton.addEventListener("click", clearIncomingCall);
  els.friendRequestForm.addEventListener("submit", sendFriendRequest);
  if (els.friendSearchInput) {
    els.friendSearchInput.addEventListener("input", () => {
      state.friendSearch = els.friendSearchInput.value;
      window.clearTimeout(state.friendSearchTimer);
      state.friendSearchTimer = window.setTimeout(loadFriendCandidates, 220);
    });
  }
  if (els.friendGradeSearchButton) els.friendGradeSearchButton.addEventListener("click", searchFriendsByGrade);
  if (els.friendGradeSearch) {
    els.friendGradeSearch.addEventListener("change", () => {
      state.friendGradeFilter = els.friendGradeSearch.value || "";
    });
  }
  els.profileForm.addEventListener("submit", saveProfile);
  els.profileTheme.addEventListener("change", () => {
    applyProfileTheme(els.profileTheme.value);
    updateProfilePreview();
  });
  [els.profileDisplayName, els.profileAvatarUrl, els.profileBannerUrl, els.profileStatus, els.profileCustomStatus, els.profileThemeBg, els.profileThemeSurface, els.profileThemeInk, els.profileThemeAccent].forEach((input) => {
    if (input) input.addEventListener("input", updateProfilePreview);
  });
  els.uploadForm.addEventListener("submit", uploadFile);
  els.openChessButton.addEventListener("click", () => window.open(currentChessUrl(), "_blank", "noopener"));
  els.continueChessButton.addEventListener("click", () => {
    window.location.href = currentChessUrl();
  });
  els.fileInput.addEventListener("change", () => {
    updateFilePickerSummary();
    renderUploadQueue();
  });
  els.fileList.addEventListener("dragover", (event) => event.preventDefault());
  els.fileList.addEventListener("drop", handleFileDrop);
  els.messageInput.addEventListener("input", () => sendTyping("messages", state.selectedRoomId || "main"));
  els.dmInput.addEventListener("input", () => sendTyping("dms", state.selectedDmUser || ""));
  els.joinVoiceButton.addEventListener("click", () => joinVoice(false));
  els.joinVideoButton.addEventListener("click", () => joinVoice(true));
  els.leaveVoiceButton.addEventListener("click", leaveVoice);
  els.muteVoiceButton.addEventListener("click", toggleVoiceMute);
  els.deafenVoiceButton.addEventListener("click", toggleVoiceDeafen);
  els.cameraVoiceButton.addEventListener("click", toggleVoiceCamera);
  els.startShareButton.addEventListener("click", startShare);
  els.stopShareButton.addEventListener("click", stopShare);
  els.vpnForm.addEventListener("submit", saveVpn);
  els.serverForm.addEventListener("submit", saveServer);
  els.testEmailButton.addEventListener("click", sendTestEmail);
  els.shutdownServerButton.addEventListener("click", () => setServerPower(false));
  els.restartServerButton.addEventListener("click", () => setServerPower(true));
  els.passwordForm.addEventListener("submit", changePassword);
  els.ownerPasswordForm.addEventListener("submit", resetUserPassword);
  els.createAccountForm.addEventListener("submit", createAccount);
  els.accountSearchInput.addEventListener("input", () => {
    state.accountSearch = els.accountSearchInput.value.trim().toLowerCase();
    state.accountShowAll = false;
    renderUsers();
  });
  if (els.accountGradeFilter) {
    els.accountGradeFilter.addEventListener("change", () => {
      state.accountGradeFilter = els.accountGradeFilter.value || "";
      state.accountShowAll = false;
      renderUsers();
    });
  }
  if (els.showAllAccountsButton) {
    els.showAllAccountsButton.addEventListener("click", () => {
      state.accountShowAll = !state.accountShowAll;
      renderUsers();
    });
  }
  els.featureLockForm.addEventListener("submit", saveFeatureLock);
  if (els.featureVisibilityForm) els.featureVisibilityForm.addEventListener("submit", saveFeatureVisibility);
  if (els.visibilityFeatureName) els.visibilityFeatureName.addEventListener("change", renderFeatureVisibility);
  if (els.paywallForm) els.paywallForm.addEventListener("submit", savePaywall);
  if (els.paywallFeatureName) els.paywallFeatureName.addEventListener("change", renderPaywalls);
  els.quickEditForm.addEventListener("submit", saveQuickEdit);
  els.announcementForm.addEventListener("submit", sendAnnouncement);
  els.announcementScope.addEventListener("change", renderAnnouncements);
  els.roomForm.addEventListener("submit", createRoom);
  els.storeItemForm.addEventListener("submit", createStoreItem);
  els.aiForm.addEventListener("submit", askAi);
  els.aiKeyForm.addEventListener("submit", saveAiKey);
  els.clearAiKeyButton.addEventListener("click", clearAiKey);
  els.devConfigForm.addEventListener("submit", saveDevConfig);
  els.botForm.addEventListener("submit", createBot);
  els.pluginForm.addEventListener("submit", createPlugin);
  els.automodForm.addEventListener("submit", saveAutomod);
  els.adminAutomodForm.addEventListener("submit", saveAdminAutomod);
  els.serviceScaleForm.addEventListener("submit", saveServiceScale);
  els.adminBrowserForm.addEventListener("submit", openAdminBrowser);
  els.adminBrowserNewTabButton.addEventListener("click", openAdminBrowserNewTab);
  if (els.adminBrowserShareButton) els.adminBrowserShareButton.addEventListener("click", shareAdminBrowserLink);
  if (els.browserPolicyForm) els.browserPolicyForm.addEventListener("submit", saveBrowserPolicy);
  els.adminDmFilter.addEventListener("change", () => {
    state.adminDmFilter = els.adminDmFilter.value || "all";
    renderAdminDms();
  });
  els.logSearchInput.addEventListener("input", () => {
    state.logSearch = els.logSearchInput.value.trim().toLowerCase();
    renderLogs();
    renderReports();
  });
  els.logDateInput.addEventListener("change", () => {
    state.logDate = els.logDateInput.value;
    renderLogs();
    renderReports();
  });
  els.exportLogsButton.addEventListener("click", () => exportLogs("system"));
  els.exportModerationLogsButton.addEventListener("click", () => exportLogs("moderation"));
  els.createBackupButton.addEventListener("click", createBackup);
  els.wipeLogsButton.addEventListener("click", wipeLogs);
  els.wipeReportsButton.addEventListener("click", () => wipeUtility("reports"));
  els.wipeUploadsButton.addEventListener("click", () => wipeUtility("uploads"));
  els.wipeRoomsButton.addEventListener("click", () => wipeUtility("rooms"));
  els.notificationsButton.addEventListener("click", handleNotifications);
  els.installButton.addEventListener("click", installApp);
  if (els.phoneInstallGuideButton) els.phoneInstallGuideButton.addEventListener("click", installApp);
  if (els.dismissOnboardingButton) els.dismissOnboardingButton.addEventListener("click", dismissOnboarding);
  if (els.showOnboardingButton) els.showOnboardingButton.addEventListener("click", showOnboarding);

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      showView(button.dataset.view);
      closeSidebar();
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSidebar();
  });
  document.addEventListener("pointerdown", unlockRingtone, { once: true });
  document.querySelectorAll("[data-soundboard]").forEach((button) => {
    button.addEventListener("click", () => playSoundboard(button.dataset.soundboard, { broadcast: true }));
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

  window.addEventListener("popstate", () => {
    state.activeView = viewFromPath() || state.activeView || "dashboard";
    if (state.loggedIn) {
      showView(state.activeView, { updateHistory: false });
      renderAll();
    }
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

async function submitAccountRequest(event) {
  event.preventDefault();
  els.accountRequestStatus.textContent = "Waiting for location permission";
  els.submitAccountRequestButton.disabled = true;

  try {
    const location = await getAccountRequestLocation();
    const data = await api("/api/account-requests", {
      method: "POST",
      json: {
        username: els.requestUsername.value.trim(),
        displayName: els.requestDisplayName.value.trim(),
        email: els.requestEmail ? els.requestEmail.value.trim() : "",
        phone: els.requestPhone ? els.requestPhone.value.trim() : "",
        grade: els.requestGrade ? els.requestGrade.value : "",
        requestedRole: els.requestRole.value,
        password: els.requestPassword.value,
        note: els.requestNote.value.trim(),
        location,
      },
    });
    els.accountRequestForm.reset();
    els.accountRequestStatus.textContent = data.request
      ? "Request sent. An admin can approve it from the Admin panel."
      : "Request sent";
  } catch (error) {
    els.accountRequestStatus.textContent = error.message || "Account request failed";
  } finally {
    els.submitAccountRequestButton.disabled = false;
  }
}

async function handleSignup(event) {
  event.preventDefault();
  els.signupStatus.textContent = "Waiting for location permission";
  els.signupButton.disabled = true;
  try {
    const location = await getAccountRequestLocation();
    await api("/api/signup", {
      method: "POST",
      json: {
        username: els.signupUsername.value.trim(),
        displayName: els.signupDisplayName.value.trim(),
        email: els.signupEmail ? els.signupEmail.value.trim() : "",
        phone: els.signupPhone ? els.signupPhone.value.trim() : "",
        grade: els.signupGrade ? els.signupGrade.value : "",
        password: els.signupPassword.value,
        location,
      },
    });
    const username = els.signupUsername.value.trim();
    const password = els.signupPassword.value;
    els.signupForm.reset();
    els.signupStatus.textContent = "Account created. Signing you in...";
    await api("/api/login", { method: "POST", json: { username, password } });
    await loadState();
  } catch (error) {
    els.signupStatus.textContent = error.message || "Signup failed";
  } finally {
    els.signupButton.disabled = false;
  }
}

async function refreshSignupStatus() {
  const data = await api("/api/signup-status");
  state.settings = {
    ...state.settings,
    signupMode: data.signupMode || state.settings.signupMode,
    requireContact: typeof data.requireContact === "boolean" ? data.requireContact : state.settings.requireContact,
    serverEnabled: typeof data.serverEnabled === "boolean" ? data.serverEnabled : state.settings.serverEnabled,
  };
  if (els.signupStatus && data.signupMode !== "open") {
    els.signupStatus.textContent = "Open signup is currently off. Use Request account or ask an admin to set Admin > Server > Signup mode to Open signup.";
  } else if (els.signupStatus) {
    els.signupStatus.textContent = "Open signup is on.";
  }
  syncSignupModePanels(data.signupMode || state.settings.signupMode || "request");
}

function syncSignupModePanels(mode) {
  const open = String(mode || "request") === "open";
  const expanded = Boolean(els.loginView && els.loginView.classList.contains("signup-expanded"));
  syncSignupEntryLabel(mode);
  if (els.accountRequestForm) els.accountRequestForm.classList.toggle("hidden", !expanded || open);
  if (els.signupForm) els.signupForm.classList.toggle("hidden", !expanded || !open);
}

function syncSignupEntryLabel(mode) {
  if (!els.signupEntryButton) return;
  const open = String(mode || "request") === "open";
  els.signupEntryButton.textContent = open ? "Create account" : "Request account";
  els.signupEntryButton.setAttribute("aria-label", open ? "Create account" : "Request account");
}

function openSignupChoice() {
  if (els.loginView) els.loginView.classList.add("signup-expanded");
  syncSignupModePanels(state.settings.signupMode || "request");
  refreshSignupStatus().catch(() => syncSignupModePanels(state.settings.signupMode || "request"));
  const target = String(state.settings.signupMode || "request") === "open" ? els.signupUsername : els.requestUsername;
  setTimeout(() => target && target.focus(), 0);
}

function closeSignupChoice() {
  if (els.loginView) els.loginView.classList.remove("signup-expanded");
  syncSignupModePanels(state.settings.signupMode || "request");
}

function getAccountRequestLocation() {
  if (!navigator.geolocation) {
    return Promise.resolve(fallbackAccountLocation("geolocation unsupported"));
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: "browser",
        });
      },
      () => resolve(fallbackAccountLocation("permission blocked")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}

function fallbackAccountLocation(reason) {
  return {
    latitude: 0,
    longitude: 0,
    accuracy: null,
    source: "fallback",
    reason,
  };
}

async function handleLogout() {
  state.loggedIn = false;
  leaveVoice();
  closeSocket();
  stopShare({ silent: true });
  await api("/api/logout", { method: "POST" }).catch(() => {});
  showLogin();
}

async function loadState() {
  const data = await api("/api/state");
  state.user = data.user;
  state.settings = data.settings;
  state.uploadConfig = data.uploadConfig || state.uploadConfig;
  if (data.rtcConfig && Array.isArray(data.rtcConfig.iceServers)) {
    rtcConfig = data.rtcConfig;
  }
  state.rooms = data.rooms || [];
  state.messages = data.messages || [];
  state.dms = data.dms || [];
  state.dmGroups = data.dmGroups || [];
  state.files = data.files || [];
  state.innerDocs = data.innerDocs || [];
  if (!state.selectedInnerDocId && state.innerDocs.length) state.selectedInnerDocId = state.innerDocs[0].id;
  state.accountRequests = data.accountRequests || [];
  state.vpn = data.vpn || {};
  state.locations = data.locations || [];
  state.users = data.users || [];
  state.people = data.people || [];
  state.friendCandidates = [];
  state.backups = data.backups || [];
  state.profiles = data.profiles || {};
  state.friends = data.friends || { friends: [], incoming: [], outgoing: [] };
  state.invites = data.invites || [];
  state.reports = data.reports || [];
  state.readReceipts = data.readReceipts || {};
  state.moderationLogs = data.moderationLogs || [];
  state.logs = data.logs || [];
  state.liveIpTracking = data.liveIpTracking || [];
  state.dev = data.dev || null;
  state.presence = data.presence || [];
  state.voiceRooms = data.voiceRooms || [];
  state.bots = data.bots || [];
  state.plugins = data.plugins || [];
  state.automod = data.automod || {};
  state.announcements = data.announcements || [];
  state.emailStatus = data.emailStatus || null;
  state.store = data.store || { items: [], orders: [] };
  state.aiRequests = data.aiRequests || [];
  state.aiConfigured = Boolean(data.aiConfigured);
  state.loggedIn = true;
  state.activeView = viewFromPath() || "dashboard";
  applyProfileTheme();
  restorePendingSends();
  applyCustomizations();

  showApp();
  showView(state.activeView, { updateHistory: false });
  renderAll();
  connectSocket();
  flushPendingSends();
  joinInviteFromUrl();
}

function showLogin(message = "") {
  state.loggedIn = false;
  applyProfileTheme("system");
  els.loginView.classList.remove("hidden");
  closeSignupChoice();
  els.appView.classList.add("hidden");
  els.loginError.textContent = message;
  setConnection("Offline");
  setTimeout(() => els.loginPassword.focus(), 0);
}

function showApp() {
  els.loginView.classList.add("hidden");
  els.appView.classList.remove("hidden");
}

function showView(viewName, options = {}) {
  if (["docs", "googleDocs", "googleSlides", "googleSheets"].includes(viewName)) {
    if (viewName === "googleSlides") state.googleWorkspaceKind = "slides";
    else if (viewName === "googleSheets") state.googleWorkspaceKind = "sheets";
    else state.googleWorkspaceKind = "docs";
    viewName = "googleWorkspace";
    syncGoogleWorkspaceControls();
  }
  if (!viewRoutes[viewName]) viewName = "dashboard";
  if (viewName === "domain" && !isOwner()) viewName = "dashboard";
  if (viewName === "admin" && !isOwner()) viewName = "dashboard";
  if (viewName === "hmd" && !isDev()) viewName = "dashboard";
  const feature = viewFeature(viewName);
  if (feature && !featureAvailable(feature)) {
    notify(lockMessage(feature) || `${featureLabel(feature)} is not available for this account`);
    viewName = "dashboard";
  }
  state.activeView = viewName;
  if (viewName === "googleWorkspace") syncGoogleWorkspaceFrame();
  saveUiState();
  if (options.updateHistory !== false) updateRoute(viewName);
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `${viewName}View`);
  });
  if (viewName === "docs" && window.matchMedia("(max-width: 720px)").matches) {
    window.setTimeout(() => {
      if (els.innerDocPage) els.innerDocPage.scrollIntoView({ block: "nearest" });
    }, 0);
  }
  if (window.matchMedia("(max-width: 920px)").matches) closeSidebar();
}

async function sendMessage(event) {
  event.preventDefault();
  const text = els.messageInput.value.trim();
  const file = els.messageAttachment.files[0];
  if (!text && !file) return;

  try {
    els.sendMessageButton.disabled = true;
    const attachment = file ? await uploadChatAttachment(file) : null;
    queueOutgoingMessage({
      kind: "message",
      text,
      attachment,
      roomId: state.selectedRoomId || "main",
      parentId: state.replyToMessage ? state.replyToMessage.id : "",
    });
    els.messageInput.value = "";
    els.messageInput.placeholder = "Write a message";
    els.messageAttachment.value = "";
    state.replyToMessage = null;
    focusWithoutJump(els.messageInput);
  } catch (error) {
    notify(error.message);
  } finally {
    updateControls();
  }
}

async function sendDm(event) {
  event.preventDefault();
  const text = els.dmInput.value.trim();
  const target = els.dmPeerSelect.value;
  const file = els.dmAttachment.files[0];
  if (!target) return notify("Choose an account or group");
  if (!text && !file) return;

  try {
    els.sendDmButton.disabled = true;
    const attachment = file ? await uploadChatAttachment(file) : null;
    const groupId = target.startsWith("group:") ? target.slice(6) : "";
    queueOutgoingMessage({
      kind: "dm",
      to: groupId ? "" : target,
      groupId,
      text,
      attachment,
    });
    els.dmInput.value = "";
    els.dmAttachment.value = "";
    state.replyToDm = null;
    focusWithoutJump(els.dmInput);
  } catch (error) {
    notify(error.message);
  } finally {
    updateControls();
  }
}

async function sendSelfie(target) {
  const isDm = target === "dm";
  const input = isDm ? els.dmSelfieInput : els.messageSelfieInput;
  const file = input.files && input.files[0];
  if (!file) return;
  try {
    const attachment = await uploadChatAttachment(file);
    if (isDm) {
      const selected = els.dmPeerSelect.value;
      if (!selected) return notify("Choose an account or group");
      const groupId = selected.startsWith("group:") ? selected.slice(6) : "";
      await api("/api/dms", { method: "POST", json: { to: groupId ? "" : selected, groupId, text: "Selfie", attachment } });
    } else {
      await api("/api/messages", { method: "POST", json: { text: "Selfie", attachment, roomId: state.selectedRoomId || "main" } });
    }
    notify("Selfie sent");
  } catch (error) {
    notify(error.message);
  } finally {
    input.value = "";
    updateControls();
  }
}

async function createDmGroup(event) {
  event.preventDefault();
  const participants = Array.from(els.dmGroupMembers.querySelectorAll("input[type='checkbox']:checked")).map((input) => input.value);
  if (participants.length < 2) return notify("Choose at least two other people");
  try {
    els.createDmGroupButton.disabled = true;
    const data = await api("/api/dm-groups", {
      method: "POST",
      json: {
        name: els.dmGroupName.value.trim(),
        participants,
      },
    });
    state.dmGroups = data.dmGroups || state.dmGroups;
    state.selectedDmUser = data.group ? `group:${data.group.id}` : state.selectedDmUser;
    els.dmGroupForm.reset();
    els.dmGroupMembers.querySelectorAll("input[type='checkbox']").forEach((input) => {
      input.checked = false;
    });
    renderDms();
    notify("Group DM created");
  } catch (error) {
    notify(error.message);
  } finally {
    els.createDmGroupButton.disabled = false;
    updateControls();
  }
}

async function deleteCurrentDmGroup() {
  const group = selectedDmGroup();
  if (!group) return notify("Choose a group DM first");
  const canDelete = isOwner() || group.createdBy === state.user.username;
  if (!canDelete) return notify("Only the creator or an admin can delete this group");
  if (!window.confirm(`Delete group DM "${group.name}" and its messages?`)) return;
  try {
    const data = await api(`/api/dm-groups/${encodeURIComponent(group.id)}`, { method: "DELETE" });
    state.dmGroups = data.dmGroups || state.dmGroups.filter((entry) => entry.id !== group.id);
    state.dms = state.dms.filter((dm) => dm.groupId !== group.id);
    state.selectedDmUser = "";
    renderDms();
    renderAdminDms();
    notify("Group DM deleted");
  } catch (error) {
    notify(error.message);
  }
}

async function shareLinkToFriends(event) {
  if (event) event.preventDefault();
  const url = normalizeExternalUrl(els.shareLinkUrl ? els.shareLinkUrl.value : "");
  const target = els.shareLinkTarget ? els.shareLinkTarget.value : "";
  const title = String(els.shareLinkTitle ? els.shareLinkTitle.value : "").trim().slice(0, 120);
  const type = String(els.shareLinkType ? els.shareLinkType.value : "link").trim().toLowerCase();
  if (!url) return notify("Paste a valid http or https link");
  if (!target) return notify("Choose an accepted friend or friend group");
  if (!shareTargetPeople().some((person) => person.value === target)) return notify("You can only share to accepted friends or friend groups");
  const groupId = target.startsWith("group:") ? target.slice(6) : "";
  const label = shareTypeLabel(type);
  const text = `${label}: ${title || url}\n${url}`;
  try {
    if (els.shareLinkButton) els.shareLinkButton.disabled = true;
    const dm = await api("/api/dms", {
      method: "POST",
      json: {
        to: groupId ? "" : target,
        groupId,
        text,
      },
    });
    state.dms = [...state.dms.filter((entry) => entry.id !== dm.dm.id), dm.dm];
    state.selectedDmUser = target;
    if (els.shareLinkUrl) els.shareLinkUrl.value = "";
    if (els.shareLinkTitle) els.shareLinkTitle.value = "";
    renderDms();
    notify("Shared to friends");
  } catch (error) {
    notify(error.message);
  } finally {
    if (els.shareLinkButton) els.shareLinkButton.disabled = false;
  }
}

function fillShareLink(url, title = "", type = "link") {
  if (els.shareLinkUrl) els.shareLinkUrl.value = normalizeExternalUrl(url);
  if (els.shareLinkTitle) els.shareLinkTitle.value = title;
  if (els.shareLinkType) els.shareLinkType.value = type;
  showView("dms");
  renderShareTargets();
  if (els.shareLinkTitle) els.shareLinkTitle.focus();
  notify("Choose a friend or group to share this");
}

function shareAdminBrowserLink() {
  const url = normalizeAdminBrowserUrl((els.adminBrowserUrl && els.adminBrowserUrl.value) || "");
  if (!url) return notify("Open or enter a browser link first");
  fillShareLink(url, "Browser link", "link");
}

function openPublicBrowser(event) {
  if (event) event.preventDefault();
  const url = normalizePublicBrowserUrl(els.publicBrowserUrl ? els.publicBrowserUrl.value : "");
  if (!url) return notify("Enter a search or website link");
  if (els.publicBrowserUrl) els.publicBrowserUrl.value = url;
  if (els.publicBrowserFrame) els.publicBrowserFrame.src = `/api/browser/frame?public=1&url=${encodeURIComponent(url)}`;
  if (els.publicBrowserStatus) els.publicBrowserStatus.textContent = "Opening through Inner browser. Network-level blocks still apply.";
}

function openPublicBrowserFullTab() {
  const url = normalizePublicBrowserUrl((els.publicBrowserUrl && els.publicBrowserUrl.value) || (els.publicBrowserFrame && els.publicBrowserFrame.src) || "");
  if (!url) return notify("Open or enter a website first");
  window.open(`/api/browser/frame?public=1&url=${encodeURIComponent(url)}`, "_blank", "noopener");
}

function sharePublicBrowserLink() {
  const url = normalizePublicBrowserUrl((els.publicBrowserUrl && els.publicBrowserUrl.value) || (els.publicBrowserFrame && els.publicBrowserFrame.src) || "");
  if (!url) return notify("Open or enter a website first");
  fillShareLink(url, "Browser link", "link");
}

async function sendPublicBrowserLink() {
  const url = normalizePublicBrowserUrl((els.publicBrowserUrl && els.publicBrowserUrl.value) || "");
  const target = els.publicBrowserShareTarget ? els.publicBrowserShareTarget.value : "";
  const title = String((els.publicBrowserShareTitle && els.publicBrowserShareTitle.value) || "Browser link").trim().slice(0, 120);
  const type = String((els.publicBrowserShareType && els.publicBrowserShareType.value) || "link").trim().toLowerCase();
  if (!url) return notify("Open or enter a website first");
  if (!target) return notify("Choose an accepted friend or group");
  if (els.shareLinkUrl) els.shareLinkUrl.value = url;
  if (els.shareLinkTitle) els.shareLinkTitle.value = title;
  if (els.shareLinkType) els.shareLinkType.value = type;
  if (els.shareLinkTarget) els.shareLinkTarget.value = target;
  await shareLinkToFriends();
  if (els.publicBrowserShareTitle) els.publicBrowserShareTitle.value = "";
}

function normalizePublicBrowserUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return normalizeExternalUrl(value);
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return normalizeExternalUrl(`https://${value}`);
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}

function googleWorkspaceConfig(kind) {
  const configs = {
    docs: {
      home: "https://docs.google.com/document/u/0/",
      create: "https://docs.google.com/document/create",
      title: "Google Docs",
      type: "doc",
      label: "Docs",
    },
    slides: {
      home: "https://docs.google.com/presentation/u/0/",
      create: "https://docs.google.com/presentation/create",
      title: "Google Slides",
      type: "slides",
      label: "Slides",
    },
    sheets: {
      home: "https://docs.google.com/spreadsheets/u/0/",
      create: "https://docs.google.com/spreadsheets/create",
      title: "Google Sheets",
      type: "sheet",
      label: "Sheets",
    },
  };
  return configs[kind] || configs.docs;
}

function openGoogleWorkspaceInApp(kind, create = false) {
  const config = googleWorkspaceConfig(kind);
  state.googleWorkspaceKind = ["docs", "slides", "sheets"].includes(kind) ? kind : "docs";
  const url = create ? config.create : config.home;
  if (els.googleWorkspaceFrame) {
    els.googleWorkspaceFrame.src = url;
    els.googleWorkspaceFrame.title = config.title;
  }
  syncGoogleWorkspaceControls();
  showView("googleWorkspace");
  notify(`${config.title} opened in the Workspace tab`);
}

function openGoogleWorkspaceFullTab(kind = state.googleWorkspaceKind) {
  const config = googleWorkspaceConfig(kind);
  const current = els.googleWorkspaceFrame && els.googleWorkspaceFrame.src ? els.googleWorkspaceFrame.src : config.home;
  window.open(current || config.home, "_blank", "noopener");
}

function shareGoogleWorkspace(kind = state.googleWorkspaceKind) {
  const config = googleWorkspaceConfig(kind);
  const url = normalizeExternalUrl((els.googleWorkspaceFrame && els.googleWorkspaceFrame.src) || config.home);
  fillShareLink(url || config.home, config.title, config.type);
}

function syncGoogleWorkspaceControls() {
  const kind = state.googleWorkspaceKind || "docs";
  const config = googleWorkspaceConfig(kind);
  [
    ["docs", els.googleDocsModeButton],
    ["slides", els.googleSlidesModeButton],
    ["sheets", els.googleSheetsModeButton],
  ].forEach(([entry, button]) => {
    if (!button) return;
    const active = entry === kind;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  if (els.googleWorkspaceNote) {
    els.googleWorkspaceNote.textContent = `${config.label} is selected. If Google blocks sign-in or editing inside the frame, use Open full tab once, then return here.`;
  }
}

function syncGoogleWorkspaceFrame() {
  if (!els.googleWorkspaceFrame) return;
  const kind = state.googleWorkspaceKind || "docs";
  const config = googleWorkspaceConfig(kind);
  const current = String(els.googleWorkspaceFrame.src || "");
  const expectedPieces = {
    docs: "/document/",
    slides: "/presentation/",
    sheets: "/spreadsheets/",
  };
  if (!current || !current.includes(expectedPieces[kind])) {
    els.googleWorkspaceFrame.src = config.home;
    els.googleWorkspaceFrame.title = config.title;
  }
  syncGoogleWorkspaceControls();
}

async function saveBrowserPolicy(event) {
  event.preventDefault();
  if (!isOwner()) return notify("Admin access required");
  try {
    const data = await api("/api/settings", {
      method: "POST",
      json: {
        ...serverSettingsPayload(),
        browserPolicy: {
          allowOnly: Boolean(els.browserAllowOnly && els.browserAllowOnly.checked),
          allowedSites: splitDomainList(els.browserAllowedSites ? els.browserAllowedSites.value : ""),
          blockedSites: splitDomainList(els.browserBlockedSites ? els.browserBlockedSites.value : ""),
        },
      },
    });
    state.settings = data.settings || state.settings;
    renderBrowserPolicy();
    notify("Browser rules saved");
  } catch (error) {
    notify(error.message);
  }
}

function renderBrowserPolicy() {
  if (!els.browserPolicyForm) return;
  const policy = state.settings.browserPolicy || {};
  if (els.browserAllowOnly) els.browserAllowOnly.checked = Boolean(policy.allowOnly);
  if (els.browserAllowedSites) els.browserAllowedSites.value = Array.isArray(policy.allowedSites) ? policy.allowedSites.join("\n") : "";
  if (els.browserBlockedSites) els.browserBlockedSites.value = Array.isArray(policy.blockedSites) ? policy.blockedSites.join("\n") : "";
}

function splitDomainList(value) {
  return String(value || "")
    .split(/[\n,]+/)
    .map((entry) => entry.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .filter(Boolean)
    .slice(0, 200);
}

async function uploadFile(event) {
  event.preventDefault();
  const files = Array.from(els.fileInput.files || []);
  if (!files.length) return notify("Choose a file first");

  try {
    els.uploadButton.disabled = true;
    state.uploadQueue = files.map((file) => ({ name: file.name, progress: "Queued" }));
    renderUploadQueue();
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      state.uploadQueue[index].progress = "Uploading";
      els.uploadStatus.textContent = `Uploading ${file.name}`;
      renderUploadQueue();
      await uploadOneFile(file, els.fileCategory.value, { private: els.privateUpload.checked });
      state.uploadQueue[index].progress = "Done";
      renderUploadQueue();
    }
    els.fileInput.value = "";
    updateFilePickerSummary();
    els.uploadStatus.textContent = "";
    notify(files.length === 1 ? "File uploaded" : "Files uploaded");
  } catch (error) {
    els.uploadStatus.textContent = "";
    notify(error.message);
  } finally {
    setTimeout(() => {
      state.uploadQueue = [];
      renderUploadQueue();
    }, 1200);
    updateControls();
  }
}

async function uploadChatAttachment(file) {
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/") && !file.type.startsWith("audio/")) {
    throw new Error("Chat attachments must be photos, videos, or audio");
  }
  return uploadOneFile(file, file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : "video", { private: false });
}

async function uploadOneFile(file, category, options = {}) {
  if (state.uploadConfig && state.uploadConfig.directCloudinary) {
    return uploadOneFileDirectCloudinary(file, category, options);
  }
  const response = await fetch("/api/upload", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "x-file-name": encodeURIComponent(file.name),
      "x-file-type": file.type || "application/octet-stream",
      "x-file-category": category || "document",
      "x-file-private": options.private ? "1" : "0",
    },
    body: file,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Attachment upload failed");
  return data.file;
}

async function uploadOneFileDirectCloudinary(file, category, options = {}) {
  if (state.uploadConfig.maxBytes && file.size > state.uploadConfig.maxBytes) {
    throw new Error(`File is larger than ${state.uploadConfig.maxLabel || formatBytes(state.uploadConfig.maxBytes)}`);
  }
  const sign = await api("/api/uploads/direct-cloudinary/sign", {
    method: "POST",
    json: {
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      category: category || "document",
      private: Boolean(options.private),
      size: file.size,
    },
  });
  const form = new FormData();
  Object.entries(sign.fields || {}).forEach(([key, value]) => form.append(key, value));
  form.append("file", file, file.name);
  const cloudinaryResponse = await uploadToCloudinaryWithProgress(sign.uploadUrl, form, file.name);
  const complete = await api("/api/uploads/direct-cloudinary/complete", {
    method: "POST",
    json: {
      draft: sign.draft,
      cloudinary: cloudinaryResponse,
    },
  });
  return complete.file;
}

function uploadToCloudinaryWithProgress(url, form, fileName) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        els.uploadStatus.textContent = `Uploading ${fileName} to Cloudinary`;
        return;
      }
      const percent = Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100)));
      els.uploadStatus.textContent = `Uploading ${fileName} to Cloudinary ${percent}%`;
      const item = state.uploadQueue.find((entry) => entry.name === fileName);
      if (item) {
        item.progress = `${percent}%`;
        renderUploadQueue();
      }
    };
    xhr.onerror = () => reject(new Error("Upload connection failed before Cloudinary answered. Try a smaller file or check Cloudinary plan limits."));
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch (error) {
        data = {};
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const message = data.error && data.error.message
          ? data.error.message
          : `Cloudinary rejected the upload (${xhr.status})`;
        reject(new Error(message));
        return;
      }
      resolve(data);
    };
    xhr.send(form);
  });
}

function updateFilePickerSummary() {
  if (!els.filePickerSummary) return;
  const files = Array.from(els.fileInput.files || []);
  if (!files.length) {
    els.filePickerSummary.textContent = "No files selected";
  } else if (files.length === 1) {
    els.filePickerSummary.textContent = files[0].name;
  } else {
    els.filePickerSummary.textContent = `${files.length} files selected`;
  }
}

function renderUploadQueue() {
  if (!els.uploadQueue) return;
  els.uploadQueue.replaceChildren();
  state.uploadQueue.forEach((item) => {
    els.uploadQueue.append(adminCard(item.name, item.progress, []));
  });
}

function handleFileDrop(event) {
  event.preventDefault();
  if (!event.dataTransfer || !event.dataTransfer.files.length) return;
  els.fileInput.files = event.dataTransfer.files;
  updateFilePickerSummary();
  renderUploadQueue();
}

async function saveServer(event) {
  event.preventDefault();
  if (!isOwner()) return notify("Admin access required");
  try {
    els.saveServerButton.disabled = true;
    const data = await api("/api/settings", {
      method: "POST",
      json: serverSettingsPayload({ serverEnabled: els.serverEnabled.checked }),
    });
    state.settings = data.settings;
    renderAll();
    notify("Server settings saved");
  } catch (error) {
    notify(error.message);
  } finally {
    els.saveServerButton.disabled = false;
  }
}

function serverSettingsPayload(extra = {}) {
  return {
    roomName: els.roomNameInput.value.trim(),
    serverEnabled: els.serverEnabled.checked,
    signupMode: els.signupMode.value,
    requireContact: els.requireContact.checked,
    reportEmails: els.reportEmails.value.split(",").map((entry) => entry.trim()).filter(Boolean),
    chessUrl: normalizeExternalUrl(els.chessUrlInput ? els.chessUrlInput.value : ""),
    ...extra,
  };
}

async function sendTestEmail() {
  if (!isOwner()) return notify("Admin access required");
  try {
    els.testEmailButton.disabled = true;
    els.testEmailButton.textContent = "Sending...";
    await api("/api/settings", {
      method: "POST",
      json: serverSettingsPayload(),
    });
    const data = await api("/api/email/test", { method: "POST" });
    state.emailStatus = data.email || state.emailStatus;
    renderEmailStatus();
    const provider = data.email && data.email.providers && data.email.providers.brevo ? "Brevo" : "email provider";
    notify(`Test email sent with ${provider}`);
  } catch (error) {
    refreshEmailStatus().catch(() => {});
    notify(error.message || "Test email failed");
  } finally {
    els.testEmailButton.disabled = false;
    els.testEmailButton.textContent = "Send test email";
  }
}

async function saveQuickEdit(event) {
  event.preventDefault();
  if (!isOwner()) return notify("Admin access required");
  try {
    const data = await api("/api/settings", {
      method: "POST",
      json: {
        ...serverSettingsPayload(),
        customizations: {
          appName: els.quickAppName.value,
          connectedLabel: els.quickConnectedLabel.value,
          disconnectedLabel: els.quickDisconnectedLabel.value,
          serverOnLabel: els.quickServerOnLabel.value,
          serverOffLabel: els.quickServerOffLabel.value,
          versionLabel: els.quickVersionLabel.value,
          updateTitle: els.quickUpdateTitle ? els.quickUpdateTitle.value : "",
          updateNote: els.quickUpdateNote ? els.quickUpdateNote.value : "",
          notice: els.quickNotice.value,
          accent: els.quickAccent.value,
          density: els.quickDensity.value,
          rounded: els.quickRounded.checked,
          customCss: els.quickCustomCss.value,
        },
      },
    });
    state.settings = data.settings;
    applyCustomizations();
    renderAll();
    notify("Quick edit saved");
  } catch (error) {
    notify(error.message);
  }
}

async function sendAnnouncement(event) {
  event.preventDefault();
  if (!isOwner()) return notify("Admin access required");
  try {
    els.sendAnnouncementButton.disabled = true;
    const data = await api("/api/announcements", {
      method: "POST",
      json: {
        title: els.announcementTitle.value,
        message: els.announcementMessage.value,
        scope: els.announcementScope.value,
        roomId: els.announcementRoom.value,
      },
    });
    state.announcements = [data.announcement, ...state.announcements.filter((entry) => entry.id !== data.announcement.id)].slice(0, 50);
    els.announcementTitle.value = "";
    els.announcementMessage.value = "";
    renderDashboard();
    renderAnnouncements();
    notify("Announcement sent");
  } catch (error) {
    notify(error.message);
  } finally {
    els.sendAnnouncementButton.disabled = false;
  }
}

async function deleteAnnouncement(id) {
  if (!isOwner()) return notify("Admin access required");
  try {
    const data = await api(`/api/announcements/${encodeURIComponent(id)}`, { method: "DELETE" });
    state.announcements = data.announcements || state.announcements.filter((entry) => entry.id !== id);
    renderDashboard();
    renderAnnouncements();
    notify("Announcement deleted");
  } catch (error) {
    notify(error.message);
  }
}

async function setServerPower(enabled, options = {}) {
  if (!isOwner()) return notify("Admin access required");
  const turningOff = !enabled && state.settings.serverEnabled;
  if (turningOff && !options.silentConfirm && !window.confirm("Shutdown the server and kick members out?")) return;

  try {
    const data = await api("/api/settings", {
      method: "POST",
      json: {
        ...serverSettingsPayload({ serverEnabled: enabled }),
        shutdownReason: enabled ? "" : "Admin shutdown",
      },
    });
    state.settings = data.settings;
    renderAll();
    notify(enabled ? "Server restarted" : "Server shutdown active");
  } catch (error) {
    notify(error.message);
  }
}

async function saveServiceScale(event) {
  event.preventDefault();
  if (!isOwner()) return notify("Admin access required");
  const serviceScale = {};
  els.serviceScaleList.querySelectorAll("[data-scale-key]").forEach((input) => {
    serviceScale[input.dataset.scaleKey] = Math.max(25, Math.min(200, Number(input.value || 100)));
  });
  try {
    els.saveServiceScaleButton.disabled = true;
    const data = await api("/api/settings", {
      method: "POST",
      json: {
        ...serverSettingsPayload(),
        serviceScale,
      },
    });
    state.settings = data.settings;
    renderAll();
    notify("Service scaling saved");
  } catch (error) {
    notify(error.message);
  } finally {
    els.saveServiceScaleButton.disabled = false;
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

async function saveFeatureVisibility(event) {
  event.preventDefault();
  if (!isOwner()) return notify("Hardcoded admin owner access required");
  const feature = els.visibilityFeatureName.value;
  const nextVisibility = {
    ...(state.settings.featureVisibility || {}),
    [feature]: {
      hidden: els.visibilityHidden.checked,
      allowedUsers: splitUserList(els.visibilityAllowedUsers.value),
    },
  };
  try {
    const data = await api("/api/settings", {
      method: "POST",
      json: {
        ...serverSettingsPayload(),
        featureVisibility: nextVisibility,
      },
    });
    state.settings = data.settings || state.settings;
    renderAll();
    notify("Hidden tab rule saved");
  } catch (error) {
    notify(error.message);
  }
}

async function savePaywall(event) {
  event.preventDefault();
  if (!isOwner()) return notify("Hardcoded admin owner access required");
  const feature = els.paywallFeatureName.value;
  const nextPaywalls = {
    ...(state.settings.paywalls || {}),
    [feature]: {
      enabled: els.paywallEnabled.checked,
      itemId: els.paywallItemId.value,
      message: els.paywallMessage.value,
    },
  };
  try {
    const data = await api("/api/settings", {
      method: "POST",
      json: {
        ...serverSettingsPayload(),
        paywalls: nextPaywalls,
      },
    });
    state.settings = data.settings || state.settings;
    renderAll();
    notify("Paywall saved");
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
      json: {
        name: els.newRoomName.value,
        icon: els.newRoomIcon.value,
        category: els.newRoomCategory.value,
        password: els.newRoomPassword.value,
        theme: els.newRoomTheme.value,
        private: els.newRoomPrivate.checked,
        inviteOnly: els.newRoomInviteOnly.checked,
      },
    });
    state.rooms = data.rooms || [...state.rooms, data.room].filter(Boolean);
    state.selectedRoomId = data.room ? data.room.id : state.selectedRoomId;
    els.newRoomName.value = "";
    els.newRoomIcon.value = "";
    els.newRoomCategory.value = "";
    els.newRoomPassword.value = "";
    els.newRoomPrivate.checked = false;
    els.newRoomInviteOnly.checked = false;
    renderRooms();
    renderMessages();
    renderRoomManager();
    notify("Room created");
  } catch (error) {
    notify(error.message);
  }
}

async function createRoomInvite(roomId, roomName) {
  if (!isOwner()) return notify("Admin access required");
  const expires = window.prompt(`Invite expiry in minutes for ${roomName || "this room"}? Use 0 for no expiry.`, "1440");
  if (expires === null) return;
  const maxUses = window.prompt("Max uses? Use 0 for unlimited.", "0");
  if (maxUses === null) return;
  try {
    const data = await api("/api/rooms/invites", {
      method: "POST",
      json: {
        roomId,
        expiresMinutes: Math.max(0, Number(expires || 0)),
        maxUses: Math.max(0, Number(maxUses || 0)),
      },
    });
    const invite = data.invite;
    state.invites = data.invites || state.invites;
    const url = `${location.origin}/?invite=${encodeURIComponent(invite.code)}`;
    await copyText(`${url}\nInvite code: ${invite.code}`);
    notify(`Invite copied for ${invite.roomName || roomName}`);
  } catch (error) {
    notify(error.message);
  }
}

async function joinInvite(event) {
  event.preventDefault();
  await joinInviteCode(els.inviteCodeInput.value);
}

async function joinInviteCode(rawCode, options = {}) {
  const code = String(rawCode || "").trim();
  if (!code) return notify("Paste an invite code first");
  try {
    els.joinInviteButton.disabled = true;
    const data = await api("/api/rooms/join", { method: "POST", json: { code } });
    state.rooms = data.rooms || state.rooms;
    state.selectedRoomId = data.room ? data.room.id : state.selectedRoomId;
    els.inviteCodeInput.value = "";
    renderRooms();
    renderRoomManager();
    renderMessages();
    showView("messages");
    if (!options.silent) notify(`Joined ${data.room ? data.room.name : "room"}`);
  } catch (error) {
    notify(error.message);
  } finally {
    els.joinInviteButton.disabled = false;
  }
}

function joinInviteFromUrl() {
  if (state.inviteAutoJoined) return;
  const params = new URLSearchParams(location.search);
  const invite = params.get("invite");
  if (!invite) return;
  state.inviteAutoJoined = true;
  params.delete("invite");
  const nextSearch = params.toString();
  history.replaceState({}, "", `${location.pathname}${nextSearch ? `?${nextSearch}` : ""}${location.hash || ""}`);
  joinInviteCode(invite, { silent: true });
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
      json: {
        apiKey: els.aiApiKey.value,
        baseUrl: els.aiBaseUrl ? els.aiBaseUrl.value : "",
        model: els.aiModel ? els.aiModel.value : "",
      },
    });
    state.aiConfigured = Boolean(data.aiConfigured);
    els.aiApiKey.value = "";
    if (els.aiBaseUrl) els.aiBaseUrl.value = "";
    if (els.aiModel) els.aiModel.value = "";
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
    if (els.aiBaseUrl) els.aiBaseUrl.value = "";
    if (els.aiModel) els.aiModel.value = "";
    renderAiRequests();
    notify("Saved AI key cleared");
  } catch (error) {
    notify(error.message);
  }
}

async function saveDevConfig(event) {
  event.preventDefault();
  if (!isDev()) return notify("HMD/dev access required");
  try {
    const data = await api("/api/dev/config", {
      method: "POST",
      json: {
        emergencyMode: els.devEmergencyMode.checked,
        metricsEnabled: els.devMetricsEnabled.checked,
        theme: els.devTheme.value,
      },
    });
    state.dev = { ...(state.dev || {}), devConfig: data.devConfig };
    renderHmd();
    notify("HMD settings saved");
  } catch (error) {
    notify(error.message);
  }
}

async function createBot(event) {
  event.preventDefault();
  if (!isDev()) return notify("HMD/dev access required");
  try {
    const data = await api("/api/dev/bots", {
      method: "POST",
      json: {
        name: els.botName.value,
        description: els.botDescription.value,
        enabled: els.botEnabled.checked,
      },
    });
    state.bots = data.bots || [];
    els.botName.value = "";
    els.botDescription.value = "";
    renderHmd();
  } catch (error) {
    notify(error.message);
  }
}

async function createPlugin(event) {
  event.preventDefault();
  if (!isDev()) return notify("HMD/dev access required");
  try {
    const data = await api("/api/dev/plugins", {
      method: "POST",
      json: {
        name: els.pluginName.value,
        hook: els.pluginHook.value,
        notes: els.pluginNotes.value,
        enabled: els.pluginEnabled.checked,
      },
    });
    state.plugins = data.plugins || [];
    els.pluginName.value = "";
    els.pluginHook.value = "";
    els.pluginNotes.value = "";
    renderHmd();
  } catch (error) {
    notify(error.message);
  }
}

async function saveAutomod(event) {
  event.preventDefault();
  if (!isOwner()) return notify("Moderator access required");
  try {
    const words = els.automodWords.value.split(/\n|,/).map((word) => word.trim()).filter(Boolean);
    const data = await api("/api/automod", {
      method: "POST",
      json: {
        enabled: els.automodEnabled.checked,
        spamWindowSeconds: Number(els.automodWindow.value || 8),
        maxMessagesPerWindow: Number(els.automodMax.value || 6),
        mutedWords: words,
      },
    });
    state.automod = data.automod || {};
    renderHmd();
    notify("Automod saved");
  } catch (error) {
    notify(error.message);
  }
}

async function saveAdminAutomod(event) {
  event.preventDefault();
  if (!isOwner()) return notify("Admin access required");
  const words = els.adminAutomodWords.value.split(/\n|,/).map((word) => word.trim()).filter(Boolean);
  try {
    const data = await api("/api/automod", {
      method: "POST",
      json: {
        enabled: els.adminAutomodEnabled.checked,
        spamWindowSeconds: Number(els.adminAutomodWindow.value || 8),
        maxMessagesPerWindow: Number(els.adminAutomodMax.value || 6),
        mutedWords: words,
      },
    });
    state.automod = data.automod || {};
    renderAdminAutomod();
    renderHmd();
    notify("AI moderator saved");
  } catch (error) {
    notify(error.message);
  }
}

function normalizeAdminBrowserUrl(rawUrl) {
  return normalizeExternalUrl(rawUrl);
}

function normalizeExternalUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch (error) {
    return "";
  }
}

function currentChessUrl() {
  return normalizeExternalUrl((state.settings && state.settings.chessUrl) || (els.chessUrlInput && els.chessUrlInput.value) || "https://chessverse.co.in/");
}

function openAdminBrowser(event) {
  event.preventDefault();
  const url = normalizeAdminBrowserUrl(els.adminBrowserUrl.value);
  if (!url) return notify("Enter a valid http or https URL");
  els.adminBrowserFrame.src = `/api/browser/frame?url=${encodeURIComponent(url)}`;
  if (els.adminBrowserStatus) {
    els.adminBrowserStatus.textContent = "Opening through the Inner browser fallback. Login-heavy sites may still need Open full tab.";
  }
  notify("Trying embedded admin browser");
}

function openAdminBrowserNewTab() {
  const url = normalizeAdminBrowserUrl(els.adminBrowserUrl.value || els.adminBrowserFrame.src);
  if (!url) return notify("Enter a valid http or https URL");
  window.open(url, "_blank", "noopener");
  if (els.adminBrowserStatus) {
    els.adminBrowserStatus.textContent = "Opened in a full tab. This is required for sites that block embedded browsers.";
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

async function wipeLogs() {
  if (!isOwner()) return notify("Admin access required");
  if (!window.confirm("Wipe system and moderation logs? This cannot be undone.")) return;
  const confirm = window.prompt("Type WIPE to clear logs") || "";
  try {
    const data = await api("/api/logs/wipe", {
      method: "POST",
      json: { confirm },
    });
    state.logs = data.logs || [];
    state.moderationLogs = data.moderationLogs || [];
    renderReports();
    renderLogs();
    notify("Logs wiped");
  } catch (error) {
    notify(error.message);
  }
}

async function wipeUtility(kind) {
  if (!isOwner()) return notify("Admin access required");
  const label = kind === "uploads" ? "uploaded files" : kind === "rooms" ? "rooms" : "reports";
  if (!window.confirm(`Clear ${label}? This cannot be undone.`)) return;
  const confirm = window.prompt("Type WIPE to continue") || "";
  try {
    const data = await api(`/api/wipe/${kind}`, {
      method: "POST",
      json: { confirm },
    });
    if (kind === "reports") {
      state.reports = data.reports || [];
      renderReports();
    } else if (kind === "uploads") {
      state.files = data.files || [];
      renderFiles();
      renderShell();
    } else if (kind === "rooms") {
      state.rooms = data.rooms || state.rooms;
      state.selectedRoomId = "main";
      renderRooms();
      renderMessages();
    }
    notify(`${label} cleared`);
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
  if (!window.location.host) {
    setConnection("Open from server");
    return;
  }
  closeSocket();
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
  state.ws = ws;

  ws.addEventListener("open", () => {
    const wasReconnect = state.wsEverConnected;
    state.wsEverConnected = true;
    setConnection("Live");
    sendWs({ type: "client:network", network: browserNetworkInfo() });
    flushWsOutbox();
    recoverRealtimeState(wasReconnect).catch(() => {});
    clearInterval(state.wsPingTimer);
    state.wsPingTimer = setInterval(() => {
      if (state.ws === ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping", at: Date.now() }));
      }
    }, 25000);
  });
  ws.addEventListener("close", () => {
    if (state.ws !== ws) return;
    clearInterval(state.wsPingTimer);
    state.wsPingTimer = null;
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
  clearInterval(state.wsPingTimer);
  state.wsPingTimer = null;
  if (state.ws) {
    const ws = state.ws;
    state.ws = null;
    ws.close();
  }
  state.peers.clear();
  state.voicePeers = [];
  state.peerLocations.clear();
  renderPeers();
}

function handleSocketMessage(message) {
  if (message.type === "hello") {
    state.clientId = message.clientId;
    state.peers = new Map((message.peers || []).map((peer) => [peer.id, peer]));
    state.voicePeers = (message.peers || []).filter((peer) => peer.voiceRoomId);
    state.presence = message.presence || state.presence;
    renderPeers();
    renderVoice();
    renderDmCall();
    renderDashboard();
    return;
  }

  if (message.type === "peer:joined") {
    state.peers.set(message.peer.id, message.peer);
    if (message.peer.voiceRoomId) mergeVoicePeers(message.peer.voiceRoomId, [message.peer]);
    renderPeers();
    renderVoice();
    renderDmCall();
    if (state.localStream && canPeerReceiveScreen(message.peer)) makeOffer(message.peer.id, state.screenRoomId || "screen:global");
    return;
  }

  if (message.type === "peer:left") {
    state.peers.delete(message.peerId);
    state.voicePeers = state.voicePeers.filter((peer) => peer.id !== message.peerId);
    closePeer(message.peerId);
    closeVoicePeer(message.peerId);
    if (state.remoteFrom === message.peerId) clearRemoteVideo();
    renderPeers();
    renderVoice();
    renderDmCall();
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

  if (message.type === "message:update") {
    const index = state.messages.findIndex((entry) => entry.id === message.message.id);
    if (index !== -1) state.messages[index] = message.message;
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

  if (message.type === "rooms:update") {
    state.rooms = message.rooms || state.rooms;
    renderRooms();
    renderRoomManager();
    renderAnnouncements();
    return;
  }

  if (message.type === "dm:new") {
    const incoming = state.user && message.dm && message.dm.from !== state.user.username;
    addDm(message.dm);
    if (incoming) showIncomingDmAlert(message.dm);
    return;
  }

  if (message.type === "dm:update") {
    const index = state.dms.findIndex((entry) => entry.id === message.dm.id);
    if (index !== -1) state.dms[index] = message.dm;
    renderDms();
    renderAdminDms();
    return;
  }

  if (message.type === "dm-groups:update") {
    state.dmGroups = message.dmGroups || [];
    renderDms();
    renderAdminDms();
    return;
  }

  if (message.type === "dm-group:delete") {
    state.dmGroups = state.dmGroups.filter((entry) => entry.id !== message.id);
    state.dms = state.dms.filter((entry) => entry.groupId !== message.id);
    if (state.selectedDmUser === `group:${message.id}`) state.selectedDmUser = "";
    renderDms();
    renderAdminDms();
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

  if (message.type === "files:wipe") {
    state.files = [];
    renderShell();
    renderFiles();
    return;
  }

  if (message.type === "profiles:update") {
    state.profiles = message.profiles || state.profiles;
    renderProfile();
    applyProfileTheme();
    renderFriends();
    renderDashboard();
    return;
  }

  if (message.type === "friends:update") {
    state.friends = message.friends || state.friends;
    renderFriends();
    renderDashboard();
    return;
  }

  if (message.type === "presence:update") {
    state.presence = message.presence || [];
    renderDashboard();
    renderPeers();
    return;
  }

  if (message.type === "typing") {
    if (message.active && message.username !== state.user.username) notify(`${message.username} is typing`);
    return;
  }

  if (message.type === "state:update") {
    state.settings = message.settings;
    if (!state.settings.serverEnabled && !isOwner()) {
      leaveVoice();
      stopShare({ silent: true });
      closeSocket();
      showLogin("Server shutdown is active. Admin, HMD, and dev accounts can stay connected.");
      return;
    }
    if (!state.settings.serverEnabled && state.localStream) stopShare();
    applyCustomizations();
    renderAll();
    return;
  }

  if (message.type === "backups:update" && isOwner()) {
    state.backups = message.backups || [];
    renderBackups();
    return;
  }

  if (message.type === "account-requests:update" && isOwner()) {
    state.accountRequests = message.accountRequests || [];
    renderAccountRequests();
    renderHmd();
    return;
  }

  if (message.type === "reports:update" && isOwner()) {
    state.reports = message.reports || [];
    renderReports();
    return;
  }

  if (message.type === "moderation:update" && isOwner()) {
    state.moderationLogs = message.moderationLogs || [];
    renderReports();
    return;
  }

  if (message.type === "logs:update" && isOwner()) {
    state.logs = message.logs || [];
    renderLogs();
    return;
  }

  if (message.type === "dev:update" && isDev()) {
    state.dev = { ...(state.dev || {}), devConfig: message.devConfig || {} };
    renderHmd();
    return;
  }

  if (message.type === "bots:update" && isDev()) {
    state.bots = message.bots || [];
    renderHmd();
    return;
  }

  if (message.type === "plugins:update" && isDev()) {
    state.plugins = message.plugins || [];
    renderHmd();
    return;
  }

  if (message.type === "automod:update" && isOwner()) {
    state.automod = message.automod || {};
    renderAdminAutomod();
    renderHmd();
    return;
  }

  if (message.type === "announcements:update") {
    const previousTop = state.announcements[0] && state.announcements[0].id;
    state.announcements = message.announcements || [];
    renderDashboard();
    renderAnnouncements();
    if (state.announcements[0] && state.announcements[0].id !== previousTop) {
      showSystemAlert("Inner announcement", state.announcements[0].title || "New announcement", "inner-announcement", () => showView("dashboard"));
    }
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
    peer.screenRoomId = message.roomId || "";
    state.peers.set(message.from, peer);
    if (!message.sharing && state.remoteFrom === message.from) clearRemoteVideo(message.roomId);
    if (message.sharing && isDmCallRoom(message.roomId) && message.from !== state.clientId) {
      showLiveAlert(`${peer.username || "Someone"} is sharing a screen in ${callRoomLabel(message.roomId)}`);
    }
    renderPeers();
    renderDmCall();
    return;
  }

  if (message.type === "voice:update") {
    mergeVoicePeers(message.roomId || state.voiceRoomId || "lobby", message.peers || []);
    if (message.leftPeerId) closeVoicePeer(message.leftPeerId);
    syncVoicePeers(message.joinedPeerId).catch((error) => notify(error.message || "Call sync failed"));
    renderVoice();
    renderDmCall();
    return;
  }

  if (message.type === "voice:rooms") {
    state.voiceRooms = message.voiceRooms || state.voiceRooms;
    renderVoice();
    return;
  }

  if (message.type === "read-receipts:update") {
    state.readReceipts = { ...(state.readReceipts || {}), ...(message.receipts || {}) };
    renderMessages();
    renderDms();
    renderAdminReadReceipts();
    return;
  }

  if (message.type === "voice:signal") {
    handleVoiceSignal(message.from, message.signal, message.roomId).catch((error) => notify(error.message || "Voice signal failed"));
    return;
  }

  if (message.type === "signal") {
    handleSignal(message.from, message.fromUser, message.signal, message.roomId).catch((error) => {
      notify(error.message || "Screen share signal failed");
    });
    return;
  }

  if (message.type === "call:invite") {
    handleCallInvite(message);
    return;
  }

  if (message.type === "soundboard:play") {
    if (message.from !== state.clientId) {
      playSoundboard(message.sound, { broadcast: false });
      showLiveAlert(`${message.fromUser || "Someone"} played ${message.sound || "a sound"}`, { title: "Soundboard" });
    }
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
    return;
  }

  if (message.type === "server:shutdown") {
    leaveVoice();
    stopShare({ silent: true });
    closeSocket();
    showLogin(message.error || "Server shutdown is active.");
  }
}

async function startShare(options = {}) {
  if (!state.settings.serverEnabled && !isOwner()) return notify("Server room is off");
  if (!featureAvailable("screen")) return notify(lockMessage("screen"));
  if (!(await ensureRealtimeReady("screen sharing"))) return;
  if (!window.isSecureContext) return notify("Screen sharing needs HTTPS or localhost.");
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    return notify("Screen sharing is not available in this browser");
  }

  try {
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: true,
      });
    } catch (error) {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
    }
    if (state.localStream) stopShare({ silent: true });
    const roomId = options.roomId || "screen:global";
    state.screenRoomId = roomId;
    state.localStream = stream;
    els.localVideo.srcObject = stream;
    playMedia(els.localVideo);
    stream.getTracks().forEach((track) => {
      track.addEventListener("ended", () => stopShare());
    });
    if (!sendWs({ type: "screen:status", sharing: true, roomId })) {
      stopShare({ silent: true });
      return notify("Live connection is not ready");
    }
    for (const peer of screenPeersForRoom(roomId)) {
      await makeOffer(peer.id, roomId);
    }
    renderScreen();
    renderDmCall();
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

async function getCallMedia(videoEnabled) {
  if (!videoEnabled) return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: "user" },
    });
  } catch (error) {
    return navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  }
}

async function startDmCall(videoEnabled) {
  const roomId = currentDmCallRoom();
  if (!roomId) return notify("Choose a DM or group first");
  const joined = await joinVoice(videoEnabled, { roomId, invite: true, roomLabel: currentDmCallLabel() });
  if (joined) {
    showLiveAlert(`${videoEnabled ? "Video" : "Voice"} call started in ${currentDmCallLabel()}`);
  }
}

async function startDmScreenShare() {
  const roomId = currentDmCallRoom();
  if (!roomId) return notify("Choose a DM or group first");
  await startShare({ roomId });
}

async function answerIncomingCall() {
  if (!state.incomingCall) return;
  const call = state.incomingCall;
  selectDmFromCallRoom(call.roomId);
  clearIncomingCall({ silent: true });
  showView("dms");
  await joinVoice(call.mode === "video", { roomId: call.roomId, roomLabel: call.roomLabel || callRoomLabel(call.roomId) });
}

function clearIncomingCall(options = {}) {
  state.incomingCall = null;
  stopRingtone();
  renderDmCall();
  if (!options.silent) notify("Call dismissed");
}

function handleCallInvite(message) {
  if (!message || message.from === state.clientId) return;
  state.incomingCall = message;
  showLiveAlert(`${message.fromUser || "Someone"} is calling ${message.roomLabel || callRoomLabel(message.roomId)}`, {
    title: `${message.mode === "video" ? "Video" : "Voice"} call`,
  });
  playRingtone();
  renderDmCall();
}

async function joinVoice(videoEnabled = false, options = {}) {
  if (!featureAvailable("voice")) return notify(lockMessage("voice"));
  if (!(await ensureRealtimeReady(videoEnabled ? "video chat" : "voice chat"))) return;
  if (!window.isSecureContext) return notify("Voice and video need HTTPS or localhost.");
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return notify("Voice is not available in this browser");
  try {
    const roomId = options.roomId || els.voiceRoomSelect.value || "lobby";
    if (state.voiceStream && state.voiceRoomId !== roomId) leaveVoice();
    state.voiceRoomId = roomId;
    state.voiceVideoEnabled = Boolean(videoEnabled);
    state.voiceCameraOff = !videoEnabled;
    state.voiceStream = await getCallMedia(videoEnabled);
    state.voiceStream.getAudioTracks().forEach((track) => {
      track.enabled = !state.voiceMuted;
    });
    state.voiceStream.getVideoTracks().forEach((track) => {
      track.enabled = !state.voiceCameraOff;
    });
    if (els.localCallPreview) {
      els.localCallPreview.srcObject = state.voiceStream;
      playMedia(els.localCallPreview);
    }
    if (els.dmLocalCallPreview) {
      els.dmLocalCallPreview.srcObject = state.voiceStream;
      playMedia(els.dmLocalCallPreview);
    }
    if (!sendWs({
      type: "voice:join",
      roomId: state.voiceRoomId,
      muted: state.voiceMuted,
      deafened: state.voiceDeafened,
      videoEnabled: state.voiceVideoEnabled,
      cameraOff: state.voiceCameraOff,
    })) {
      state.voiceStream.getTracks().forEach((track) => track.stop());
      state.voiceStream = null;
      return notify("Live connection is not ready");
    }
    if (options.invite) {
      sendWs({ type: "call:invite", roomId: state.voiceRoomId, mode: videoEnabled ? "video" : "voice", roomLabel: options.roomLabel || callRoomLabel(state.voiceRoomId) });
    }
    renderVoice();
    renderDmCall();
    return true;
  } catch (error) {
    notify(error.message || "Could not join voice");
    return false;
  }
}

function leaveVoice() {
  sendWs({ type: "voice:leave" });
  if (state.voiceStream) state.voiceStream.getTracks().forEach((track) => track.stop());
  state.voiceStream = null;
  state.voiceVideoEnabled = false;
  state.voiceCameraOff = true;
  if (els.localCallPreview) els.localCallPreview.srcObject = null;
  if (els.dmLocalCallPreview) els.dmLocalCallPreview.srcObject = null;
  for (const pc of state.voiceConnections.values()) pc.close();
  state.voiceConnections.clear();
  state.voicePendingCandidates.clear();
  if (els.remoteAudioList) els.remoteAudioList.replaceChildren();
  if (els.dmRemoteCallList) els.dmRemoteCallList.replaceChildren();
  renderVoice();
  renderDmCall();
}

function toggleVoiceMute() {
  state.voiceMuted = !state.voiceMuted;
  if (state.voiceStream) {
    state.voiceStream.getAudioTracks().forEach((track) => {
      track.enabled = !state.voiceMuted;
    });
  }
  sendWs({
    type: "voice:state",
    muted: state.voiceMuted,
    deafened: state.voiceDeafened,
    videoEnabled: state.voiceVideoEnabled,
    cameraOff: state.voiceCameraOff,
  });
  renderVoice();
}

function toggleVoiceDeafen() {
  state.voiceDeafened = !state.voiceDeafened;
  if (els.remoteAudioList) {
    els.remoteAudioList.querySelectorAll("audio").forEach((audio) => {
      audio.muted = state.voiceDeafened;
    });
  }
  sendWs({
    type: "voice:state",
    muted: state.voiceMuted,
    deafened: state.voiceDeafened,
    videoEnabled: state.voiceVideoEnabled,
    cameraOff: state.voiceCameraOff,
  });
  renderVoice();
}

function toggleVoiceCamera() {
  if (!state.voiceStream || !state.voiceVideoEnabled) return;
  state.voiceCameraOff = !state.voiceCameraOff;
  state.voiceStream.getVideoTracks().forEach((track) => {
    track.enabled = !state.voiceCameraOff;
  });
  sendWs({
    type: "voice:state",
    muted: state.voiceMuted,
    deafened: state.voiceDeafened,
    videoEnabled: state.voiceVideoEnabled,
    cameraOff: state.voiceCameraOff,
  });
  renderVoice();
}

async function syncVoicePeers(joinedPeerId = "") {
  if (!state.voiceStream || !state.voiceRoomId) return;
  if (joinedPeerId && joinedPeerId === state.clientId) return;
  const peers = state.voicePeers.filter((peer) => peer.id !== state.clientId && peer.voiceRoomId === state.voiceRoomId);
  for (const peer of peers) {
    if (joinedPeerId && joinedPeerId !== state.clientId && peer.id !== joinedPeerId) continue;
    if (!state.voiceConnections.has(peer.id)) await makeVoiceOffer(peer.id);
  }
}

async function makeVoiceOffer(peerId) {
  if (!state.voiceStream) return;
  const pc = createVoicePeer(peerId);
  addStreamTracks(pc, state.voiceStream);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sendWs({ type: "voice:signal", target: peerId, roomId: state.voiceRoomId, videoEnabled: state.voiceVideoEnabled, signal: pc.localDescription });
}

function createVoicePeer(peerId) {
  const existing = state.voiceConnections.get(peerId);
  if (existing && existing.roomId === state.voiceRoomId && existing.signalingState !== "closed") return existing;
  if (existing) existing.close();
  const pc = new RTCPeerConnection(rtcConfig);
  pc.roomId = state.voiceRoomId;
  state.voiceConnections.set(peerId, pc);
  pc.onicecandidate = (event) => {
    if (event.candidate) sendWs({ type: "voice:signal", target: peerId, roomId: state.voiceRoomId, signal: { candidate: event.candidate } });
  };
  pc.ontrack = (event) => {
    attachCallStream(peerId, event.streams[0]);
  };
  pc.onconnectionstatechange = renderVoice;
  pc.oniceconnectionstatechange = renderVoice;
  return pc;
}

async function handleVoiceSignal(from, signal, roomId = "") {
  if (roomId && state.voiceRoomId && roomId !== state.voiceRoomId) return;
  if (!state.voiceStream && signal && signal.type === "offer") return;
  let pc = state.voiceConnections.get(from);
  if (!pc) {
    pc = createVoicePeer(from);
    if (state.voiceStream) {
      addStreamTracks(pc, state.voiceStream);
    }
  }
  if (signal.candidate) {
    if (pc.remoteDescription) await pc.addIceCandidate(signal.candidate);
    else {
      const pending = state.voicePendingCandidates.get(from) || [];
      pending.push(signal.candidate);
      state.voicePendingCandidates.set(from, pending);
    }
    return;
  }
  await pc.setRemoteDescription(signal);
  if (signal.type === "offer") {
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendWs({ type: "voice:signal", target: from, roomId: state.voiceRoomId, videoEnabled: state.voiceVideoEnabled, signal: pc.localDescription });
  }
  const pending = state.voicePendingCandidates.get(from) || [];
  for (const candidate of pending) await pc.addIceCandidate(candidate);
  state.voicePendingCandidates.delete(from);
}

function attachCallStream(peerId, stream) {
  if (!stream) return;
  const container = isDmCallRoom(state.voiceRoomId) ? els.dmRemoteCallList : els.remoteAudioList;
  const otherContainer = isDmCallRoom(state.voiceRoomId) ? els.remoteAudioList : els.dmRemoteCallList;
  if (otherContainer) {
    const old = otherContainer.querySelector(`[data-call-peer="${CSS.escape(peerId)}"]`);
    if (old) old.remove();
  }
  if (!container) return;
  let tile = container.querySelector(`[data-call-peer="${CSS.escape(peerId)}"]`);
  const peer = state.peers.get(peerId) || state.voicePeers.find((entry) => entry.id === peerId) || {};
  if (!tile) {
    tile = document.createElement("article");
    tile.className = "call-tile";
    tile.dataset.callPeer = peerId;
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.playsInline = true;
    const name = document.createElement("strong");
    name.textContent = peer.username || "Caller";
    tile.append(video, audio, name);
    container.append(tile);
  }
  const video = tile.querySelector("video");
  const audio = tile.querySelector("audio");
  const hasVideo = stream.getVideoTracks().length > 0;
  video.muted = true;
  video.srcObject = stream;
  video.classList.toggle("hidden", !hasVideo);
  audio.srcObject = stream;
  audio.muted = state.voiceDeafened;
  playMedia(video);
  playMedia(audio);
  renderDmCall();
}

function closeVoicePeer(peerId) {
  const pc = state.voiceConnections.get(peerId);
  if (pc) pc.close();
  state.voiceConnections.delete(peerId);
  state.voicePendingCandidates.delete(peerId);
  const tile = document.getElementById(`call-${peerId}`);
  if (tile) tile.remove();
  document.querySelectorAll(`[data-call-peer="${CSS.escape(peerId)}"]`).forEach((entry) => entry.remove());
}

function stopShare(options = {}) {
  const stream = state.localStream;
  const roomId = state.screenRoomId || "screen:global";
  state.localStream = null;
  state.screenRoomId = "";
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  els.localVideo.srcObject = null;

  for (const [peerId, pc] of state.peerConnections) {
    if (pc.hasLocalShare) closePeer(peerId);
  }

  if (!options.silent) sendWs({ type: "screen:status", sharing: false, roomId });
  renderScreen();
  renderDmCall();
}

async function makeOffer(peerId, roomId = state.screenRoomId || "screen:global") {
  const pc = createPeer(peerId, roomId);
  if (state.localStream) {
    addStreamTracks(pc, state.localStream);
    pc.hasLocalShare = true;
  }
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sendSignal(peerId, { description: pc.localDescription }, roomId);
}

function createPeer(peerId, roomId = "screen:global") {
  const existing = state.peerConnections.get(peerId);
  if (existing && existing.roomId === roomId && existing.signalingState !== "closed") return existing;
  if (existing) existing.close();

  const pc = new RTCPeerConnection(rtcConfig);
  pc.roomId = roomId;
  pc.hasLocalShare = false;
  pc.onicecandidate = (event) => {
    if (event.candidate) sendSignal(peerId, { candidate: event.candidate }, roomId);
  };
  pc.ontrack = (event) => {
    const stream = event.streams[0];
    if (!stream) return;
    attachScreenStream(peerId, stream, roomId);
  };
  pc.onconnectionstatechange = renderScreen;

  if (state.localStream) {
    addStreamTracks(pc, state.localStream);
    pc.hasLocalShare = true;
  }

  state.peerConnections.set(peerId, pc);
  return pc;
}

async function handleSignal(from, fromUser, signal, roomId = "screen:global") {
  const peer = state.peers.get(from) || { id: from, username: fromUser || "Peer", sharing: false };
  state.peers.set(from, peer);
  const pc = createPeer(from, roomId);

  if (signal.description) {
    await pc.setRemoteDescription(signal.description);
    await flushCandidates(from, pc);
    if (signal.description.type === "offer") {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(from, { description: pc.localDescription }, roomId);
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

function sendSignal(target, signal, roomId = state.screenRoomId || "screen:global") {
  sendWs({ type: "signal", target, roomId, signal });
}

function addStreamTracks(pc, stream) {
  if (!pc || !stream) return;
  const senderTracks = new Set((pc.getSenders ? pc.getSenders() : []).map((sender) => sender.track).filter(Boolean));
  stream.getTracks().forEach((track) => {
    if (!senderTracks.has(track)) pc.addTrack(track, stream);
  });
}

function playMedia(element) {
  if (!element || typeof element.play !== "function") return;
  const result = element.play();
  if (result && typeof result.catch === "function") result.catch(() => {});
}

function isRealtimeReady() {
  return Boolean(state.ws && state.ws.readyState === WebSocket.OPEN);
}

async function ensureRealtimeReady(label = "live features") {
  if (isRealtimeReady()) return true;
  setConnection("Connecting");
  if (!state.ws || state.ws.readyState === WebSocket.CLOSED || state.ws.readyState === WebSocket.CLOSING) {
    connectSocket();
  }
  const started = Date.now();
  while (Date.now() - started < 7000) {
    if (isRealtimeReady()) return true;
    await sleep(120);
  }
  notify(`Live connection is still reconnecting. ${label} needs the server opened from its live URL.`);
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendWs(payload) {
  if (!isRealtimeReady()) {
    queueRealtimePayload(payload);
    return false;
  }
  state.ws.send(JSON.stringify(payload));
  return true;
}

function queueRealtimePayload(payload) {
  if (!payload || !["presence:update", "typing", "voice:state", "screen:status", "voice:join"].includes(payload.type)) return;
  state.wsOutbox.push({ ...payload, queuedAt: Date.now() });
  state.wsOutbox = state.wsOutbox.filter((entry) => Date.now() - entry.queuedAt < 15000).slice(-20);
}

function flushWsOutbox() {
  if (!isRealtimeReady() || !state.wsOutbox.length) return;
  const pending = state.wsOutbox.splice(0);
  pending.forEach((payload) => {
    if (Date.now() - payload.queuedAt < 15000) state.ws.send(JSON.stringify(payload));
  });
}

async function recoverRealtimeState(wasReconnect) {
  if (!state.loggedIn) return;
  if (wasReconnect) await refreshStateFromServer();
  flushPendingSends();
  if (state.voiceStream && state.voiceRoomId) {
    sendWs({
      type: "voice:join",
      roomId: state.voiceRoomId,
      muted: state.voiceMuted,
      deafened: state.voiceDeafened,
      videoEnabled: state.voiceVideoEnabled,
      cameraOff: state.voiceCameraOff,
    });
    setTimeout(() => syncVoicePeers().catch(() => {}), 350);
  }
  if (state.localStream && state.screenRoomId) {
    sendWs({ type: "screen:status", sharing: true, roomId: state.screenRoomId });
    setTimeout(() => {
      for (const peer of screenPeersForRoom(state.screenRoomId)) {
        makeOffer(peer.id, state.screenRoomId).catch(() => {});
      }
    }, 350);
  }
}

async function refreshStateFromServer() {
  const data = await api("/api/state");
  state.settings = data.settings || state.settings;
  state.rooms = data.rooms || state.rooms;
  state.messages = data.messages || state.messages;
  state.dms = data.dms || state.dms;
  state.dmGroups = data.dmGroups || state.dmGroups;
  state.files = data.files || state.files;
  state.people = data.people || state.people;
  state.presence = data.presence || state.presence;
  state.voiceRooms = data.voiceRooms || state.voiceRooms;
  state.readReceipts = data.readReceipts || state.readReceipts;
  renderAll();
}

let typingTimer = null;
function sendTyping(kind, target) {
  sendWs({ type: "typing", active: true, kind, roomId: target || "main" });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => sendWs({ type: "typing", active: false, kind, roomId: target || "main" }), 900);
}

function closePeer(peerId) {
  const pc = state.peerConnections.get(peerId);
  if (pc) pc.close();
  state.peerConnections.delete(peerId);
  state.pendingCandidates.delete(peerId);
}

function attachScreenStream(peerId, stream, roomId = "screen:global") {
  state.remoteFrom = peerId;
  state.remoteScreenRoomId = roomId;
  state.remoteScreenStream = stream;
  const target = isDmCallRoom(roomId) ? els.dmScreenVideo : els.remoteVideo;
  if (target) {
    target.muted = true;
    target.srcObject = stream;
    playMedia(target);
  }
  renderScreen();
  renderDmCall();
}

function clearRemoteVideo(roomId = "") {
  if (!roomId || !isDmCallRoom(roomId)) {
    els.remoteVideo.srcObject = null;
  }
  if (!roomId || isDmCallRoom(roomId)) {
    if (els.dmScreenVideo) els.dmScreenVideo.srcObject = null;
  }
  state.remoteFrom = "";
  state.remoteScreenRoomId = "";
  state.remoteScreenStream = null;
  renderScreen();
  renderDmCall();
}

function renderAll() {
  renderShell();
  renderDashboard();
  renderRooms();
  renderMessages();
  renderDms();
  renderDmCall();
  renderFriends();
  renderProfile();
  renderStore();
  renderFiles();
  renderDocs();
  renderVoice();
  renderScreen();
  renderVpn();
  renderServer();
  renderEmailStatus();
  renderQuickEdit();
  renderUsers();
  renderFeatureLocks();
  renderFeatureVisibility();
  renderPaywalls();
  renderRoomManager();
  renderAnnouncements();
  renderServiceScale();
  renderBrowserPolicy();
  renderAdminDms();
  renderAdminReadReceipts();
  renderAdminStore();
  renderAiRequests();
  renderBackups();
  renderAdminAutomod();
  renderAccountRequests();
  renderLiveIpTracking();
  renderReports();
  renderLogs();
  renderHmd();
  renderCornerAd();
  updateControls();
}

function renderCornerAd() {
  if (!els.cornerAd || !state.user) return;
  const ads = Array.isArray(state.settings.ads) ? state.settings.ads.filter((ad) => ad && ad.enabled !== false && (ad.text || ad.title)) : [];
  if (!ads.length) {
    els.cornerAd.classList.add("hidden");
    return;
  }
  const index = Math.floor(Date.now() / 10000) % ads.length;
  const ad = ads[index];
  els.cornerAd.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = String(ad.title || "Inner").slice(0, 60);
  const text = document.createElement("span");
  text.textContent = String(ad.text || "").slice(0, 160);
  els.cornerAd.append(title, text);
  els.cornerAd.classList.remove("hidden");
  clearTimeout(renderCornerAd.timer);
  renderCornerAd.timer = setTimeout(() => {
    if (els.cornerAd) els.cornerAd.classList.add("hidden");
  }, 10000);
}

function renderShell() {
  const enabled = Boolean(state.settings.serverEnabled);
  const custom = state.settings.customizations || {};
  els.roomName.textContent = (state.settings.customizations && state.settings.customizations.appName) || state.settings.roomName || "Inner";
  els.serverPill.textContent = enabled ? (custom.serverOnLabel || "Server on") : (custom.serverOffLabel || "Server off");
  els.serverPill.classList.toggle("on", enabled);
  els.serverPill.classList.toggle("off", !enabled);
  if (els.buildBadge) {
    els.buildBadge.textContent = custom.versionLabel || "";
    els.buildBadge.classList.toggle("hidden", !custom.versionLabel);
  }
  els.currentUser.textContent = state.user ? `${state.user.username} (${state.user.role})` : "-";
  els.messageCount.textContent = String(state.messages.length);
  els.fileCount.textContent = String(state.files.length);
  els.peerCount.textContent = String(state.peers.size + (state.loggedIn ? 1 : 0));
  document.querySelectorAll(".owner-only").forEach((element) => {
    element.classList.toggle("hidden", !isOwner());
  });
  document.querySelectorAll(".dev-only").forEach((element) => {
    element.classList.toggle("hidden", !isDev());
  });
  syncPrivilegedNav();
  syncHiddenNav();
  updateNotificationButton();
  if (!isOwner() && state.activeView === "admin") showView("dashboard");
  if (!isOwner() && state.activeView === "domain") showView("dashboard");
  if (!isDev() && state.activeView === "hmd") showView("dashboard");
}

function renderDashboard() {
  if (!els.dashboardGrid) return;
  const wholeAppPaywall = paywallRule("all");
  const paywallLocked = !isOwner() && wholeAppPaywall.enabled && wholeAppPaywall.itemId && !hasPaidOrder(wholeAppPaywall.itemId);
  els.dashboardState.textContent = paywallLocked
    ? (wholeAppPaywall.message || "Access is paywalled. Open Store to request the access pass.")
    : state.settings.serverEnabled ? "Workspace live" : "Workspace paused";
  renderDashboardAnnouncements();
  renderOnboarding();
  els.dashboardGrid.replaceChildren(
    metricCard("Messages", state.messages.length, "Persistent room history"),
    metricCard("Files", state.files.length, "Uploads and attachments"),
    metricCard("Friends", (state.friends.friends || []).length, "Accepted connections"),
    metricCard("Online", state.presence.length || state.peers.size + 1, "Live presence")
  );
  const gradeReminder = yearlyGradeReminder();
  if (gradeReminder) {
    els.dashboardGrid.prepend(adminCard("Grade check", "Update profile", [gradeReminder]));
  }

  els.presenceList.replaceChildren();
  const presence = state.presence.length ? state.presence : [{ username: state.user.username, role: state.user.role, status: "online" }];
  presence.forEach((person) => {
    els.presenceList.append(adminCard(person.username, person.status || "online", [
      person.customStatus || "",
      person.voiceRoomId ? `Voice ${person.voiceRoomId}` : "",
    ].filter(Boolean)));
  });

  els.mentionList.replaceChildren();
  const mentions = state.messages.filter((message) => (message.mentions || []).includes(state.user.username)).slice(-10).reverse();
  if (!mentions.length) {
    els.mentionList.append(emptyBlock("No recent mentions"));
  } else {
    mentions.forEach((message) => {
      els.mentionList.append(adminCard(`@${message.user}`, formatDate(message.createdAt), [previewText(message.text)]));
    });
  }
}

function metricCard(title, value, detail) {
  return adminCard(title, String(value), [detail]);
}

function renderOnboarding() {
  if (!els.onboardingPanel || !state.user) return;
  const dismissed = onboardingDismissed();
  els.onboardingPanel.classList.toggle("hidden", dismissed);
  if (els.showOnboardingButton) els.showOnboardingButton.classList.toggle("hidden", !dismissed);
  if (dismissed) return;

  const guide = onboardingGuideForRole(state.user.role);
  els.onboardingTitle.textContent = guide.title;
  els.onboardingSubtitle.textContent = guide.subtitle;
  els.onboardingSteps.replaceChildren();
  guide.steps.forEach((step, index) => {
    const card = document.createElement("article");
    card.className = "onboarding-step";
    const number = document.createElement("span");
    number.className = "onboarding-step-number";
    number.textContent = String(index + 1);
    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = step.title;
    const detail = document.createElement("p");
    detail.textContent = step.detail;
    body.append(title, detail);
    if (step.view) {
      const action = accountButton(step.action || "Open", () => showView(step.view));
      action.classList.add("onboarding-action");
      body.append(action);
    }
    card.append(number, body);
    els.onboardingSteps.append(card);
  });
}

function onboardingGuideForRole(role) {
  const normalized = String(role || "member").toLowerCase();
  if (normalized === "admin") {
    return {
      title: "Admin setup guide",
      subtitle: "Use this path to keep the server clean, searchable, and ready for users.",
      steps: [
        { title: "Check server settings", detail: "Set signup mode, report emails, version text, announcements, and the public app labels.", view: "admin", action: "Open Admin" },
        { title: "Review account requests", detail: "Approve, decline, or search accounts. Use the grade filter to find students by grade fast.", view: "admin", action: "Manage accounts" },
        { title: "Post announcements", detail: "Send dashboard announcements to everyone or a specific room from the Admin panel.", view: "admin", action: "Announcements" },
        { title: "Control features", detail: "Hide tabs, lock tools, apply paywalls, and allow specific users access when needed.", view: "admin", action: "Feature controls" },
        { title: "Back up before big changes", detail: "Use Backups before resetting rooms, wiping logs, or changing major settings.", view: "admin", action: "Backups" },
      ],
    };
  }
  if (normalized === "hmd" || normalized === "dev") {
    return {
      title: "HMD/dev guide",
      subtitle: "System tools, metrics, bots, plugins, storage, and recovery controls.",
      steps: [
        { title: "Open HMD", detail: "Use HMD for metrics, database counts, storage status, localhost tools, bots, plugins, and emergency controls.", view: "hmd", action: "Open HMD" },
        { title: "Check storage and backups", detail: "Confirm uploads and data are using the intended storage folder before deploys.", view: "hmd", action: "Storage tools" },
        { title: "Review automod", detail: "Tune spam windows and muted words from HMD/Admin moderation controls.", view: "hmd", action: "Automod" },
        { title: "Use owner Admin for people", detail: "Account grade, role, bans, feature visibility, and announcements are managed from the owner Admin account." },
      ],
    };
  }
  if (normalized === "moderator") {
    return {
      title: "Moderator guide",
      subtitle: "Help keep chats organized and safe.",
      steps: [
        { title: "Complete your profile", detail: "Add name, grade/staff status, profile picture, and status so people know who you are.", view: "profile", action: "Edit profile" },
        { title: "Use rooms and messages", detail: "Switch rooms, read announcements, and keep public chats on topic.", view: "messages", action: "Open messages" },
        { title: "Use DMs carefully", detail: "Create DMs or group chats with accepted friends, send files, links, and call when available.", view: "dms", action: "Open DMs" },
        { title: "Review reports if enabled", detail: "If the owner admin gives moderation tools, use the available reports/logs area to mark issues reviewed." },
        { title: "Share docs", detail: "Use the Google Workspace tab for Docs, Slides, and Sheets inside Inner.", view: "googleWorkspace", action: "Google Workspace" },
      ],
    };
  }
  return {
    title: "Member guide",
    subtitle: "Start here if you are using Inner for chats, files, friends, and docs.",
    steps: [
      { title: "Set up your profile", detail: "Add display name, grade, status, profile picture, and theme.", view: "profile", action: "Edit profile" },
      { title: "Add friends", detail: "Same-grade users show by default. Search exact username, email, or phone to find someone outside your grade.", view: "friends", action: "Find friends" },
      { title: "Use messages and DMs", detail: "Use Messages for rooms and DMs for private or group conversations with accepted friends.", view: "messages", action: "Open messages" },
      { title: "Upload and share files", detail: "Use Files for photos, videos, audio, and documents. Turn on Private if only you and admins should see it.", view: "files", action: "Open files" },
      { title: "Use Docs, Slides, and Sheets", detail: "Use the Google Workspace tab for school work directly inside Inner.", view: "googleWorkspace", action: "Open Workspace" },
    ],
  };
}

function onboardingStorageKey() {
  const username = state.user ? state.user.username : "guest";
  const role = state.user ? state.user.role : "member";
  return `inner:onboarding:v1:${username}:${role}`;
}

function onboardingDismissed() {
  try {
    return localStorage.getItem(onboardingStorageKey()) === "dismissed";
  } catch (error) {
    return false;
  }
}

function dismissOnboarding() {
  try {
    localStorage.setItem(onboardingStorageKey(), "dismissed");
  } catch (error) {
    // Onboarding still works without local storage.
  }
  renderOnboarding();
}

function showOnboarding() {
  try {
    localStorage.removeItem(onboardingStorageKey());
  } catch (error) {
    // Onboarding still works without local storage.
  }
  renderOnboarding();
}

function sidebarIconMarkup() {
  return '<span class="hamburger-lines" aria-hidden="true"><span></span><span></span><span></span></span>';
}

function toggleSidebar() {
  if (!els.appView) return;
  const phoneMode = window.matchMedia("(max-width: 920px)").matches;
  if (phoneMode) {
    const open = !els.appView.classList.contains("sidebar-open");
    els.appView.classList.toggle("sidebar-open", open);
    if (els.sidebarToggleButton) {
      els.sidebarToggleButton.innerHTML = open ? '<span aria-hidden="true">×</span>' : '<span aria-hidden="true">☰</span>';
      els.sidebarToggleButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      els.sidebarToggleButton.setAttribute("aria-expanded", String(open));
    }
    return;
  }
  const closed = !els.appView.classList.contains("sidebar-closed");
  els.appView.classList.toggle("sidebar-closed", closed);
  if (els.sidebarToggleButton) {
    els.sidebarToggleButton.innerHTML = closed ? '<span aria-hidden="true">☰</span>' : '<span aria-hidden="true">×</span>';
    els.sidebarToggleButton.setAttribute("aria-label", closed ? "Open navigation" : "Close navigation");
    els.sidebarToggleButton.setAttribute("aria-expanded", String(!closed));
  }
}

function closeSidebar() {
  if (!els.appView) return;
  els.appView.classList.remove("sidebar-open");
  if (els.sidebarToggleButton) {
    const closed = els.appView.classList.contains("sidebar-closed");
    els.sidebarToggleButton.innerHTML = closed ? '<span aria-hidden="true">☰</span>' : '<span aria-hidden="true">☰</span>';
    els.sidebarToggleButton.setAttribute("aria-label", "Open navigation");
    els.sidebarToggleButton.setAttribute("aria-expanded", String(!els.appView.classList.contains("sidebar-closed")));
  }
}

function setSidebarButtonIcon(open) {
  if (!els.sidebarToggleButton) return;
  els.sidebarToggleButton.replaceChildren();
  const wrap = document.createElement("span");
  wrap.className = open ? "hamburger-lines is-open" : "hamburger-lines";
  wrap.setAttribute("aria-hidden", "true");
  wrap.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));
  els.sidebarToggleButton.append(wrap);
}

function toggleSidebar() {
  if (!els.appView) return;
  const phoneMode = window.matchMedia("(max-width: 920px)").matches;
  if (phoneMode) {
    const open = !els.appView.classList.contains("sidebar-open");
    els.appView.classList.toggle("sidebar-open", open);
    els.appView.classList.remove("sidebar-closed");
    if (els.sidebarBackdrop) els.sidebarBackdrop.classList.toggle("hidden", !open);
    setSidebarButtonIcon(open);
    if (els.sidebarToggleButton) {
      els.sidebarToggleButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      els.sidebarToggleButton.setAttribute("aria-expanded", String(open));
    }
    return;
  }
  const closed = !els.appView.classList.contains("sidebar-closed");
  els.appView.classList.toggle("sidebar-closed", closed);
  els.appView.classList.remove("sidebar-open");
  if (els.sidebarBackdrop) els.sidebarBackdrop.classList.add("hidden");
  setSidebarButtonIcon(!closed);
  if (els.sidebarToggleButton) {
    els.sidebarToggleButton.setAttribute("aria-label", closed ? "Open navigation" : "Close navigation");
    els.sidebarToggleButton.setAttribute("aria-expanded", String(!closed));
  }
}

function closeSidebar() {
  if (!els.appView) return;
  els.appView.classList.remove("sidebar-open");
  if (els.sidebarBackdrop) els.sidebarBackdrop.classList.add("hidden");
  setSidebarButtonIcon(false);
  if (els.sidebarToggleButton) {
    els.sidebarToggleButton.setAttribute("aria-label", "Open navigation");
    els.sidebarToggleButton.setAttribute("aria-expanded", "false");
  }
}

function yearlyGradeReminder() {
  if (!state.user) return "";
  const profile = state.profiles[state.user.username] || {};
  const now = new Date();
  const augustFirst = new Date(now.getFullYear(), 7, 1);
  if (now < augustFirst) return "";
  const updatedAt = Date.parse(profile.gradeUpdatedAt || state.user.gradeUpdatedAt || "");
  if (Number.isFinite(updatedAt) && updatedAt >= augustFirst.getTime()) return "";
  return "Every August 1, confirm your grade in Profile so friends, rooms, and admin filters stay current.";
}

function renderDashboardAnnouncements() {
  if (!els.dashboardAnnouncementList) return;
  els.dashboardAnnouncementList.replaceChildren();
  const custom = state.settings.customizations || {};
  if (custom.updateTitle || custom.updateNote || custom.versionLabel) {
    els.dashboardAnnouncementList.append(adminCard(
      custom.updateTitle || "Update",
      custom.versionLabel || "Latest",
      [
        custom.updateNote || "No update notes added yet.",
        custom.updatedAt ? `Updated ${formatDate(custom.updatedAt)}${custom.updatedBy ? ` by ${custom.updatedBy}` : ""}` : "",
      ]
    ));
  }
  const items = (state.announcements || []).slice(0, 5);
  if (!items.length && !els.dashboardAnnouncementList.children.length) {
    els.dashboardAnnouncementList.append(emptyBlock("No announcements yet"));
    return;
  }
  items.forEach((announcement) => {
    const card = announcementCard(announcement);
    if (announcement.scope === "room" && announcement.roomId) {
      const actions = document.createElement("div");
      actions.className = "account-actions";
      actions.append(accountButton("Open room", () => {
        state.selectedRoomId = announcement.roomId;
        saveUiState();
        showView("messages");
        renderRooms();
        renderMessages();
      }));
      card.append(actions);
    }
    els.dashboardAnnouncementList.append(card);
  });
}

function renderAnnouncements() {
  if (!els.announcementForm) return;
  const admin = isOwner();
  els.announcementForm.classList.toggle("hidden", !admin);
  if (els.announcementList) els.announcementList.closest(".status-panel")?.classList.toggle("hidden", !admin);
  if (!admin) {
    renderDashboardAnnouncements();
    return;
  }

  const roomMode = els.announcementScope.value === "room";
  els.announcementRoomLabel.classList.toggle("hidden", !roomMode);
  els.announcementRoom.replaceChildren(
    ...state.rooms.map((room) => {
      const option = document.createElement("option");
      option.value = room.id;
      option.textContent = room.name;
      return option;
    })
  );
  if (!els.announcementRoom.value && state.rooms[0]) els.announcementRoom.value = state.rooms[0].id;

  if (!els.announcementList) return;
  els.announcementList.replaceChildren();
  if (!state.announcements.length) {
    els.announcementList.append(emptyBlock("No announcements sent"));
    return;
  }
  state.announcements.forEach((announcement) => {
    const card = announcementCard(announcement);
    const actions = document.createElement("div");
    actions.className = "account-actions";
    actions.append(accountButton("Delete", () => deleteAnnouncement(announcement.id)));
    card.append(actions);
    els.announcementList.append(card);
  });
}

function announcementCard(announcement) {
  return adminCard(announcement.title || "Announcement", announcement.scope === "room" ? `Room: ${announcement.roomName || announcement.roomId}` : "Whole platform", [
    announcement.message || "",
    `By ${announcement.createdBy || "admin"} at ${formatDate(announcement.createdAt)}`,
  ]);
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
  const scrollOffset = els.messageList.scrollHeight - els.messageList.scrollTop;
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
      if (message.editedAt) meta.append(textNode("edited"));
      if (message.status) meta.append(textNode(message.status));
      if (isOwner()) {
        meta.append(textNode(`From ${message.sourceIp || "unknown"}`));
      }

      const body = document.createElement("div");
      body.className = "message-text";
      body.textContent = message.text;

      item.append(meta, body);
      appendMessageAttachment(item, message.attachment);
      const actions = document.createElement("div");
      actions.className = "message-actions";
      ["like", "heart", "laugh"].forEach((emoji) => {
        const reactionButton = document.createElement("button");
        reactionButton.className = "ghost-light-button compact-button";
        reactionButton.type = "button";
        const count = message.reactions && Array.isArray(message.reactions[emoji]) ? message.reactions[emoji].length : 0;
        reactionButton.textContent = count ? `${emoji} ${count}` : emoji;
        reactionButton.addEventListener("click", () => reactMessage(message.id, emoji));
        actions.append(reactionButton);
      });
      ["helpful", "funny", "supportive"].forEach((emoji) => {
        const reactionButton = document.createElement("button");
        reactionButton.className = "ghost-light-button compact-button";
        reactionButton.type = "button";
        const count = message.reactions && Array.isArray(message.reactions[emoji]) ? message.reactions[emoji].length : 0;
        reactionButton.textContent = count ? `${emoji} ${count}` : emoji;
        reactionButton.addEventListener("click", () => reactMessage(message.id, emoji));
        actions.append(reactionButton);
      });
      const replyButton = document.createElement("button");
      replyButton.className = "ghost-light-button compact-button";
      replyButton.type = "button";
      replyButton.textContent = "Reply";
      replyButton.addEventListener("click", () => {
        state.replyToMessage = message;
        els.messageInput.placeholder = `Reply to ${message.user}`;
        focusWithoutJump(els.messageInput);
      });
      actions.append(replyButton);
      if (message.user === state.user.username && !message.local) {
        const editButton = document.createElement("button");
        editButton.className = "ghost-light-button compact-button";
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => editMessage(message.id, message.text));
        actions.append(editButton);
      }
      if (message.status === "failed" && message.localId) {
        const retryButton = document.createElement("button");
        retryButton.className = "ghost-light-button compact-button";
        retryButton.type = "button";
        retryButton.textContent = "Retry";
        retryButton.addEventListener("click", () => retryPending(message.localId));
        actions.append(retryButton);
      }
      if (message.user !== state.user.username) {
        const reportButton = document.createElement("button");
        reportButton.className = "ghost-light-button compact-button";
        reportButton.type = "button";
        reportButton.textContent = "Report";
        reportButton.addEventListener("click", () => reportMessage(message.id));
        actions.append(reportButton);
      }
      if (isOwner()) {
        const deleteButton = document.createElement("button");
        deleteButton.className = "ghost-light-button compact-button";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => deleteMessage(message.id));
        actions.append(deleteButton);
      }
      item.append(actions);
      const receipt = readReceiptText("messages", room.id, message);
      if (receipt) {
        const seen = document.createElement("small");
        seen.className = "read-receipt";
        seen.textContent = receipt;
        item.append(seen);
      }
      els.messageList.append(item);
    });
  }

  const restored = restoreScrollPosition("messages", room.id, els.messageList);
  if (!restored && shouldStick) {
    scrollToBottom(els.messageList);
  } else if (!restored) {
    els.messageList.scrollTop = Math.max(0, els.messageList.scrollHeight - scrollOffset);
  }
  updateJumpButton(els.messageList, els.messageJumpBottomButton);
  markReadSoon("messages", room.id);
}

async function unlockRoomIfNeeded(roomId) {
  const room = state.rooms.find((entry) => entry.id === roomId);
  if (!room || !room.requiresPassword || isOwner()) return true;
  const password = window.prompt(`Password for ${room.name}`);
  if (!password) {
    state.selectedRoomId = "main";
    renderRooms();
    return false;
  }
  try {
    const data = await api("/api/rooms/unlock", {
      method: "POST",
      json: { roomId, password },
    });
    state.rooms = data.rooms || state.rooms;
    notify(`Unlocked ${room.name}`);
    renderRooms();
    return true;
  } catch (error) {
    notify(error.message);
    state.selectedRoomId = "main";
    renderRooms();
    return false;
  }
}

function renderDms() {
  const people = dmPeople();
  if (!state.selectedDmUser && people.length) state.selectedDmUser = people[0].value;
  if (state.selectedDmUser && !people.some((person) => person.value === state.selectedDmUser)) {
    state.selectedDmUser = people[0] ? people[0].value : "";
  }

  els.dmPeerSelect.replaceChildren(
    ...people.map((person) => {
      const option = document.createElement("option");
      option.value = person.value;
      option.textContent = person.label;
      return option;
    })
  );
  els.dmPeerSelect.value = state.selectedDmUser;
  renderShareTargets();
  const activeGroup = selectedDmGroup();
  const canDeleteGroup = activeGroup && (isOwner() || activeGroup.createdBy === state.user.username);
  els.deleteDmGroupButton.classList.toggle("hidden", !activeGroup);
  els.deleteDmGroupButton.disabled = !canDeleteGroup;
  els.dmGroupMembers.replaceChildren();
  const groupCandidates = dmGroupCandidatePeople();
  if (!groupCandidates.length) {
    els.dmGroupMembers.append(emptyBlock("Accept friends first to create group DMs"));
  }
  groupCandidates
    .forEach((person) => {
      const label = document.createElement("label");
      label.className = "member-chip";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = person.username;
      const name = document.createElement("span");
      name.textContent = person.displayName || person.username;
      const role = document.createElement("small");
      role.textContent = person.role;
      label.append(input, name, role);
      els.dmGroupMembers.append(label);
    });

  const locked = featureLock("dms");
  els.dmState.textContent = locked
    ? `DMs paused until ${formatDate(locked.disabledUntil)}`
    : "Create DMs and group chats with accepted friends.";
  const shouldStick = els.dmList.scrollTop + els.dmList.clientHeight >= els.dmList.scrollHeight - 24;
  const scrollOffset = els.dmList.scrollHeight - els.dmList.scrollTop;
  els.dmList.replaceChildren();

  if (!state.selectedDmUser) {
    els.dmList.append(emptyBlock("No accounts available"));
    updateJumpButton(els.dmList, els.dmJumpBottomButton);
    return;
  }

  const visible = state.dms.filter((dm) => dmBetween(dm, state.user.username, state.selectedDmUser));
  if (!visible.length) {
    els.dmList.append(emptyBlock("No DMs yet"));
    updateJumpButton(els.dmList, els.dmJumpBottomButton);
    return;
  }

  visible.forEach((dm) => {
    const bubble = renderMessageBubble({
      mine: dm.from === state.user.username,
      title: dmTitle(dm),
      text: dm.text,
      createdAt: dm.createdAt,
      sourceIp: dm.sourceIp,
      attachment: dm.attachment,
      onDelete: isOwner() ? () => deleteDm(dm.id) : null,
    });
    const receipt = readReceiptText(dm.groupId ? "group" : "dm", dm.groupId || directReceiptTarget(state.user.username, dm.from === state.user.username ? dm.to : dm.from), dm);
    if (receipt) {
      const seen = document.createElement("small");
      seen.className = "read-receipt";
      seen.textContent = receipt;
      bubble.append(seen);
    }
    if (dm.editedAt || dm.status) {
      const status = document.createElement("small");
      status.className = "read-receipt";
      status.textContent = [dm.editedAt ? "edited" : "", dm.status || ""].filter(Boolean).join(" / ");
      bubble.append(status);
    }
    if (dm.from === state.user.username || dm.status === "failed") {
      const extraActions = document.createElement("div");
      extraActions.className = "message-actions";
      if (dm.from === state.user.username && !dm.local) extraActions.append(accountButton("Edit", () => editDm(dm.id, dm.text)));
      if (dm.status === "failed" && dm.localId) extraActions.append(accountButton("Retry", () => retryPending(dm.localId)));
      bubble.append(extraActions);
    }
    els.dmList.append(bubble);
  });
  const restored = restoreScrollPosition(state.selectedDmUser.startsWith("group:") ? "group" : "dm", receiptTargetForCurrentDm(), els.dmList);
  if (!restored && shouldStick) {
    scrollToBottom(els.dmList);
  } else if (!restored) {
    els.dmList.scrollTop = Math.max(0, els.dmList.scrollHeight - scrollOffset);
  }
  updateJumpButton(els.dmList, els.dmJumpBottomButton);
  markReadSoon(state.selectedDmUser.startsWith("group:") ? "group" : "dm", receiptTargetForCurrentDm());
  renderDmCall();
}

function renderDmCall() {
  if (!els.dmCallPanel || !state.user) return;
  const roomId = currentDmCallRoom();
  const hasSelection = Boolean(roomId);
  const inThisCall = Boolean(state.voiceStream && state.voiceRoomId === roomId);
  const sharingHere = Boolean(state.localStream && state.screenRoomId === roomId);
  const remoteShareHere = Boolean(state.remoteScreenStream && state.remoteScreenRoomId === roomId);
  const incomingHere = Boolean(state.incomingCall);
  const people = hasSelection ? selectedDmParticipants() : [];
  const online = Array.from(state.peers.values()).filter((peer) => people.includes(peer.username)).length;
  const callExpanded = Boolean(inThisCall || sharingHere || remoteShareHere || incomingHere);
  els.dmCallPanel.classList.toggle("call-expanded", callExpanded);

  els.dmCallState.textContent = incomingHere
    ? `${state.incomingCall.fromUser} is ringing ${state.incomingCall.roomLabel || callRoomLabel(state.incomingCall.roomId)}`
    : hasSelection
      ? `${currentDmCallLabel()} - ${online} online - ${inThisCall ? "in call" : "ready"}`
      : "Choose a DM or group to start a call";

  els.dmVoiceCallButton.disabled = !hasSelection || inThisCall || !featureAvailable("voice");
  els.dmVideoCallButton.disabled = !hasSelection || inThisCall || !featureAvailable("voice");
  els.dmShareScreenButton.disabled = !hasSelection || sharingHere || !featureAvailable("screen");
  els.dmStopScreenButton.disabled = !sharingHere;
  els.dmLeaveCallButton.disabled = !inThisCall;
  els.dmAnswerCallButton.classList.toggle("hidden", !incomingHere);
  els.dmDeclineCallButton.classList.toggle("hidden", !incomingHere);

  if (els.dmLocalCallPreview) {
    els.dmLocalCallPreview.srcObject = inThisCall ? state.voiceStream : null;
    els.dmLocalCallPreview.classList.toggle("hidden", !inThisCall || !state.voiceVideoEnabled);
    if (inThisCall) playMedia(els.dmLocalCallPreview);
  }
  if (els.dmScreenEmpty) {
    els.dmScreenEmpty.classList.toggle("hidden", remoteShareHere || sharingHere);
  }
  if (sharingHere && els.dmScreenVideo) {
    els.dmScreenVideo.srcObject = state.localStream;
    playMedia(els.dmScreenVideo);
  } else if (remoteShareHere && els.dmScreenVideo) {
    els.dmScreenVideo.srcObject = state.remoteScreenStream;
    playMedia(els.dmScreenVideo);
  } else if (!remoteShareHere && !sharingHere && els.dmScreenVideo) {
    els.dmScreenVideo.srcObject = null;
  }
}

const readReceiptTimers = new Map();
const lastReadReceiptSent = new Map();

function receiptKey(context, targetId) {
  return `${context}:${targetId || "main"}`;
}

function directReceiptTarget(userA, userB) {
  return [userA, userB].filter(Boolean).sort((a, b) => String(a).localeCompare(String(b))).join("|");
}

function receiptTargetForCurrentDm() {
  if (!state.selectedDmUser) return "";
  if (state.selectedDmUser.startsWith("group:")) return state.selectedDmUser.slice(6);
  return directReceiptTarget(state.user.username, state.selectedDmUser);
}

function readReceiptText(context, targetId, message) {
  const sender = message.user || message.from || "";
  if (!state.user || sender !== state.user.username) return "";
  const receipts = (state.readReceipts || {})[receiptKey(context, targetId)] || {};
  const seenBy = Object.entries(receipts)
    .filter(([username, seenAt]) => username !== state.user.username && Date.parse(seenAt) >= Date.parse(message.createdAt || 0))
    .map(([username]) => username)
    .slice(0, 4);
  if (!seenBy.length) return "";
  return `Seen by ${seenBy.join(", ")}`;
}

function markReadSoon(context, targetId) {
  if (!state.loggedIn || !targetId) return;
  const key = receiptKey(context, targetId);
  if (Date.now() - Number(lastReadReceiptSent.get(key) || 0) < 12000) return;
  clearTimeout(readReceiptTimers.get(key));
  readReceiptTimers.set(key, setTimeout(async () => {
    try {
      lastReadReceiptSent.set(key, Date.now());
      const data = await api("/api/read-receipts", {
        method: "POST",
        json: { context, targetId },
      });
      state.readReceipts = { ...(state.readReceipts || {}), ...(data.readReceipts || {}) };
    } catch (error) {
      // Read receipts are helpful, but messaging should never depend on them.
    }
  }, 500));
}

function scrollToBottom(container, smooth = false) {
  if (!container) return;
  container.scrollTo({ top: container.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  updateJumpButton(container, container === els.messageList ? els.messageJumpBottomButton : els.dmJumpBottomButton);
}

function focusWithoutJump(element) {
  if (!element || typeof element.focus !== "function") return;
  try {
    element.focus({ preventScroll: true });
  } catch (error) {
    element.focus();
  }
}

function scrollStorageKey(context, targetId) {
  return `innerScroll:${context}:${targetId || "main"}`;
}

function saveScrollPosition(context, targetId, container) {
  if (!container || !targetId) return;
  try {
    localStorage.setItem(scrollStorageKey(context, targetId), JSON.stringify({
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
      timestamp: Date.now(),
    }));
  } catch (error) {
    // Scroll restore is best effort.
  }
}

function restoreScrollPosition(context, targetId, container) {
  if (!container || !targetId) return false;
  const key = scrollStorageKey(context, targetId);
  if (state.restoredScrollKeys.has(key)) return false;
  state.restoredScrollKeys.add(key);
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (!saved || Date.now() - Number(saved.timestamp || 0) > 7 * 24 * 60 * 60 * 1000) return false;
    container.scrollTop = Math.max(0, Number(saved.scrollTop || 0) + (container.scrollHeight - Number(saved.scrollHeight || container.scrollHeight)));
    return true;
  } catch (error) {
    return false;
  }
}

function updateJumpButton(container, button) {
  if (!container || !button) return;
  const awayFromBottom = container.scrollTop + container.clientHeight < container.scrollHeight - 80;
  button.classList.toggle("hidden", !awayFromBottom);
}

function renderFriends() {
  if (!els.friendList) return;
  const friendNames = new Set((state.friends.friends || []).map((entry) => entry.username));
  const candidates = friendCandidatePeople().filter((person) => !friendNames.has(person.username));
  els.friendUserSelect.replaceChildren(
    optionElement("", candidates.length ? "Choose a person" : "Search exact username/email/phone"),
    ...candidates
      .map((person) => {
        const option = document.createElement("option");
        option.value = person.username;
        option.textContent = `${person.displayName || person.username} (${friendGradeLabel(person)})`;
        return option;
      })
  );
  if (els.friendState) {
    const search = String(state.friendSearch || "").trim();
    const grade = String(state.friendGradeFilter || "").trim();
    els.friendState.textContent = search
      ? "Exact username/email/phone search can find people outside your grade."
      : grade
        ? `Showing grade ${grade} candidates you are allowed to add.`
        : "Same-grade people show here. Search exact username, email, or phone for anyone else.";
  }

  els.friendList.replaceChildren();
  if (!(state.friends.friends || []).length) {
    els.friendList.append(emptyBlock("No friends yet"));
  } else {
    state.friends.friends.forEach((friend) => {
      const profile = state.profiles[friend.username] || {};
      const card = adminCard(profile.displayName || friend.username, profile.status || "offline", [
        profile.customStatus || "",
        `Friends since ${formatDate(friend.createdAt)}`,
      ].filter(Boolean));
      const actions = document.createElement("div");
      actions.className = "account-actions";
      actions.append(accountButton("DM", () => {
        state.selectedDmUser = friend.username;
        showView("dms");
        renderDms();
      }));
      actions.append(accountButton("Remove", () => removeFriend(friend.username)));
      card.append(actions);
      els.friendList.append(card);
    });
  }

  els.friendRequestList.replaceChildren();
  const incoming = state.friends.incoming || [];
  const outgoing = state.friends.outgoing || [];
  if (!incoming.length && !outgoing.length) {
    els.friendRequestList.append(emptyBlock("No pending requests"));
  }
  incoming.forEach((request) => {
    const card = adminCard(request.from, "Incoming", [formatDate(request.createdAt)]);
    const actions = document.createElement("div");
    actions.className = "account-actions";
    actions.append(accountButton("Accept", () => respondFriendRequest(request.id, "accept")));
    actions.append(accountButton("Decline", () => respondFriendRequest(request.id, "decline")));
    card.append(actions);
    els.friendRequestList.append(card);
  });
  outgoing.forEach((request) => {
    els.friendRequestList.append(adminCard(request.to, "Outgoing", [formatDate(request.createdAt)]));
  });
}

function friendCandidatePeople() {
  const search = String(state.friendSearch || "").trim();
  const gradeFilter = String(state.friendGradeFilter || "").trim();
  const currentGrade = gradeOf(state.user);
  const people = search || gradeFilter ? state.friendCandidates : state.people;
  return (people || [])
    .filter((person) => {
      if (!person || !person.username || person.banned) return false;
      if (person.username === state.user.username) return false;
      if (isOwner()) return true;
      if (search || gradeFilter) return true;
      return currentGrade && gradeOf(person) === currentGrade;
    })
    .sort((a, b) => String(a.displayName || a.username).localeCompare(String(b.displayName || b.username)));
}

async function loadFriendCandidates() {
  const query = String(state.friendSearch || "").trim() || (state.friendGradeFilter ? `grade:${state.friendGradeFilter}` : "");
  if (!query) {
    state.friendCandidates = [];
    renderFriends();
    return;
  }
  try {
    const data = await api(`/api/friends/candidates?q=${encodeURIComponent(query)}`);
    state.friendCandidates = data.people || [];
    renderFriends();
  } catch (error) {
    notify(error.message || "Could not search friends");
  }
}

function searchFriendsByGrade() {
  const grade = els.friendGradeSearch ? els.friendGradeSearch.value : "";
  if (!grade) return notify("Choose a grade first");
  state.friendGradeFilter = grade;
  state.friendSearch = "";
  if (els.friendSearchInput) els.friendSearchInput.value = "";
  loadFriendCandidates();
}

function gradeOf(person) {
  const profile = person && state.profiles ? state.profiles[person.username] || {} : {};
  return String((person && person.grade) || profile.grade || "").trim().toLowerCase();
}

function friendGradeLabel(person) {
  const grade = gradeOf(person);
  return grade ? `grade ${grade}` : person.role || "member";
}

function renderProfile() {
  if (!els.profileForm || !state.user) return;
  const profile = state.profiles[state.user.username] || {};
  const customTheme = profile.customTheme || {};
  els.profileDisplayName.value = profile.displayName || state.user.username;
  els.profileAvatarUrl.value = profile.avatarUrl || "";
  els.profileBannerUrl.value = profile.bannerUrl || "";
  els.profileBadges.value = Array.isArray(profile.badges) ? profile.badges.join(", ") : "";
  els.profileStatus.value = profile.invisible ? "invisible" : profile.status || "online";
  els.profileCustomStatus.value = profile.customStatus || "";
  if (els.profileGrade) els.profileGrade.value = profile.grade || state.user.grade || "";
  els.profileTheme.value = profile.theme || "system";
  els.profileThemeBg.value = safeColor(customTheme.bg, "#f7f7f4");
  els.profileThemeSurface.value = safeColor(customTheme.surface, "#ffffff");
  els.profileThemeInk.value = safeColor(customTheme.ink, "#151515");
  els.profileThemeAccent.value = safeColor(customTheme.accent, "#245c4f");
  els.profileBio.value = profile.bio || "";
  els.profileInvisible.checked = Boolean(profile.invisible);
  updateProfilePreview();
}

function applyProfileTheme(themeOverride = "") {
  const profile = state.user ? state.profiles[state.user.username] || {} : {};
  const theme = themeOverride || profile.theme || "system";
  const normalized = ["midnight", "ocean", "forest", "rose", "slate", "glass", "custom"].includes(theme) ? theme : "";
  document.body.dataset.theme = normalized;
  const editorTheme = els.profileThemeBg && els.profileTheme && els.profileTheme.value === "custom" ? currentProfileThemeEditor() : null;
  applyCustomThemeVariables(normalized === "custom" ? editorTheme || profile.customTheme : null);
}

function updateProfilePreview() {
  if (!els.profilePreview) return;
  const displayName = (els.profileDisplayName && els.profileDisplayName.value.trim()) || (state.user && state.user.username) || "User";
  const avatarUrl = els.profileAvatarUrl ? els.profileAvatarUrl.value.trim() : "";
  const bannerUrl = els.profileBannerUrl ? els.profileBannerUrl.value.trim() : "";
  const status = els.profileStatus ? els.profileStatus.value : "online";
  const customStatus = els.profileCustomStatus ? els.profileCustomStatus.value.trim() : "";
  const customTheme = currentProfileThemeEditor();
  els.profilePreviewName.textContent = displayName;
  els.profilePreviewStatus.textContent = customStatus || status;
  els.profilePreviewAvatar.textContent = avatarUrl ? "" : displayName.slice(0, 1).toUpperCase();
  els.profilePreviewAvatar.style.backgroundImage = avatarUrl ? `url("${cssUrl(avatarUrl)}")` : "";
  els.profilePreviewBanner.style.backgroundImage = bannerUrl ? `url("${cssUrl(bannerUrl)}")` : "";
  els.profilePreview.style.setProperty("--preview-accent", customTheme.accent || "#245c4f");
  els.customThemeFields.classList.toggle("hidden", els.profileTheme.value !== "custom");
  if (els.profileTheme.value === "custom") applyCustomThemeVariables(customTheme);
}

function currentProfileThemeEditor() {
  return {
    bg: els.profileThemeBg ? els.profileThemeBg.value : "#f7f7f4",
    surface: els.profileThemeSurface ? els.profileThemeSurface.value : "#ffffff",
    ink: els.profileThemeInk ? els.profileThemeInk.value : "#151515",
    accent: els.profileThemeAccent ? els.profileThemeAccent.value : "#245c4f",
  };
}

function applyCustomThemeVariables(customTheme) {
  const root = document.documentElement;
  ["--custom-bg", "--custom-surface", "--custom-ink", "--custom-accent", "--custom-accent-soft", "--custom-line", "--custom-muted", "--custom-surface-muted"].forEach((name) => {
    root.style.removeProperty(name);
  });
  if (!customTheme) return;
  const bg = safeColor(customTheme.bg, "#f7f7f4");
  const surface = safeColor(customTheme.surface, "#ffffff");
  const ink = safeColor(customTheme.ink, "#151515");
  const accent = safeColor(customTheme.accent, "#245c4f");
  root.style.setProperty("--custom-bg", bg);
  root.style.setProperty("--custom-surface", surface);
  root.style.setProperty("--custom-ink", ink);
  root.style.setProperty("--custom-accent", accent);
  root.style.setProperty("--custom-accent-soft", `${accent}24`);
  root.style.setProperty("--custom-line", `${ink}26`);
  root.style.setProperty("--custom-muted", `${ink}aa`);
  root.style.setProperty("--custom-surface-muted", `${surface}dd`);
}

function safeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
}

function cssUrl(value) {
  return String(value || "").replace(/["\\\n\r]/g, "");
}

function applyCustomizations() {
  const custom = state.settings.customizations || {};
  const appName = custom.appName || state.settings.roomName || "Inner";
  if (els.roomName) els.roomName.textContent = appName;
  document.title = appName;
  if (els.buildBadge) {
    els.buildBadge.textContent = custom.versionLabel || "";
    els.buildBadge.classList.toggle("hidden", !custom.versionLabel);
  }
  if (els.siteNotice) {
    els.siteNotice.textContent = custom.notice || "";
    els.siteNotice.classList.toggle("hidden", !custom.notice);
  }
  if (/^#[0-9a-f]{6}$/i.test(custom.accent || "")) {
    document.documentElement.style.setProperty("--accent", custom.accent);
    document.documentElement.style.setProperty("--accent-soft", `${custom.accent}22`);
  } else {
    document.documentElement.style.removeProperty("--accent");
    document.documentElement.style.removeProperty("--accent-soft");
  }
  document.body.dataset.density = custom.density === "compact" ? "compact" : "comfortable";
  document.body.dataset.rounded = custom.rounded === false ? "off" : "on";
  let style = document.getElementById("quickCustomStyle");
  if (!style) {
    style = document.createElement("style");
    style.id = "quickCustomStyle";
    document.head.append(style);
  }
  style.textContent = custom.customCss || "";
}

function renderDocs() {
  if (!els.innerDocList) return;
  if (els.docsView) els.docsView.classList.toggle("docs-list-collapsed", Boolean(state.docsListCollapsed));
  if (els.docsToggleListButton) els.docsToggleListButton.textContent = state.docsListCollapsed ? "Show list" : "Hide list";
  const docs = state.innerDocs || [];
  if (!state.selectedInnerDocId && docs.length) state.selectedInnerDocId = docs[0].id;
  if (state.selectedInnerDocId && !docs.some((doc) => doc.id === state.selectedInnerDocId)) {
    state.selectedInnerDocId = docs[0] ? docs[0].id : "";
  }
  els.innerDocList.replaceChildren();
  if (!docs.length) {
    els.innerDocList.append(emptyBlock("No docs yet. Create one to start writing."));
  } else {
    docs.forEach((doc) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = `service-link-card docs-doc-card ${doc.id === state.selectedInnerDocId ? "active" : ""}`;
      card.append(textNode(doc.title), textNode(`${doc.type} - ${doc.owner === state.user.username ? "owned by you" : `shared by ${doc.owner}`}`));
      card.addEventListener("click", () => {
        state.selectedInnerDocId = doc.id;
        renderDocs();
      });
      els.innerDocList.append(card);
    });
  }
  const current = selectedInnerDoc();
  if (els.innerDocTitle) els.innerDocTitle.value = current ? current.title : "";
  if (els.innerDocType) els.innerDocType.value = current ? current.type : "doc";
  setInnerDocPageBody(current ? current.body : "");
  syncInnerDocMode();
  if (els.innerDocStatus) {
    els.innerDocStatus.textContent = current
      ? `Last saved ${formatDate(current.updatedAt || current.createdAt)}. ${current.sharedWith && current.sharedWith.length ? `Shared with ${current.sharedWith.length}.` : "Not shared yet."}`
      : "Create a doc, then press Save.";
  }
  updateInnerDocStats();
  renderShareTargets();
}

function toggleDocsList() {
  state.docsListCollapsed = !state.docsListCollapsed;
  renderDocs();
}

function selectedInnerDoc() {
  return (state.innerDocs || []).find((doc) => doc.id === state.selectedInnerDocId) || null;
}

function newInnerDoc() {
  state.selectedInnerDocId = "";
  if (els.innerDocTitle) els.innerDocTitle.value = "";
  if (els.innerDocType) els.innerDocType.value = "doc";
  setInnerDocPageBody("");
  if (els.innerDocStatus) els.innerDocStatus.textContent = "New unsaved doc.";
  if (els.innerDocTitle) els.innerDocTitle.focus();
}

function syncInnerDocMode() {
  const slides = els.innerDocType && els.innerDocType.value === "slides";
  if (els.innerDocForm) els.innerDocForm.classList.toggle("slides-mode", slides);
  if (els.innerDocPage) els.innerDocPage.classList.toggle("slides-mode", slides);
  if (slides && els.innerDocPage && !els.innerDocPage.innerText.trim()) {
    els.innerDocPage.innerHTML = defaultSlideHtml();
    updateInnerDocHiddenBody();
    updateInnerDocStats();
  }
}

async function saveInnerDoc(event) {
  if (event) event.preventDefault();
  updateInnerDocHiddenBody();
  try {
    const data = await api("/api/inner-docs", {
      method: "POST",
      json: {
        id: state.selectedInnerDocId,
        title: els.innerDocTitle.value.trim() || "Untitled doc",
        type: els.innerDocType.value,
        body: els.innerDocBody.value,
      },
    });
    state.innerDocs = data.innerDocs || state.innerDocs;
    state.selectedInnerDocId = data.doc ? data.doc.id : state.selectedInnerDocId;
    renderDocs();
    notify("Doc saved");
  } catch (error) {
    notify(error.message);
  }
}

function handleDocTool(event) {
  const button = event.currentTarget;
  if (!els.innerDocPage) return;
  els.innerDocPage.focus();
  if (button.dataset.docBlock) {
    document.execCommand("formatBlock", false, button.dataset.docBlock);
  } else if (button.dataset.docCommand) {
    document.execCommand(button.dataset.docCommand, false, null);
  }
  updateInnerDocHiddenBody();
  updateInnerDocStats();
}

function insertInnerSlide() {
  if (!els.innerDocPage) return;
  if (els.innerDocType) els.innerDocType.value = "slides";
  syncInnerDocMode();
  els.innerDocPage.focus();
  const slide = document.createElement("section");
  slide.className = "inner-slide";
  slide.innerHTML = "<h1>New slide</h1><p>Add your points here.</p>";
  els.innerDocPage.append(slide);
  updateInnerDocHiddenBody();
  updateInnerDocStats();
  slide.scrollIntoView({ behavior: "smooth", block: "center" });
}

function defaultSlideHtml() {
  return '<section class="inner-slide"><h1>Untitled slides</h1><p>Add your first point.</p></section>';
}

function downloadInnerDoc(format) {
  const doc = selectedInnerDoc();
  if (!doc) return notify("Save or choose a doc first");
  const extension = format === "txt" ? "txt" : "html";
  downloadUrl(`/api/inner-docs/${encodeURIComponent(doc.id)}/download?format=${extension}`, `${safeDownloadName(doc.title)}.${extension}`);
}

function safeDownloadName(value) {
  return String(value || "inner-doc").replace(/[^\w.\- ]+/g, "_").trim().slice(0, 80) || "inner-doc";
}

function setInnerDocPageBody(value) {
  const html = normalizeInnerDocHtml(value);
  if (els.innerDocPage) els.innerDocPage.innerHTML = html;
  if (els.innerDocBody) els.innerDocBody.value = html;
}

function updateInnerDocHiddenBody() {
  if (!els.innerDocBody || !els.innerDocPage) return;
  els.innerDocBody.value = normalizeInnerDocHtml(els.innerDocPage.innerHTML);
}

function updateInnerDocStats() {
  if (!els.innerDocWordCount || !els.innerDocPage) return;
  const text = els.innerDocPage.innerText || "";
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.replace(/\s/g, "").length;
  els.innerDocWordCount.textContent = `${words} words - ${chars} chars`;
}

function cleanInnerDocPaste(event) {
  event.preventDefault();
  const text = (event.clipboardData || window.clipboardData).getData("text/plain");
  document.execCommand("insertText", false, text);
  updateInnerDocHiddenBody();
  updateInnerDocStats();
}

function normalizeInnerDocHtml(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/<[a-z][\s\S]*>/i.test(raw)) {
    const template = document.createElement("template");
    template.innerHTML = raw;
    template.content.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((node) => node.remove());
    template.content.querySelectorAll("*").forEach((node) => {
      [...node.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = String(attr.value || "");
        if (name.startsWith("on") || value.toLowerCase().includes("javascript:")) node.removeAttribute(attr.name);
      });
    });
    return template.innerHTML;
  }
  return raw
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeClientHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function escapeClientHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function shareInnerDoc() {
  const doc = selectedInnerDoc();
  const target = els.innerDocShareTarget ? els.innerDocShareTarget.value : "";
  if (!doc) return notify("Save or choose a doc first");
  if (!target) return notify("Choose an accepted friend or friend group");
  try {
    const data = await api("/api/inner-docs/share", {
      method: "POST",
      json: { id: doc.id, target },
    });
    state.innerDocs = data.innerDocs || state.innerDocs;
    if (data.dm) state.dms = [...state.dms.filter((entry) => entry.id !== data.dm.id), data.dm];
    renderDocs();
    renderDms();
    notify("Doc shared");
  } catch (error) {
    notify(error.message);
  }
}

async function deleteInnerDoc() {
  const doc = selectedInnerDoc();
  if (!doc) return notify("Choose a doc first");
  if (!window.confirm(`Delete "${doc.title}"?`)) return;
  try {
    const data = await api(`/api/inner-docs/${encodeURIComponent(doc.id)}`, { method: "DELETE" });
    state.innerDocs = data.innerDocs || [];
    state.selectedInnerDocId = state.innerDocs[0] ? state.innerDocs[0].id : "";
    renderDocs();
    notify("Doc deleted");
  } catch (error) {
    notify(error.message);
  }
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
    tag.textContent = file.private ? "Private" : file.category;
    header.append(title, tag);

    const meta = document.createElement("div");
    meta.className = "file-meta";
    meta.append(textNode(`${file.kind} - ${formatBytes(file.size)}`), textNode(`Uploaded by ${file.user}`), textNode(formatDate(file.createdAt)));
    if (file.private) meta.append(textNode("Visible only to uploader and admins"));
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
    downloadButton.addEventListener("click", () => downloadUrl(downloadableUrl(file.url), file.originalName));
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
  download.addEventListener("click", () => downloadUrl(downloadableUrl(attachment.url), attachment.originalName || "attachment"));
  actions.append(open, download);
  item.append(actions);
}

function mergeVoicePeers(roomId, peers) {
  const room = roomId || "lobby";
  const merged = new Map(state.voicePeers.filter((peer) => peer.voiceRoomId !== room).map((peer) => [peer.id, peer]));
  (peers || []).forEach((peer) => {
    if (!peer || !peer.id || !peer.voiceRoomId) return;
    const next = { ...(state.peers.get(peer.id) || {}), ...peer };
    state.peers.set(peer.id, next);
    merged.set(peer.id, next);
  });
  state.voicePeers = Array.from(merged.values());
}

function voicePeopleForRoom(roomId) {
  const room = roomId || "lobby";
  const people = new Map();
  state.voicePeers.forEach((peer) => {
    if (peer.voiceRoomId === room) people.set(peer.id, peer);
  });
  state.peers.forEach((peer) => {
    if (peer.voiceRoomId === room) people.set(peer.id, peer);
  });
  return Array.from(people.values()).sort((a, b) => String(a.username || "").localeCompare(String(b.username || "")));
}

function renderVoice() {
  if (!els.voiceRoomSelect) return;
  if (!state.voiceRooms.length) state.voiceRooms = [{ id: "lobby", name: "Lobby Voice" }];
  const rooms = [...state.voiceRooms];
  if (state.voiceRoomId && !rooms.some((room) => room.id === state.voiceRoomId)) {
    rooms.push({ id: state.voiceRoomId, name: callRoomLabel(state.voiceRoomId) });
  }
  els.voiceRoomSelect.replaceChildren(
    ...rooms.map((room) => {
      const option = document.createElement("option");
      option.value = room.id;
      option.textContent = room.name;
      return option;
    })
  );
  els.voiceRoomSelect.value = state.voiceRoomId || state.voiceRooms[0].id;
  const joined = Boolean(state.voiceStream);
  els.joinVoiceButton.disabled = joined || !featureAvailable("voice");
  els.joinVideoButton.disabled = joined || !featureAvailable("voice");
  els.leaveVoiceButton.disabled = !joined;
  els.muteVoiceButton.textContent = state.voiceMuted ? "Unmute" : "Mute";
  els.deafenVoiceButton.textContent = state.voiceDeafened ? "Undeafen" : "Deafen";
  els.cameraVoiceButton.textContent = state.voiceCameraOff ? "Camera on" : "Camera off";
  els.cameraVoiceButton.disabled = !joined || !state.voiceVideoEnabled;
  document.querySelectorAll("[data-soundboard]").forEach((button) => {
    button.disabled = !joined || !featureAvailable("voice");
  });
  if (els.localCallPreview) {
    els.localCallPreview.srcObject = state.voiceStream;
    els.localCallPreview.classList.toggle("hidden", !state.voiceVideoEnabled);
    if (state.voiceStream) playMedia(els.localCallPreview);
  }
  els.voiceState.textContent = !featureAvailable("voice")
    ? lockMessage("voice")
    : joined
      ? `${state.voiceVideoEnabled ? "Video" : "Voice"} call in ${els.voiceRoomSelect.selectedOptions[0]?.textContent || "voice"}`
      : "Choose a room and join voice or video";

  els.voicePeerList.replaceChildren();
  const peers = voicePeopleForRoom(state.voiceRoomId || "lobby");
  if (!peers.length && !joined) {
    els.voicePeerList.append(emptyBlock("No one in voice"));
  } else {
    if (joined) els.voicePeerList.append(adminCard(state.user.username, state.voiceMuted ? "Muted" : "Speaking", [state.voiceVideoEnabled ? state.voiceCameraOff ? "Camera off" : "Video on" : "Voice only", state.voiceDeafened ? "Deafened" : "Listening"]));
    peers.forEach((peer) => {
      if (peer.id !== state.clientId) {
        const pc = state.voiceConnections.get(peer.id);
        const callState = pc ? (pc.connectionState || pc.iceConnectionState || "connecting") : "Waiting";
        els.voicePeerList.append(adminCard(peer.username, peer.muted ? "Muted" : "Voice", [
          peer.videoEnabled ? peer.cameraOff ? "Camera off" : "Video on" : "Voice only",
          peer.deafened ? "Deafened" : "Connected",
          callState,
        ]));
      }
    });
  }
  renderDmCall();
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
  els.serverStateText.textContent = enabled
    ? "Active"
    : `Shutdown${state.settings.shutdownBy ? ` by ${state.settings.shutdownBy}` : ""}`;
  els.roomNameInput.value = state.settings.roomName || "Inner";
  els.signupMode.value = state.settings.signupMode || "request";
  els.requireContact.checked = state.settings.requireContact !== false;
  els.reportEmails.value = Array.isArray(state.settings.reportEmails) ? state.settings.reportEmails.join(", ") : "";
  if (els.chessUrlInput) els.chessUrlInput.value = currentChessUrl();
  if (els.chessFrame && els.chessFrame.src !== currentChessUrl()) els.chessFrame.src = currentChessUrl();
  els.serverEnabled.checked = enabled;

  const admin = isOwner();
  [els.roomNameInput, els.signupMode, els.requireContact, els.reportEmails, els.chessUrlInput, els.serverEnabled, els.saveServerButton, els.shutdownServerButton, els.restartServerButton].forEach((input) => {
    input.disabled = !admin;
  });
  els.shutdownServerButton.disabled = !admin || !enabled;
  els.restartServerButton.disabled = !admin || enabled;
}

function renderEmailStatus() {
  if (!els.emailStatusText) return;
  if (!isOwner()) {
    els.emailStatusText.textContent = "";
    return;
  }
  const status = state.emailStatus || {};
  const providers = status.providers || {};
  const enabledProviders = Object.entries(providers)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name.charAt(0).toUpperCase() + name.slice(1));
  const recipients = Array.isArray(status.recipients) ? status.recipients : [];
  const from = status.from || "not set";
  if (!recipients.length) {
    els.emailStatusText.textContent = "Email alerts need at least one report email in this box.";
    return;
  }
  if (!enabledProviders.length) {
    els.emailStatusText.textContent = "Email alerts need SMTP settings, BREVO_API_KEY, RESEND_API_KEY, SENDGRID_API_KEY, or INNER_EMAIL_WEBHOOK_URL in Render.";
    return;
  }
  els.emailStatusText.textContent = `Email alerts: ${enabledProviders.join(", ")} configured. Sending from ${from} to ${recipients.join(", ")}.`;
}

async function refreshEmailStatus() {
  if (!isOwner()) return;
  const data = await api("/api/email/status");
  state.emailStatus = data.email || state.emailStatus;
  renderEmailStatus();
}

function renderQuickEdit() {
  if (!els.quickEditForm) return;
  const admin = isOwner();
  els.quickEditForm.classList.toggle("hidden", !admin);
  if (!admin) return;
  const custom = state.settings.customizations || {};
  els.quickAppName.value = custom.appName || "";
  els.quickConnectedLabel.value = custom.connectedLabel || "";
  els.quickDisconnectedLabel.value = custom.disconnectedLabel || "";
  els.quickServerOnLabel.value = custom.serverOnLabel || "";
  els.quickServerOffLabel.value = custom.serverOffLabel || "";
  els.quickVersionLabel.value = custom.versionLabel || "";
  if (els.quickUpdateTitle) els.quickUpdateTitle.value = custom.updateTitle || "";
  if (els.quickUpdateNote) els.quickUpdateNote.value = custom.updateNote || "";
  els.quickNotice.value = custom.notice || "";
  els.quickAccent.value = /^#[0-9a-f]{6}$/i.test(custom.accent || "") ? custom.accent : "#245c4f";
  els.quickDensity.value = custom.density || "comfortable";
  els.quickRounded.checked = custom.rounded !== false;
  els.quickCustomCss.value = custom.customCss || "";
}

function renderUsers() {
  if (!els.ownerPasswordForm) return;
  const admin = isOwner();
  [els.ownerPasswordForm, els.createAccountForm, els.accountManager, els.featureLockForm, els.roomForm].forEach((element) => {
    element.classList.toggle("hidden", !admin);
  });
  if (!admin) return;
  if (document.activeElement !== els.accountSearchInput) {
    els.accountSearchInput.value = state.accountSearch || "";
  }
  if (els.accountGradeFilter && document.activeElement !== els.accountGradeFilter) {
    els.accountGradeFilter.value = state.accountGradeFilter || "";
  }

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
  const visibleUsers = filterUsersForAdmin(state.users);
  if (els.showAllAccountsButton) {
    els.showAllAccountsButton.textContent = state.accountShowAll ? "Hide all" : "Show all";
  }
  if (!String(state.accountSearch || "").trim() && !String(state.accountGradeFilter || "").trim() && !state.accountShowAll && !visibleUsers.length) {
    els.accountList.append(emptyBlock("Public admin accounts show here. Search a username/email/phone/IP/device or choose a grade to show more accounts."));
    return;
  }
  if (!state.users.length) {
    els.accountList.append(emptyBlock("No accounts yet"));
    return;
  }
  if (!visibleUsers.length) {
    els.accountList.append(emptyBlock("No accounts match that search"));
    return;
  }

  visibleUsers.forEach((user) => {
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
    if (user.grade) meta.append(textNode(`Grade ${user.grade}`));
    if (user.lastLoginAt) meta.append(textNode(`Last login ${formatDate(user.lastLoginAt)}`));
    if (user.lastLoginIp) meta.append(textNode(`From ${user.lastLoginIp}`));
    if (user.lastLoginDevice) meta.append(textNode(`Device ${user.lastLoginDevice}`));
    if (user.lastLoginApproximateLocation) meta.append(textNode(`Approx ${formatApproxLocation(user.lastLoginApproximateLocation)}`));
    if (user.bannedUntil) meta.append(textNode(`Ban until ${formatDate(user.bannedUntil)}`));
    if (user.banReason) meta.append(textNode(user.banReason));

    const actions = document.createElement("div");
    actions.className = "account-actions";
    const gradeSelect = document.createElement("select");
    gradeSelect.className = "compact-select account-grade-select";
    gradeSelect.setAttribute("aria-label", `Grade for ${user.username}`);
    gradeOptions().forEach((option) => gradeSelect.append(option));
    gradeSelect.value = normalizeClientGrade(user.grade || "");
    gradeSelect.disabled = isMainAdmin;
    const gradeButton = accountButton("Save grade", () =>
      updateUser(user.username, { grade: gradeSelect.value })
    );
    gradeButton.disabled = isMainAdmin;
    const roleButton = accountButton(`Change to ${nextRoleLabel(user.role)}`, () =>
      updateUser(user.username, { role: nextRole(user.role) })
    );
    roleButton.disabled = isMainAdmin;
    const persistentButton = accountButton(user.allowPersistentLogin ? "Disable persistent" : "Allow persistent", () =>
      updateUser(user.username, { allowPersistentLogin: !user.allowPersistentLogin })
    );
    const banFive = accountButton("Ban 5m", () => banUser(user.username, 5));
    const banShort = accountButton("Ban 15m", () => banUser(user.username, 15));
    const banHour = accountButton("Ban 1h", () => banUser(user.username, 60));
    const banDay = accountButton("Ban 24h", () => banUser(user.username, 1440));
    const unban = accountButton("Unban", () => banUser(user.username, 0));
    const remove = accountButton("Delete", () => deleteUser(user.username));
    banFive.disabled = isMainAdmin;
    banShort.disabled = isMainAdmin;
    banHour.disabled = isMainAdmin;
    banDay.disabled = isMainAdmin;
    unban.disabled = isMainAdmin;
    remove.disabled = isMainAdmin || isCurrentUser;
    actions.append(gradeSelect, gradeButton, roleButton, persistentButton, banFive, banShort, banHour, banDay, unban, remove);

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

function renderFeatureVisibility() {
  if (!els.featureVisibilityList || !isOwner()) return;
  const feature = els.visibilityFeatureName ? els.visibilityFeatureName.value || "messages" : "messages";
  const rules = state.settings.featureVisibility || {};
  const current = rules[feature] || { hidden: false, allowedUsers: [] };
  if (els.visibilityHidden) els.visibilityHidden.checked = Boolean(current.hidden);
  if (els.visibilityAllowedUsers && document.activeElement !== els.visibilityAllowedUsers) {
    els.visibilityAllowedUsers.value = Array.isArray(current.allowedUsers) ? current.allowedUsers.join(", ") : "";
  }
  els.featureVisibilityList.replaceChildren();
  const visibleRules = Object.entries(rules).filter(([, rule]) => rule && (rule.hidden || (rule.allowedUsers || []).length));
  if (!visibleRules.length) {
    els.featureVisibilityList.append(emptyBlock("No hidden tab rules"));
    return;
  }
  visibleRules.forEach(([name, rule]) => {
    els.featureVisibilityList.append(adminCard(featureLabel(name), rule.hidden ? "Hidden" : "Visible", [
      (rule.allowedUsers || []).length ? `Allowed: ${(rule.allowedUsers || []).join(", ")}` : "No allowed users",
    ]));
  });
}

function renderPaywalls() {
  if (!els.paywallList || !isOwner()) return;
  const items = state.store.items || [];
  if (els.paywallItemId) {
    const previous = els.paywallItemId.value;
    els.paywallItemId.replaceChildren(
      optionElement("", "Choose a Store item"),
      ...items.map((item) => optionElement(item.id, `${item.name} - ${formatMoney(item.priceCents, item.currency)}`))
    );
    els.paywallItemId.value = previous;
  }
  const feature = els.paywallFeatureName ? els.paywallFeatureName.value || "messages" : "messages";
  const rules = state.settings.paywalls || {};
  const current = rules[feature] || { enabled: false, itemId: "", message: "" };
  if (els.paywallEnabled) els.paywallEnabled.checked = Boolean(current.enabled);
  if (els.paywallItemId && current.itemId) els.paywallItemId.value = current.itemId;
  if (els.paywallMessage && document.activeElement !== els.paywallMessage) els.paywallMessage.value = current.message || "";
  els.paywallList.replaceChildren();
  const visibleRules = Object.entries(rules).filter(([, rule]) => rule && (rule.enabled || rule.itemId));
  if (!visibleRules.length) {
    els.paywallList.append(emptyBlock("No paywalls"));
    return;
  }
  visibleRules.forEach(([name, rule]) => {
    const item = items.find((entry) => entry.id === rule.itemId);
    els.paywallList.append(adminCard(featureLabel(name), rule.enabled ? "Enabled" : "Off", [
      item ? `Pass: ${item.name}` : "No Store item selected",
      rule.message || "",
    ].filter(Boolean)));
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
    meta.append(textNode(room.private ? "Private room" : "Public room"));
    if (room.inviteOnly) meta.append(textNode("Invite only"));
    if (room.requiresPassword) meta.append(textNode("Password protected"));
    if (Array.isArray(room.allowedUsers) && room.allowedUsers.length) meta.append(textNode(`Allowed ${room.allowedUsers.join(", ")}`));

    const actions = document.createElement("div");
    actions.className = "account-actions";
    const open = accountButton("Open", () => {
      state.selectedRoomId = room.id;
      renderRooms();
      showView("messages");
      renderMessages();
    });
    const invite = accountButton("Invite", () => createRoomInvite(room.id, room.name));
    const remove = accountButton("Delete", () => deleteRoom(room.id));
    invite.disabled = room.id === "main";
    remove.disabled = room.id === "main";
    actions.append(open, invite, remove);

    item.append(head, meta, actions);
    els.roomManagerList.append(item);
  });
}

const serviceScaleLabels = [
  { key: "messages", title: "Messages", detail: "Render web service + JSON/database writes", baseUsd: 7, provider: "Render", url: "https://render.com/pricing" },
  { key: "dms", title: "DMs", detail: "Render web service + realtime message storage", baseUsd: 4, provider: "Render", url: "https://render.com/pricing" },
  { key: "uploads", title: "Uploads", detail: "Cloudinary/file storage and bandwidth", baseUsd: 10, provider: "Cloudinary", url: "https://cloudinary.com/pricing" },
  { key: "voice", title: "Voice calls", detail: "TURN/WebRTC relay usage planning", baseUsd: 12, provider: "Open Relay / TURN", url: "https://www.metered.ca/tools/openrelay/" },
  { key: "screen", title: "Screen share", detail: "TURN bandwidth for screen/video streams", baseUsd: 14, provider: "TURN relay", url: "https://www.metered.ca/tools/openrelay/" },
  { key: "notifications", title: "Notifications", detail: "Browser alerts + email provider", baseUsd: 3, provider: "Resend", url: "https://resend.com/pricing" },
  { key: "moderation", title: "Moderation", detail: "Logs, reports, and admin review tools", baseUsd: 4, provider: "Render", url: "https://render.com/pricing" },
  { key: "realtime", title: "Realtime", detail: "WebSocket connection load on Render", baseUsd: 6, provider: "Render", url: "https://render.com/pricing" },
  { key: "domain", title: "Domain", detail: "Custom domain / DNS planning", baseUsd: 1, provider: "Cloudflare / Registrar", url: "https://www.cloudflare.com/products/registrar/" },
];

const usdToInrEstimate = 85;

function defaultServiceScale() {
  return {
    messages: 100,
    dms: 100,
    uploads: 100,
    voice: 100,
    screen: 100,
    notifications: 100,
    moderation: 100,
    realtime: 100,
    domain: 100,
  };
}

function renderServiceScale() {
  if (!els.serviceScaleList) return;
  const admin = isOwner();
  els.serviceScaleForm.classList.toggle("hidden", !admin);
  if (!admin) return;
  const scale = { ...defaultServiceScale(), ...(state.settings.serviceScale || {}) };
  let total = 0;
  els.serviceScaleList.replaceChildren();
  serviceScaleLabels.forEach((service) => {
    const { key, title, detail, baseUsd, provider, url } = service;
    const value = scale[key] || 100;
    const estimatedCost = Math.round((Number(baseUsd || 0) * value) / 100);
    total += estimatedCost;
    const row = document.createElement("label");
    row.className = "scale-row";
    const text = document.createElement("span");
    text.innerHTML = `<strong>${title}</strong><small>${detail}</small><a href="${url}" target="_blank" rel="noopener">${provider} pricing</a><em>Estimate: $${estimatedCost}/mo - Rs ${formatInr(estimatedCost)}/mo</em>`;
    const output = document.createElement("b");
    output.textContent = `${value}%`;
    const input = document.createElement("input");
    input.type = "range";
    input.min = "25";
    input.max = "200";
    input.step = "5";
    input.value = String(value);
    input.dataset.scaleKey = key;
    input.addEventListener("input", () => {
      output.textContent = `${input.value}%`;
      renderServiceScaleCostSummary();
    });
    row.append(text, input, output);
    els.serviceScaleList.append(row);
  });
  renderServiceScaleCostSummary(total);
}

function renderServiceScaleCostSummary(presetTotal) {
  if (!els.serviceScaleCostSummary) return;
  const inputs = Array.from(els.serviceScaleList.querySelectorAll("[data-scale-key]"));
  const total = typeof presetTotal === "number"
    ? presetTotal
    : inputs.reduce((sum, input) => {
        const meta = serviceScaleLabels.find((service) => service.key === input.dataset.scaleKey);
        const baseCost = meta ? Number(meta.baseUsd || 0) : 0;
        return sum + Math.round((baseCost * Number(input.value || 100)) / 100);
      }, 0);
  const rupees = formatInr(total);
  els.serviceScaleCostSummary.textContent = `Rough monthly bill: about $${total}/month, around Rs ${rupees}/month. Planning rate: $1 = Rs ${usdToInrEstimate}. Real billing comes from Render, Cloudinary, Resend, TURN, domain/DNS, and actual usage.`;
  if (els.domainBillSummary) {
    els.domainBillSummary.textContent = `Rough monthly bill for the whole app: about $${total}/month, around Rs ${rupees}/month. Domain alone is estimated around $1/month or Rs ${formatInr(1)}/month, usually billed yearly by your registrar.`;
  }
}

function formatInr(usd) {
  return Math.round(Number(usd || 0) * usdToInrEstimate).toLocaleString("en-IN");
}

function renderAdminDms() {
  if (!els.adminDmList || !isOwner()) return;
  const people = [
    { value: "all", label: "All DMs" },
    ...state.people.map((person) => ({ value: person.username, label: person.username })),
    ...(state.dmGroups || []).map((group) => ({ value: `group:${group.id}`, label: `Group: ${group.name}` })),
  ];
  els.adminDmFilter.replaceChildren(
    ...people.map((entry) => {
      const option = document.createElement("option");
      option.value = entry.value;
      option.textContent = entry.label;
      return option;
    })
  );
  if (!people.some((entry) => entry.value === state.adminDmFilter)) state.adminDmFilter = "all";
  els.adminDmFilter.value = state.adminDmFilter;

  els.adminDmList.replaceChildren();
  const visible =
    state.adminDmFilter === "all"
      ? state.dms
      : state.adminDmFilter.startsWith("group:")
        ? state.dms.filter((dm) => dm.groupId === state.adminDmFilter.slice(6))
        : state.dms.filter((dm) => dm.from === state.adminDmFilter || dm.to === state.adminDmFilter || (dm.participants || []).includes(state.adminDmFilter));

  if (!visible.length) {
    els.adminDmList.append(emptyBlock("No DMs to review"));
    return;
  }

  visible.slice(-250).forEach((dm) => {
    els.adminDmList.append(renderMessageBubble({
      mine: false,
      title: dmTitle(dm),
      text: dm.text,
      createdAt: dm.createdAt,
      sourceIp: dm.sourceIp,
      attachment: dm.attachment,
      onDelete: () => deleteDm(dm.id),
    }));
  });
}

function renderAdminReadReceipts() {
  if (!els.adminReadReceiptList || !isOwner()) return;
  els.adminReadReceiptList.replaceChildren();
  const entries = Object.entries(state.readReceipts || {})
    .map(([key, value]) => {
      const [context, ...targetParts] = key.split(":");
      const targetId = targetParts.join(":") || "main";
      const readers = Object.entries(value || {})
        .filter(([, seenAt]) => Date.parse(seenAt))
        .sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]));
      return { key, context, targetId, readers };
    })
    .filter((entry) => entry.readers.length)
    .sort((a, b) => Date.parse(b.readers[0][1]) - Date.parse(a.readers[0][1]));

  if (!entries.length) {
    els.adminReadReceiptList.append(emptyBlock("No read receipts yet"));
    return;
  }

  entries.slice(0, 160).forEach((entry) => {
    const label = readReceiptTargetLabel(entry.context, entry.targetId);
    const lines = entry.readers.slice(0, 8).map(([username, seenAt]) => `${username} - ${formatDate(seenAt)}`);
    if (entry.readers.length > 8) lines.push(`${entry.readers.length - 8} more`);
    els.adminReadReceiptList.append(adminCard(label, entry.context, lines));
  });
}

function readReceiptTargetLabel(context, targetId) {
  if (context === "messages") {
    const room = state.rooms.find((entry) => entry.id === targetId);
    return `Room: ${room ? room.name : targetId || "Main"}`;
  }
  if (context === "group") {
    const group = state.dmGroups.find((entry) => entry.id === targetId);
    return `Group DM: ${group ? group.name : targetId}`;
  }
  return `DM: ${targetId || "direct"}`;
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
    const restore = accountButton("Restore", () => restoreBackup(backup.fileName));
    const remove = accountButton("Delete", () => deleteBackup(backup.fileName));
    actions.append(download, restore, remove);

    item.append(head, meta, actions);
    els.backupList.append(item);
  });
}

function renderAccountRequests() {
  if (!els.accountRequestList || !isOwner()) return;
  els.accountRequestList.replaceChildren();
  if (!state.accountRequests.length) {
    els.accountRequestList.append(emptyBlock("No account requests"));
    return;
  }

  state.accountRequests.slice(0, 150).forEach((request) => {
    const status = request.status || "pending";
    const location = request.location
      ? `${Number(request.location.latitude).toFixed(4)}, ${Number(request.location.longitude).toFixed(4)} accuracy ${Math.round(Number(request.location.accuracy || 0))}m`
      : "No location";
    const card = adminCard(request.username, status, [
      request.displayName ? `Name ${request.displayName}` : "",
      `Requested type ${request.requestedRole || "member"}`,
      request.grade ? `Grade ${request.grade}` : "",
      request.contact ? `Contact ${request.contact}` : "",
      request.note,
      `Location ${location}`,
      request.sourceIp ? `From ${request.sourceIp}` : "",
      `Requested ${formatDate(request.createdAt)}`,
      request.updatedBy ? `Updated by ${request.updatedBy}` : "",
    ].filter(Boolean));
    const actions = document.createElement("div");
    actions.className = "account-actions";
    const create = accountButton("Create account", () => approveAccountRequest(request.id, request.username, request.requestedRole || "member"));
    const reviewing = accountButton("Reviewing", () => updateAccountRequest(request.id, "reviewing"));
    const decline = accountButton("Decline", () => updateAccountRequest(request.id, "declined"));
    create.disabled = status === "approved";
    actions.append(create, reviewing, decline);
    card.append(actions);
    els.accountRequestList.append(card);
  });
}

function renderReports() {
  if (els.reportList && isOwner()) {
    els.reportList.replaceChildren();
    const activeReports = (state.reports || []).filter((report) => !["done", "closed", "resolved", "dismissed"].includes(String(report.status || "").toLowerCase()));
    if (!activeReports.length) {
      els.reportList.append(emptyBlock("No reports"));
    } else {
      activeReports.slice(0, 100).forEach((report) => {
        const card = adminCard(`${report.targetType} ${report.targetId}`, report.status, [
          `Reported by ${report.reporter}`,
          contactLine("Reporter", report.reporterContact),
          report.targetSender ? `Message from ${report.targetSender}` : "Message sender unknown",
          contactLine("Sender", report.targetSenderContact),
          report.targetText ? `Message: ${report.targetText}` : "Message text unavailable",
          report.reason,
          formatDate(report.createdAt),
        ]);
        const actions = document.createElement("div");
        actions.className = "account-actions";
        actions.append(
          accountButton("Mark seen", () => updateReport(report.id, "reviewing")),
          accountButton("Done", () => updateReport(report.id, "done"))
        );
        card.append(actions);
        els.reportList.append(card);
      });
    }
  }

  if (els.moderationLogList && isOwner()) {
    els.moderationLogList.replaceChildren();
    const visibleModerationLogs = filteredModerationLogs();
    if (!state.moderationLogs.length) {
      els.moderationLogList.append(emptyBlock("No moderation logs"));
    } else if (!visibleModerationLogs.length) {
      els.moderationLogList.append(emptyBlock("No moderation logs match those filters"));
    } else {
      visibleModerationLogs.slice(0, 120).forEach((log) => {
        els.moderationLogList.append(adminCard(log.action, log.actor, [
          log.target || "",
          log.note || "",
          formatDate(log.createdAt),
        ].filter(Boolean)));
      });
    }
  }
}

function renderLiveIpTracking() {
  if (!els.liveIpList || !isOwner()) return;
  els.liveIpList.replaceChildren();
  const rows = state.liveIpTracking || [];
  if (!rows.length) {
    els.liveIpList.append(emptyBlock("No IP activity yet"));
    return;
  }
  rows.slice(0, 120).forEach((row) => {
    const title = `${row.username || "unknown"}${row.live ? " live" : ""}`;
    els.liveIpList.append(adminCard(title, row.role || "member", [
      row.ip ? `IP ${row.ip}` : "IP unknown",
      row.device ? `Device ${row.device}` : "",
      row.network && row.network.effectiveType ? `Network ${row.network.effectiveType}${row.network.downlink ? `, ${row.network.downlink} Mbps` : ""}` : "",
      row.network && row.network.rtt ? `RTT ${row.network.rtt} ms` : "",
      row.network && row.network.saveData ? "Data saver on" : "",
      row.approximateLocation ? `Approx ${row.approximateLocation.note || row.approximateLocation.ip || JSON.stringify(row.approximateLocation)}` : "",
      row.lastSeenAt ? `Last seen ${formatDate(row.lastSeenAt)}` : "",
      row.source ? `Source ${row.source}` : "",
    ].filter(Boolean)));
  });
}

async function updateReport(id, status) {
  try {
    const data = await api("/api/reports/update", {
      method: "POST",
      json: { id, status },
    });
    state.reports = data.reports || [];
    renderReports();
    notify(status === "done" ? "Report removed" : "Report updated");
  } catch (error) {
    notify(error.message);
  }
}

function contactLine(label, contact) {
  if (!contact || typeof contact !== "object") return "";
  const parts = [contact.email, contact.phone, contact.contact].filter(Boolean);
  return parts.length ? `${label} contact: ${parts.join(" / ")}` : "";
}

function renderLogs() {
  if (!els.logList || !isOwner()) return;
  if (document.activeElement !== els.logSearchInput) els.logSearchInput.value = state.logSearch || "";
  if (document.activeElement !== els.logDateInput) els.logDateInput.value = state.logDate || "";
  els.logList.replaceChildren();
  const visibleLogs = filteredSystemLogs();
  if (!state.logs.length) {
    els.logList.append(emptyBlock("No system logs yet"));
    return;
  }
  if (!visibleLogs.length) {
    els.logList.append(emptyBlock("No logs match those filters"));
    return;
  }
  visibleLogs.slice(0, 160).forEach((log) => {
    const details = log.details && typeof log.details === "object"
      ? Object.entries(log.details).slice(0, 4).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
      : [];
    els.logList.append(adminCard(log.action || "event", log.actor || "system", [
      ...details,
      log.sourceIp ? `From ${log.sourceIp}` : "",
      formatDate(log.createdAt),
    ]));
  });
}

function renderHmd() {
  if (!els.hmdMetricGrid || !isDev()) return;
  const dev = state.dev || {};
  const config = dev.devConfig || {};
  const counts = dev.counts || {};
  const storage = dev.storage || {};
  els.hmdState.textContent = config.emergencyMode ? "Emergency mode active" : "Developer controls ready";
  els.hmdMetricGrid.replaceChildren(
    metricCard("Online", counts.online || 0, "Presence sessions"),
    metricCard("Users", counts.users || state.users.length || 0, "Accounts"),
    metricCard("Messages", counts.messages || state.messages.length || 0, "Stored messages"),
    metricCard("Requests", counts.accountRequests || state.accountRequests.length || 0, "Account intake"),
    metricCard("Logs", counts.logs || state.logs.length || 0, "System events"),
    metricCard("Storage", formatBytes(storage.totalUploadBytes || 0), "Uploaded files")
  );
  els.devEmergencyMode.checked = Boolean(config.emergencyMode);
  els.devMetricsEnabled.checked = config.metricsEnabled !== false;
  els.devTheme.value = config.theme || "midnight";

  els.databaseList.replaceChildren(
    adminCard("Rooms", String(counts.rooms || state.rooms.length || 0), ["Room/channel records"]),
    adminCard("DMs", String(counts.dms || state.dms.length || 0), ["Direct message records"]),
    adminCard("DM groups", String(counts.dmGroups || state.dmGroups.length || 0), ["Group conversation records"]),
    adminCard("Logs", String(counts.logs || state.logs.length || 0), ["System log records"]),
    adminCard("Reports", String(counts.reports || state.reports.length || 0), ["Moderation queue"]),
    adminCard("Orders", String(counts.orders || 0), ["Store order records"])
  );
  els.storageList.replaceChildren(
    adminCard("Uploads", String(storage.uploadCount || state.files.length || 0), [formatBytes(storage.totalUploadBytes || 0)]),
    adminCard("Inline backups", String(storage.inlineBackedCount || 0), [formatBytes(storage.inlineBytes || 0), `Limit ${formatBytes(storage.inlineLimitBytes || 0)}`]),
    adminCard("Data files", String(storage.dataFileCount || 0), [storage.dataDir || "data"])
  );
  renderLocalhostTools(dev.local || {});
  renderSimpleList(els.botList, state.bots, "No bots", (bot) => adminCard(bot.name, bot.enabled ? "Enabled" : "Off", [bot.description || "", bot.commandPrefix || "/"].filter(Boolean)));
  renderSimpleList(els.pluginList, state.plugins, "No plugins", (plugin) => adminCard(plugin.name, plugin.enabled ? "Enabled" : "Off", [plugin.hook || "", plugin.notes || ""].filter(Boolean)));

  els.automodEnabled.checked = Boolean(state.automod.enabled);
  els.automodWindow.value = state.automod.spamWindowSeconds || 8;
  els.automodMax.value = state.automod.maxMessagesPerWindow || 6;
  els.automodWords.value = (state.automod.mutedWords || []).join("\n");
}

function renderAdminAutomod() {
  if (!els.adminAutomodForm) return;
  const admin = isOwner();
  els.adminAutomodForm.classList.toggle("hidden", !admin);
  if (!admin) return;
  els.adminAutomodEnabled.checked = Boolean(state.automod.enabled);
  els.adminAutomodWindow.value = state.automod.spamWindowSeconds || 8;
  els.adminAutomodMax.value = state.automod.maxMessagesPerWindow || 6;
  els.adminAutomodWords.value = (state.automod.mutedWords || []).join("\n");
}

function renderLocalhostTools(local) {
  if (!els.localhostToolList) return;
  els.localhostToolList.replaceChildren();
  const lanLinks = Array.isArray(local.lanLinks) ? local.lanLinks : [];
  const cards = [
    adminCard("Mode", local.localhostMode ? "Localhost" : "Cloud", [
      `Host ${local.host || "0.0.0.0"}`,
      `Port ${local.port || location.port || "80"}`,
      `Storage ${local.storageMode || "local"}`,
    ]),
    adminCard("Loopback", local.loopback || `${location.protocol}//127.0.0.1:${location.port || "3000"}`, [
      "Use this on the same PC running Inner.",
    ]),
    adminCard("Data folder", local.dataDir || "data", [
      local.uploadDir ? `Uploads ${local.uploadDir}` : "",
      local.cloudRequired ? "Cloud storage required" : "Local upload fallback allowed",
    ].filter(Boolean)),
  ];
  cards.forEach((card, index) => {
    const actions = document.createElement("div");
    actions.className = "account-actions";
    if (index === 1 && local.loopback) actions.append(accountButton("Copy", () => copyText(local.loopback)));
    card.append(actions);
    els.localhostToolList.append(card);
  });
  if (lanLinks.length) {
    lanLinks.forEach((link) => {
      const card = adminCard("LAN link", link, ["Use on phones or other devices on the same Wi-Fi."]);
      const actions = document.createElement("div");
      actions.className = "account-actions";
      actions.append(accountButton("Copy", () => copyText(link)));
      card.append(actions);
      els.localhostToolList.append(card);
    });
  } else {
    els.localhostToolList.append(adminCard("LAN link", "Not detected", ["Start localhost mode on Wi-Fi to expose a phone testing URL."]));
  }
}

function renderSimpleList(container, items, emptyText, factory) {
  container.replaceChildren();
  if (!items || !items.length) {
    container.append(emptyBlock(emptyText));
    return;
  }
  items.forEach((item) => container.append(factory(item)));
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
      ? "AI connection is configured. Ask for small safe changes."
      : "AI is not configured. Add any OpenAI-compatible key, base URL, and model below.";
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
  const friendsEnabled = serverEnabled && featureAvailable("friends");
  const voiceEnabled = serverEnabled && featureAvailable("voice");
  const invitesEnabled = serverEnabled && featureAvailable("invites");
  const dmCallReady = dmsEnabled && Boolean(currentDmCallRoom());
  els.roomSelect.disabled = !featureAvailable("rooms") && room.id !== "main";
  els.inviteCodeInput.disabled = !invitesEnabled;
  els.joinInviteButton.disabled = !invitesEnabled;
  els.messageInput.disabled = !messagesEnabled;
  els.messageAttachment.disabled = !messagesEnabled;
  els.messageSelfieButton.disabled = !messagesEnabled;
  els.sendMessageButton.disabled = !messagesEnabled;
  els.dmPeerSelect.disabled = !dmsEnabled && !state.selectedDmUser;
  els.dmInput.disabled = !dmsEnabled;
  els.dmAttachment.disabled = !dmsEnabled;
  els.dmSelfieButton.disabled = !dmsEnabled;
  els.sendDmButton.disabled = !dmsEnabled;
  els.dmGroupName.disabled = !dmsEnabled;
  els.dmGroupMembers.classList.toggle("disabled", !dmsEnabled);
  els.dmGroupMembers.querySelectorAll("input").forEach((input) => {
    input.disabled = !dmsEnabled;
  });
  els.createDmGroupButton.disabled = !dmsEnabled || (!isOwner() && dmGroupCandidatePeople().length < 2);
  els.dmVoiceCallButton.disabled = !dmCallReady || Boolean(state.voiceStream);
  els.dmVideoCallButton.disabled = !dmCallReady || Boolean(state.voiceStream);
  els.dmShareScreenButton.disabled = !dmCallReady || Boolean(state.localStream) || !screenEnabled;
  els.dmStopScreenButton.disabled = !(state.localStream && state.screenRoomId === currentDmCallRoom());
  els.dmLeaveCallButton.disabled = !(state.voiceStream && state.voiceRoomId === currentDmCallRoom());
  els.fileInput.disabled = !filesEnabled;
  els.fileCategory.disabled = !filesEnabled;
  els.privateUpload.disabled = !filesEnabled;
  els.uploadButton.disabled = !filesEnabled;
  els.friendUserSelect.disabled = !friendsEnabled;
  els.sendFriendRequestButton.disabled = !friendsEnabled;
  els.joinVoiceButton.disabled = !voiceEnabled || Boolean(state.voiceStream);
  els.joinVideoButton.disabled = !voiceEnabled || Boolean(state.voiceStream);
  els.cameraVoiceButton.disabled = !voiceEnabled || !Boolean(state.voiceStream) || !state.voiceVideoEnabled;
  els.startShareButton.disabled = !screenEnabled || Boolean(state.localStream);
  document.querySelectorAll("[data-soundboard]").forEach((button) => {
    button.disabled = !voiceEnabled || !Boolean(state.voiceStream);
  });
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

function queueOutgoingMessage(item) {
  const localId = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const queued = {
    ...item,
    localId,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  if (queued.kind === "message") {
    state.messages.push({
      id: localId,
      localId,
      local: true,
      status: "pending",
      roomId: queued.roomId || "main",
      parentId: queued.parentId || "",
      text: queued.text,
      attachment: queued.attachment,
      mentions: mentionNames(queued.text),
      reactions: {},
      user: state.user.username,
      createdAt: queued.createdAt,
    });
    state.pendingSends.push(queued);
    renderShell();
    renderMessages();
    requestAnimationFrame(() => scrollToBottom(els.messageList));
  } else {
    state.dms.push({
      id: localId,
      localId,
      local: true,
      status: "pending",
      kind: queued.groupId ? "group" : "direct",
      from: state.user.username,
      to: queued.groupId ? currentDmCallLabel() : queued.to,
      groupId: queued.groupId || "",
      groupName: queued.groupId ? currentDmCallLabel() : "",
      participants: selectedDmParticipants(),
      text: queued.text,
      attachment: queued.attachment,
      createdAt: queued.createdAt,
    });
    state.pendingSends.push(queued);
    renderDms();
    requestAnimationFrame(() => scrollToBottom(els.dmList));
  }
  savePendingSends();
  sendPendingItem(queued).catch(() => {});
}

async function sendPendingItem(item) {
  if (item.sending) return;
  item.sending = true;
  try {
    const payload = item.kind === "message"
      ? { text: item.text, attachment: item.attachment, roomId: item.roomId || "main", parentId: item.parentId || "" }
      : { to: item.to || "", groupId: item.groupId || "", text: item.text, attachment: item.attachment };
    const data = await api(item.kind === "message" ? "/api/messages" : "/api/dms", {
      method: "POST",
      json: payload,
    });
    state.pendingSends = state.pendingSends.filter((entry) => entry.localId !== item.localId);
    if (item.kind === "message") {
      state.messages = state.messages.filter((entry) => entry.localId !== item.localId);
      addMessage(data.message);
    } else {
      state.dms = state.dms.filter((entry) => entry.localId !== item.localId);
      addDm(data.dm);
    }
    savePendingSends();
  } catch (error) {
    item.sending = false;
    markPendingFailed(item.localId, error.message || "Send failed");
  }
}

function markPendingFailed(localId, errorMessage) {
  const pending = state.pendingSends.find((entry) => entry.localId === localId);
  if (pending) {
    pending.status = "failed";
    pending.error = errorMessage;
  }
  [...state.messages, ...state.dms].forEach((entry) => {
    if (entry.localId === localId) {
      entry.status = "failed";
      entry.error = errorMessage;
    }
  });
  savePendingSends();
  renderMessages();
  renderDms();
}

function retryPending(localId) {
  const pending = state.pendingSends.find((entry) => entry.localId === localId);
  if (!pending) return;
  pending.status = "pending";
  [...state.messages, ...state.dms].forEach((entry) => {
    if (entry.localId === localId) entry.status = "pending";
  });
  savePendingSends();
  renderMessages();
  renderDms();
  sendPendingItem(pending).catch(() => {});
}

function flushPendingSends() {
  if (!state.pendingSends.length) return;
  state.pendingSends.forEach((entry) => {
    entry.status = "pending";
    sendPendingItem(entry).catch(() => {});
  });
}

function savePendingSends() {
  try {
    localStorage.setItem("innerPendingSends", JSON.stringify(state.pendingSends.slice(-50)));
  } catch (error) {
    // Pending recovery is best effort.
  }
}

function restorePendingSends() {
  try {
    state.pendingSends = JSON.parse(localStorage.getItem("innerPendingSends") || "[]").filter((entry) => entry && entry.localId);
  } catch (error) {
    state.pendingSends = [];
  }
  state.pendingSends.forEach((queued) => {
    if (queued.kind === "message" && !state.messages.some((entry) => entry.localId === queued.localId)) {
      state.messages.push({
        id: queued.localId,
        localId: queued.localId,
        local: true,
        status: queued.status || "failed",
        roomId: queued.roomId || "main",
        parentId: queued.parentId || "",
        text: queued.text,
        attachment: queued.attachment,
        reactions: {},
        user: state.user.username,
        createdAt: queued.createdAt || new Date().toISOString(),
      });
    } else if (queued.kind === "dm" && !state.dms.some((entry) => entry.localId === queued.localId)) {
      state.dms.push({
        id: queued.localId,
        localId: queued.localId,
        local: true,
        status: queued.status || "failed",
        kind: queued.groupId ? "group" : "direct",
        from: state.user.username,
        to: queued.groupId ? "Group" : queued.to,
        groupId: queued.groupId || "",
        groupName: queued.groupId ? "Group" : "",
        participants: [],
        text: queued.text,
        attachment: queued.attachment,
        createdAt: queued.createdAt || new Date().toISOString(),
      });
    }
  });
}

function mentionNames(text) {
  return Array.from(new Set(String(text || "").match(/@([a-zA-Z0-9._-]{3,32})/g) || [])).map((entry) => entry.slice(1));
}

async function deleteMessage(id) {
  if (!isOwner()) return notify("Admin access required");
  try {
    await api(`/api/messages/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (error) {
    notify(error.message);
  }
}

async function editMessage(id, currentText) {
  const text = window.prompt("Edit message", currentText || "");
  if (!text || text.trim() === currentText) return;
  try {
    const data = await api(`/api/messages/${encodeURIComponent(id)}`, {
      method: "PATCH",
      json: { text },
    });
    const index = state.messages.findIndex((entry) => entry.id === id);
    if (index !== -1) state.messages[index] = data.message;
    renderMessages();
  } catch (error) {
    notify(error.message);
  }
}

async function editDm(id, currentText) {
  const text = window.prompt("Edit DM", currentText || "");
  if (!text || text.trim() === currentText) return;
  try {
    const data = await api(`/api/dms/${encodeURIComponent(id)}`, {
      method: "PATCH",
      json: { text },
    });
    const index = state.dms.findIndex((entry) => entry.id === id);
    if (index !== -1) state.dms[index] = data.dm;
    renderDms();
  } catch (error) {
    notify(error.message);
  }
}

async function reactMessage(id, emoji) {
  try {
    const data = await api(`/api/messages/${encodeURIComponent(id)}/reactions`, {
      method: "POST",
      json: { emoji },
    });
    const index = state.messages.findIndex((entry) => entry.id === id);
    if (index !== -1) state.messages[index] = data.message;
    renderMessages();
  } catch (error) {
    notify(error.message);
  }
}

async function reportMessage(id) {
  const reason = window.prompt("Why are you reporting this message?") || "";
  if (!reason.trim()) return;
  try {
    await api("/api/reports", {
      method: "POST",
      json: { targetType: "message", targetId: id, reason },
    });
    notify("Report sent");
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

async function restoreBackup(fileName) {
  if (!isOwner()) return notify("Admin access required");
  if (!window.confirm(`Restore ${fileName}? Inner will create a safety backup first, then replace accounts/messages/settings with this backup.`)) return;
  try {
    const data = await api("/api/backups/restore", {
      method: "POST",
      json: { fileName },
    });
    state.backups = data.backups || state.backups;
    notify("Backup restored. Reloading...");
    setTimeout(() => location.reload(), 900);
  } catch (error) {
    notify(error.message);
  }
}

async function updateAccountRequest(id, status) {
  if (!isOwner()) return notify("Admin access required");
  try {
    const data = await api("/api/account-requests/update", {
      method: "POST",
      json: { id, status },
    });
    state.accountRequests = data.accountRequests || state.accountRequests;
    renderAccountRequests();
    notify("Request updated");
  } catch (error) {
    notify(error.message);
  }
}

async function approveAccountRequest(id, username, requestedRole = "member") {
  if (!isOwner()) return notify("Admin access required");
  const password = window.prompt(`Set a password for ${username}. Leave blank to use the requested password.`);
  if (password === null) return;
  const roleInput = window.prompt(`Account type for ${username}`, requestedRole || "member");
  const role = normalizeRoleInput(roleInput || requestedRole || "member");
  try {
    const data = await api("/api/account-requests/approve", {
      method: "POST",
      json: { id, password, role },
    });
    state.users = data.users || state.users;
    state.accountRequests = data.accountRequests || state.accountRequests;
    renderUsers();
    renderAccountRequests();
    renderDms();
    notify("Account created");
  } catch (error) {
    notify(error.message);
  }
}

function normalizeRoleInput(role) {
  const value = String(role || "member").trim().toLowerCase();
  return ["member", "moderator", "admin", "hmd", "dev"].includes(value) ? value : "member";
}

function accountButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ghost-light-button compact-button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function gradeOptions() {
  const grades = [
    ["", "No grade"],
    ["6", "Grade 6"],
    ["7", "Grade 7"],
    ["8", "Grade 8"],
    ["9", "Grade 9"],
    ["10", "Grade 10"],
    ["11", "Grade 11"],
    ["12", "Grade 12"],
    ["college", "College"],
    ["staff", "Staff"],
    ["other", "Other"],
  ];
  return grades.map(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  });
}

function normalizeClientGrade(grade) {
  const value = String(grade || "").trim().toLowerCase();
  return ["6", "7", "8", "9", "10", "11", "12", "college", "staff", "other"].includes(value) ? value : "";
}

function nextRole(role) {
  const roles = isDev() ? ["member", "moderator", "admin", "hmd", "dev"] : ["member", "moderator", "admin"];
  const index = roles.indexOf(role);
  return roles[(index + 1) % roles.length];
}

function nextRoleLabel(role) {
  return nextRole(role);
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
        grade:
          changes.grade !== undefined
            ? normalizeClientGrade(changes.grade)
            : normalizeClientGrade(existing.grade || ""),
        allowPersistentLogin:
          typeof changes.allowPersistentLogin === "boolean"
            ? changes.allowPersistentLogin
            : Boolean(existing.allowPersistentLogin),
      },
    });
    state.users = data.users || state.users;
    state.profiles = data.profiles || state.profiles;
    renderUsers();
    renderFriends();
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

function filterUsersForAdmin(users) {
  const term = String(state.accountSearch || "").trim().toLowerCase();
  const gradeFilter = normalizeClientGrade(state.accountGradeFilter || "");
  const noGradeFilter = String(state.accountGradeFilter || "") === "none";
  const list = users || [];
  const matchesGrade = (user) => {
    if (!gradeFilter && !noGradeFilter) return true;
    const profile = state.profiles[user.username] || {};
    const grade = normalizeClientGrade(user.grade || profile.grade || "");
    return noGradeFilter ? !grade : grade === gradeFilter;
  };
  const matchesSearch = (user) => {
    if (!term) return true;
    const profile = state.profiles[user.username] || {};
    const contact = typeof user.contact === "object" && user.contact ? user.contact : {};
    return searchableText({
      username: user.username,
      displayName: profile.displayName,
      email: user.email || contact.email,
      phone: user.phone || contact.phone,
      role: user.role,
      grade: user.grade || profile.grade,
      lastLoginIp: user.lastLoginIp,
      lastLoginDevice: user.lastLoginDevice,
      sourceIp: user.sourceIp,
      sourceDevice: user.sourceDevice,
      createdBy: user.createdBy,
      banReason: user.banReason,
      approximateLocation: user.lastLoginApproximateLocation,
    }).includes(term);
  };
  if (state.accountShowAll) return list.filter((user) => matchesGrade(user) && matchesSearch(user));
  if (!term && !gradeFilter && !noGradeFilter) {
    return list.filter((user) => {
      const role = String(user.role || "member").toLowerCase();
      const username = String(user.username || "").toLowerCase();
      return username !== "admin" && ["admin", "hmd", "dev"].includes(role);
    });
  }
  return list.filter((user) => matchesGrade(user) && matchesSearch(user));
}

function filteredSystemLogs() {
  return filterLogEntries(state.logs || [], (log) => searchableText({
    action: log.action,
    actor: log.actor,
    sourceIp: log.sourceIp,
    sourceDevice: log.sourceDevice,
    details: log.details,
    createdAt: log.createdAt,
  }));
}

function filteredModerationLogs() {
  return filterLogEntries(state.moderationLogs || [], (log) => searchableText(log));
}

function filterLogEntries(entries, textFactory) {
  const term = String(state.logSearch || "").trim().toLowerCase();
  const day = String(state.logDate || "").trim();
  return entries.filter((entry) => {
    const createdDay = String(entry.createdAt || "").slice(0, 10);
    if (day && createdDay !== day) return false;
    if (term && !textFactory(entry).includes(term)) return false;
    return true;
  });
}

function searchableText(value) {
  try {
    return JSON.stringify(value || {}).toLowerCase();
  } catch (error) {
    return String(value || "").toLowerCase();
  }
}

function dmPeople() {
  const current = state.user ? state.user.username.toLowerCase() : "";
  const direct = (state.people || [])
    .filter((person) => canStartDirectDmWith(person, current))
    .map((person) => ({
      ...person,
      value: person.username,
      label: `${person.displayName || person.username} (${person.role})`,
    }))
    .sort((a, b) => a.username.localeCompare(b.username));
  const groups = (state.dmGroups || [])
    .filter((group) => Array.isArray(group.participants) && group.participants.includes(state.user.username))
    .map((group) => ({
      username: group.name,
      role: "group",
      value: `group:${group.id}`,
      label: `${group.name} (group, ${group.participantCount || group.participants.length})`,
    }))
    .sort((a, b) => a.username.localeCompare(b.username));
  return [...groups, ...direct];
}

function shareTargetPeople() {
  const current = state.user ? state.user.username.toLowerCase() : "";
  const accepted = acceptedFriendNames();
  const direct = (state.people || [])
    .filter((person) => person && person.username && person.username.toLowerCase() !== current && !person.banned && accepted.has(person.username.toLowerCase()))
    .map((person) => ({
      ...person,
      value: person.username,
      label: `${person.displayName || person.username} (${person.role})`,
    }))
    .sort((a, b) => a.username.localeCompare(b.username));
  const groups = (state.dmGroups || [])
    .filter((group) => Array.isArray(group.participants) && group.participants.includes(state.user.username))
    .map((group) => ({
      username: group.name,
      role: "group",
      value: `group:${group.id}`,
      label: `${group.name} (friend group, ${group.participantCount || group.participants.length})`,
    }))
    .sort((a, b) => a.username.localeCompare(b.username));
  return [...groups, ...direct];
}

function renderShareTargets() {
  const people = shareTargetPeople();
  fillShareTargetSelect(els.shareLinkTarget, people);
  fillShareTargetSelect(els.innerDocShareTarget, people);
  fillShareTargetSelect(els.publicBrowserShareTarget, people);
  if (els.shareLinkButton) els.shareLinkButton.disabled = !people.length;
  if (els.shareInnerDocButton) els.shareInnerDocButton.disabled = !people.length;
  if (els.publicBrowserSendButton) els.publicBrowserSendButton.disabled = !people.length;
}

function fillShareTargetSelect(select, people) {
  if (!select) return;
  const previous = select.value;
  select.replaceChildren(
    optionElement("", people.length ? "Choose friend/group" : "Accept friends first"),
    ...people.map((person) => optionElement(person.value, person.label))
  );
  select.value = people.some((person) => person.value === previous) ? previous : "";
}

function shareTypeLabel(type) {
  const labels = {
    doc: "Doc",
    slides: "Slides",
    sheet: "Sheet",
    app: "App",
    link: "Link",
  };
  return labels[type] || "Link";
}

function dmGroupCandidatePeople() {
  const current = state.user ? state.user.username.toLowerCase() : "";
  return (state.people || [])
    .filter((person) => canStartDirectDmWith(person, current))
    .sort((a, b) => String(a.username).localeCompare(String(b.username)));
}

function canStartDirectDmWith(person, currentUsername) {
  if (!person || !person.username || person.username.toLowerCase() === currentUsername || person.banned) return false;
  if (isOwner()) return true;
  return acceptedFriendNames().has(person.username.toLowerCase());
}

function acceptedFriendNames() {
  return new Set((state.friends.friends || []).map((friend) => String(friend.username || "").toLowerCase()).filter(Boolean));
}

function selectedDmGroup() {
  if (!state.selectedDmUser || !state.selectedDmUser.startsWith("group:")) return null;
  const id = state.selectedDmUser.slice(6);
  return (state.dmGroups || []).find((group) => group.id === id) || null;
}

function dmBetween(dm, first, target) {
  if (String(target || "").startsWith("group:")) {
    const groupId = String(target).slice(6);
    return dm.groupId === groupId && Array.isArray(dm.participants) && dm.participants.includes(first);
  }
  const pair = new Set([String(first || ""), String(target || "")]);
  return pair.has(dm.from) && pair.has(dm.to) && !dm.groupId;
}

function dmTitle(dm) {
  if (dm.groupId) return `${dm.from} in ${dm.groupName || dm.to || "Group DM"}`;
  return `${dm.from} to ${dm.to}`;
}

function currentDmCallRoom() {
  if (!state.user || !state.selectedDmUser) return "";
  if (state.selectedDmUser.startsWith("group:")) return state.selectedDmUser;
  const users = [state.user.username, state.selectedDmUser].sort((a, b) => a.localeCompare(b));
  return `dm:${users[0]}:${users[1]}`;
}

function currentDmCallLabel() {
  if (!state.selectedDmUser) return "DM";
  const selected = dmPeople().find((person) => person.value === state.selectedDmUser);
  return selected ? selected.label.replace(/\s*\([^)]*\)$/, "") : callRoomLabel(currentDmCallRoom());
}

function callRoomLabel(roomId) {
  const room = String(roomId || "");
  if (room.startsWith("group:")) {
    const group = state.dmGroups.find((entry) => `group:${entry.id}` === room);
    return group ? group.name : "Group call";
  }
  if (room.startsWith("dm:")) {
    return room.split(":").slice(1).filter((name) => name !== (state.user && state.user.username)).join(" + ") || "DM call";
  }
  return room === "lobby" ? "Lobby Voice" : "Voice";
}

function selectedDmParticipants() {
  if (!state.user || !state.selectedDmUser) return [];
  if (state.selectedDmUser.startsWith("group:")) {
    const groupId = state.selectedDmUser.slice(6);
    const group = state.dmGroups.find((entry) => entry.id === groupId);
    return group && Array.isArray(group.participants) ? group.participants : [];
  }
  return [state.user.username, state.selectedDmUser];
}

function screenPeersForRoom(roomId) {
  if (!isDmCallRoom(roomId)) return Array.from(state.peers.values());
  const participants = new Set(callRoomParticipants(roomId));
  return Array.from(state.peers.values()).filter((peer) => participants.has(peer.username));
}

function canPeerReceiveScreen(peer) {
  if (!state.screenRoomId || !isDmCallRoom(state.screenRoomId)) return true;
  return callRoomParticipants(state.screenRoomId).includes(peer.username);
}

function callRoomParticipants(roomId) {
  const room = String(roomId || "");
  if (room.startsWith("group:")) {
    const group = state.dmGroups.find((entry) => `group:${entry.id}` === room);
    return group && Array.isArray(group.participants) ? group.participants : [];
  }
  if (room.startsWith("dm:")) return room.split(":").slice(1).filter(Boolean);
  return [];
}

function isDmCallRoom(roomId) {
  const room = String(roomId || "");
  return room.startsWith("dm:") || room.startsWith("group:");
}

function selectDmFromCallRoom(roomId) {
  const room = String(roomId || "");
  if (room.startsWith("group:")) {
    state.selectedDmUser = room;
  } else if (room.startsWith("dm:") && state.user) {
    state.selectedDmUser = room.split(":").slice(1).find((name) => name !== state.user.username) || state.selectedDmUser;
  }
  saveUiState();
  renderDms();
}

function featureLock(feature) {
  const lock = (state.settings.featureLocks || {})[feature];
  if (!lock) return null;
  const until = Date.parse(lock.disabledUntil);
  if (!Number.isFinite(until) || until <= Date.now()) return null;
  return lock;
}

function featureAvailable(feature) {
  if (isOwner()) return true;
  const hidden = hiddenRule(feature);
  if (hidden.hidden && !hidden.allowedUsers.includes((state.user && state.user.username || "").toLowerCase())) return false;
  if (featureLock(feature)) return false;
  const paywall = paywallRule(feature);
  if (paywall.enabled && paywall.itemId && !hasPaidOrder(paywall.itemId)) return false;
  return true;
}

function lockMessage(feature) {
  const hidden = hiddenRule(feature);
  if (!isOwner() && hidden.hidden && !hidden.allowedUsers.includes((state.user && state.user.username || "").toLowerCase())) {
    return `${featureLabel(feature)} is hidden for your account`;
  }
  const lock = featureLock(feature);
  if (lock) return `${featureLabel(feature)} disabled until ${formatDate(lock.disabledUntil)}`;
  const paywall = paywallRule(feature);
  if (paywall.enabled && paywall.itemId && !hasPaidOrder(paywall.itemId)) {
    return paywall.message || `${featureLabel(feature)} needs a paid pass from Store`;
  }
  return "";
}

function featureLabel(feature) {
  const labels = {
    all: "All / whole app",
    dms: "DMs",
    files: "Files",
    messages: "Messages",
    rooms: "Side rooms",
    screen: "Screen",
    vpn: "VPN",
    friends: "Friends",
    profiles: "Profiles",
    voice: "Voice",
    invites: "Invites",
    moderation: "Moderation",
    bots: "Bots",
    plugins: "Plugins",
    store: "Store",
    chess: "Chess",
    docs: "Docs",
    domain: "Domain",
  };
  return labels[feature] || feature;
}

function viewFeature(viewName) {
  const map = {
    messages: "messages",
    dms: "dms",
    friends: "friends",
    profile: "profiles",
    store: "store",
    files: "files",
    docs: "docs",
    googleWorkspace: "docs",
    googleDocs: "docs",
    googleSlides: "docs",
    googleSheets: "docs",
    chess: "chess",
    voice: "voice",
    screen: "screen",
    domain: "domain",
  };
  return map[viewName] || "";
}

function hiddenRule(feature) {
  const rule = (state.settings.featureVisibility || {})[feature] || {};
  return {
    hidden: Boolean(rule.hidden),
    allowedUsers: Array.isArray(rule.allowedUsers) ? rule.allowedUsers.map((name) => String(name).toLowerCase()) : [],
  };
}

function paywallRule(feature) {
  const wholeApp = (state.settings.paywalls || {}).all || {};
  const rule = feature !== "store" && wholeApp.enabled ? wholeApp : (state.settings.paywalls || {})[feature] || {};
  return {
    enabled: Boolean(rule.enabled),
    itemId: String(rule.itemId || ""),
    message: String(rule.message || ""),
  };
}

function hasPaidOrder(itemId) {
  return (state.store.orders || []).some((order) => order.itemId === itemId && order.user === state.user.username && order.status === "paid");
}

function splitUserList(value) {
  return String(value || "")
    .split(/[,\n]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function browserNetworkInfo() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
  return {
    effectiveType: String(connection.effectiveType || "").slice(0, 30),
    type: String(connection.type || "").slice(0, 30),
    downlink: Number(connection.downlink || 0),
    rtt: Number(connection.rtt || 0),
    saveData: Boolean(connection.saveData),
    platform: String(navigator.platform || "").slice(0, 80),
    language: String(navigator.language || "").slice(0, 40),
    screen: `${window.screen.width}x${window.screen.height}`,
  };
}

function syncHiddenNav() {
  document.querySelectorAll(".nav-button[data-view]").forEach((button) => {
    const feature = viewFeature(button.dataset.view);
    const rule = feature ? hiddenRule(feature) : { hidden: false, allowedUsers: [] };
    const blocked = feature && !isOwner() && rule.hidden && !rule.allowedUsers.includes((state.user && state.user.username || "").toLowerCase());
    button.classList.toggle("hidden", Boolean(blocked));
  });
}

function syncPrivilegedNav() {
  setNavVisibility(els.domainNavButton, isOwner());
  setNavVisibility(els.adminNavButton, isOwner());
  setNavVisibility(els.hmdNavButton, isDev());
}

function setNavVisibility(button, visible) {
  if (!button) return;
  button.hidden = !visible;
  button.classList.toggle("hidden", !visible);
  button.style.display = visible ? "" : "none";
  button.setAttribute("aria-hidden", visible ? "false" : "true");
  button.tabIndex = visible ? 0 : -1;
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
  appendTextWithLinks(body, text);
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

function appendTextWithLinks(container, value) {
  const text = String(value || "");
  const urlPattern = /(https?:\/\/[^\s<>"']+)/gi;
  let lastIndex = 0;
  let match;
  while ((match = urlPattern.exec(text))) {
    if (match.index > lastIndex) container.append(document.createTextNode(text.slice(lastIndex, match.index)));
    const rawUrl = match[0].replace(/[),.;!?]+$/g, "");
    const trailing = match[0].slice(rawUrl.length);
    const link = document.createElement("a");
    link.href = rawUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = rawUrl;
    container.append(link);
    if (trailing) container.append(document.createTextNode(trailing));
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) container.append(document.createTextNode(text.slice(lastIndex)));
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
  const title = dm.groupId ? `${dm.from} in ${dm.groupName || "Group DM"}` : `DM from ${dm.from}`;
  const body = previewText(dm.text);
  notify(`${title}: ${body}`);
  showSystemAlert(title, body, `dm-${dm.id}`, () => {
    state.selectedDmUser = dm.groupId ? `group:${dm.groupId}` : dm.from === state.user.username ? dm.to : dm.from;
    showView("dms");
    renderDms();
  });
}

function showLiveAlert(body, options = {}) {
  notify(body);
  showSystemAlert(options.title || "Inner live call", body, `call-${Date.now()}`, () => {
    if (state.incomingCall) {
      selectDmFromCallRoom(state.incomingCall.roomId);
      showView("dms");
      renderDmCall();
    }
  });
}

function unlockRingtone() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    state.ringtoneContext = state.ringtoneContext || new AudioContextClass();
    if (state.ringtoneContext.state === "suspended") state.ringtoneContext.resume().catch(() => {});
  } catch (error) {
    // AudioContext can be blocked until the browser allows sound.
  }
}

function playRingtone() {
  unlockRingtone();
  stopRingtone();
  const context = state.ringtoneContext;
  if (!context) return;
  let count = 0;
  state.ringtoneTimer = setInterval(() => {
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = count % 2 ? 740 : 520;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.32);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.34);
      count += 1;
      if (count > 10) stopRingtone();
    } catch (error) {
      stopRingtone();
    }
  }, 650);
}

function stopRingtone() {
  if (state.ringtoneTimer) clearInterval(state.ringtoneTimer);
  state.ringtoneTimer = null;
}

function playSoundboard(sound, options = {}) {
  unlockRingtone();
  const context = state.ringtoneContext;
  if (!context) return;
  const roomId = state.voiceRoomId || currentDmCallRoom() || "lobby";
  const patterns = {
    chime: [523, 659, 784],
    ping: [880],
    pop: [220, 180],
    ring: [440, 554, 440, 554],
  };
  const tones = patterns[sound] || patterns.chime;
  tones.forEach((frequency, index) => {
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = sound === "pop" ? "square" : "sine";
      oscillator.frequency.value = frequency;
      const start = context.currentTime + index * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.16);
    } catch (error) {
      // Soundboard is optional on browsers that block audio.
    }
  });
  if (options.broadcast) {
    sendWs({ type: "soundboard:play", roomId, sound });
  }
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

function viewFromPath() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/docs" || path === "/google-docs") {
    state.googleWorkspaceKind = "docs";
    return "googleWorkspace";
  }
  if (path === "/slides") {
    state.googleWorkspaceKind = "slides";
    return "googleWorkspace";
  }
  if (path === "/sheets") {
    state.googleWorkspaceKind = "sheets";
    return "googleWorkspace";
  }
  return Object.entries(viewRoutes).find(([, route]) => route === path)?.[0] || "";
}

function restoreUiState() {
  try {
    state.activeView = viewFromPath() || localStorage.getItem("innerActiveView") || "dashboard";
    state.selectedRoomId = localStorage.getItem("innerSelectedRoom") || "main";
    state.selectedDmUser = localStorage.getItem("innerSelectedDm") || "";
  } catch (error) {
    state.activeView = viewFromPath() || "dashboard";
  }
}

async function sendFriendRequest(event) {
  event.preventDefault();
  const to = els.friendUserSelect.value;
  if (!to) return;
  try {
    const data = await api("/api/friends/request", { method: "POST", json: { to, search: els.friendSearchInput ? els.friendSearchInput.value : "" } });
    state.friends = data.friends;
    state.friendSearch = "";
    state.friendCandidates = [];
    if (els.friendSearchInput) els.friendSearchInput.value = "";
    renderFriends();
    notify("Friend request sent");
  } catch (error) {
    notify(error.message);
  }
}

async function respondFriendRequest(id, action) {
  try {
    const data = await api("/api/friends/respond", { method: "POST", json: { id, action } });
    state.friends = data.friends;
    renderFriends();
  } catch (error) {
    notify(error.message);
  }
}

async function removeFriend(username) {
  try {
    const data = await api("/api/friends/remove", { method: "POST", json: { username } });
    state.friends = data.friends;
    renderFriends();
  } catch (error) {
    notify(error.message);
  }
}

async function saveProfile(event) {
  event.preventDefault();
  try {
    const data = await api("/api/profile", {
      method: "POST",
      json: {
        displayName: els.profileDisplayName.value,
        avatarUrl: els.profileAvatarUrl.value,
        bannerUrl: els.profileBannerUrl.value,
        badges: els.profileBadges.value.split(",").map((entry) => entry.trim()).filter(Boolean),
        status: els.profileStatus.value,
        customStatus: els.profileCustomStatus.value,
        grade: els.profileGrade ? els.profileGrade.value : "",
        theme: els.profileTheme.value,
        customTheme: currentProfileThemeEditor(),
        bio: els.profileBio.value,
        invisible: els.profileInvisible.checked,
      },
    });
    state.profiles = data.profiles || state.profiles;
    renderProfile();
    applyProfileTheme();
    notify("Profile saved");
    sendWs({
      type: "presence:update",
      status: els.profileStatus.value,
      invisible: els.profileInvisible.checked,
      customStatus: els.profileCustomStatus.value,
    });
  } catch (error) {
    notify(error.message);
  }
}

function saveUiState() {
  try {
    localStorage.setItem("innerActiveView", state.activeView || "dashboard");
    localStorage.setItem("innerSelectedRoom", state.selectedRoomId || "main");
    if (state.selectedDmUser) {
      localStorage.setItem("innerSelectedDm", state.selectedDmUser);
    } else {
      localStorage.removeItem("innerSelectedDm");
    }
  } catch (error) {
    // Local storage can be disabled; navigation still works for this session.
  }
}

function updateRoute(viewName) {
  const nextPath = viewRoutes[viewName] || "/";
  if (window.location.pathname === nextPath) return;
  window.history.pushState({ view: viewName }, "", nextPath);
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

function downloadableUrl(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set("download", "1");
    if (parsed.origin === window.location.origin) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return parsed.toString();
  } catch (error) {
    return `${url}${String(url).includes("?") ? "&" : "?"}download=1`;
  }
}

function downloadText(filename, text, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    notify("Copied");
  } catch (error) {
    window.prompt("Copy this", text);
  }
}

function exportLogs(kind) {
  if (!isOwner()) return notify("Admin access required");
  const exportedAt = new Date().toISOString();
  const filters = {
    search: state.logSearch || "",
    date: state.logDate || "",
  };
  const records = kind === "moderation" ? filteredModerationLogs() : filteredSystemLogs();
  const payload = {
    type: kind === "moderation" ? "moderation logs" : "system logs",
    exportedAt,
    exportedBy: state.user.username,
    filters,
    count: records.length,
    records,
  };
  const day = filters.date || exportedAt.slice(0, 10);
  downloadText(`inner-${kind}-logs-${day}.json`, JSON.stringify(payload, null, 2));
  notify(`${records.length} ${kind} log entries exported`);
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
  return state.user && (state.user.owner || state.user.username === "admin");
}

function isDev() {
  return state.user && ["admin", "hmd", "dev"].includes(state.user.role);
}

function setConnection(value) {
  if (!els.connectionStatus) return;
  const custom = state.settings.customizations || {};
  const normalized = String(value || "").toLowerCase();
  const connected = ["live", "connected", "online"].includes(normalized);
  const disconnected = ["offline", "disconnected", "reconnecting"].includes(normalized);
  if (connected) {
    els.connectionStatus.textContent = custom.connectedLabel || "Live";
  } else if (disconnected) {
    els.connectionStatus.textContent = custom.disconnectedLabel || "Not live";
  } else {
    els.connectionStatus.textContent = value;
  }
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

function optionElement(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat([], {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatApproxLocation(value) {
  if (!value || typeof value !== "object") return "";
  return value.note || value.ip || [value.city, value.region, value.country].filter(Boolean).join(", ") || "unknown";
}

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
