(() => {
  const byId = (id) => document.getElementById(id);
  const login = byId("passkeyLoginButton"), add = byId("passkeyAddButton"), password = byId("passkeyPassword"), status = byId("passkeyStatus"), list = byId("passkeyList");
  const supported = Boolean(window.isSecureContext && window.PublicKeyCredential && navigator.credentials);
  const decode = (value) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
  const encode = (value) => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  function serialize(credential) {
    const response = credential.response;
    const result = { id: credential.id, rawId: encode(credential.rawId), type: credential.type, authenticatorAttachment: credential.authenticatorAttachment, clientExtensionResults: credential.getClientExtensionResults(), response: { clientDataJSON: encode(response.clientDataJSON) } };
    if (response.attestationObject) {
      result.response.attestationObject = encode(response.attestationObject);
      result.response.transports = response.getTransports ? response.getTransports() : [];
    } else {
      result.response.authenticatorData = encode(response.authenticatorData);
      result.response.signature = encode(response.signature);
      result.response.userHandle = response.userHandle ? encode(response.userHandle) : null;
    }
    return result;
  }
  const errorText = (error) => ["NotAllowedError", "AbortError"].includes(error.name) ? "Passkey request cancelled or timed out. You can try again or use your password." : error.name === "InvalidStateError" ? "This device already has this passkey. Try signing in with it." : error.message || "Passkey request failed.";
  let busy = false, generation = 0, setupDialog = null, remindersDisabled = false;
  const loginForm = byId("loginForm"), loginView = byId("loginView");
  let conditional = null, conditionalTask = null, conditionalGeneration = 0, renewalTimer = null, passwordSigningIn = false;
  let capability = null;
  let loginReady = false, automaticAttempted = false, automaticRequested = false;
  const passkeyHint = (message) => { const hint = byId("passkeyLoginHint"); if (hint) hint.textContent = message; };
  async function offerLogin({ automatic = true } = {}) {
    loginReady = true;
    if (!automatic) { automaticAttempted = true; automaticRequested = false; }
    if (!automaticAttempted) {
      automaticAttempted = true;
      automaticRequested = true;
      await stopAutofill();
    }
    return startAutofill();
  }
  const visibleLogin = () => !state.loggedIn && !document.hidden && !loginView.classList.contains("hidden") && !loginForm.classList.contains("hidden")
    && !loginView.classList.contains("signup-expanded")
    && ["passwordResetRequestForm", "passwordResetCompleteForm"].every((id) => !byId(id) || byId(id).classList.contains("hidden"));
  function stopAutofill() {
    ++conditionalGeneration;
    clearTimeout(renewalTimer); renewalTimer = null;
    conditional?.abort(); conditional = null;
    return conditionalTask || Promise.resolve();
  }
  async function supportsAutofill() {
    if (!supported) return false;
    if (capability === null) capability = (async () => {
      try {
        if (typeof PublicKeyCredential.isConditionalMediationAvailable === "function") return await PublicKeyCredential.isConditionalMediationAvailable();
        if (typeof PublicKeyCredential.getClientCapabilities === "function") return (await PublicKeyCredential.getClientCapabilities()).conditionalGet === true;
      } catch { /* Keep password and explicit passkey sign-in available. */ }
      return false;
    })();
    return capability;
  }
  const requestOptions = (options) => ({ ...options, challenge: decode(options.challenge), allowCredentials: (options.allowCredentials || []).map((key) => ({ ...key, id: decode(key.id) })) });
  async function completePasskeyLogin(credential) {
    await api("/api/passkeys/login/verify", { method: "POST", json: serialize(credential) });
    els.loginPassword.value = ""; showApp();
    try { await loadState(); } catch (error) { showLogin(error.message || "Could not load workspace"); }
  }
  function startAutofill() {
    if (!supported || !visibleLogin() || busy || passwordSigningIn) return Promise.resolve();
    if (conditionalTask) {
      if (!conditional || conditional.signal.aborted) void conditionalTask.then(() => startAutofill());
      return conditionalTask;
    }
    const controller = new AbortController(), current = ++conditionalGeneration;
    conditional = controller;
    const valid = () => !controller.signal.aborted && current === conditionalGeneration && visibleLogin() && !passwordSigningIn;
    let wasModal = false;
    const task = (async () => {
      let completing = false;
      try {
        let modal = false;
        if (loginReady && automaticRequested) {
          automaticRequested = false;
          // Device capability is not proof that this site has a saved passkey.
          try { modal = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.() === true; } catch { /* Fall back to autofill. */ }
        }
        if (!valid() || (!modal && !await supportsAutofill()) || !valid()) return;
        wasModal = modal;
        const options = await api("/api/passkeys/login/options", { method: "POST", json: {}, signal: controller.signal });
        if (!valid()) return;
        // Renew before the server's five-minute challenge expires, only while
        // the sign-in screen is active. This does not open a modal prompt.
        if (!modal) renewalTimer = setTimeout(() => { void stopAutofill().then(() => startAutofill()); }, 4 * 60 * 1000);
        passkeyHint(modal ? "Use your device unlock to sign in, or cancel to use your password." : "Select a saved passkey from username autofill, or choose Sign in with a passkey.");
        const credential = await navigator.credentials.get({ publicKey: { ...requestOptions(options), allowCredentials: [], ...(modal ? { hints: ["client-device"] } : {}) }, mediation: modal ? "optional" : "conditional", signal: controller.signal });
        if (!credential || !valid() || busy) return;
        clearTimeout(renewalTimer); renewalTimer = null;
        completing = busy = true;
        login.disabled = true;
        loginForm.querySelector("[type=submit]").disabled = true;
        await completePasskeyLogin(credential);
      } catch (error) {
        // Unsupported/no saved credential/cancellation must never block passwords.
        // A selected credential that actually fails verification gets feedback.
        if (completing && !controller.signal.aborted && visibleLogin()) byId("loginError").textContent = errorText(error);
        else if (!controller.signal.aborted && visibleLogin()) passkeyHint("Choose Sign in with a passkey to open your device’s passkey picker, or use your password.");
      } finally {
        if (completing) { busy = false; login.disabled = !supported; loginForm.querySelector("[type=submit]").disabled = false; }
        if (conditional === controller) { conditional = null; clearTimeout(renewalTimer); renewalTimer = null; }
      }
    })();
    conditionalTask = task;
    void task.finally(() => {
      if (conditionalTask === task) conditionalTask = null;
      // An automatic prompt is attempted once. Cancellation falls back to quiet
      // autofill, never a loop of device dialogs.
      if (wasModal && valid()) void startAutofill();
    });
    return task;
  }
  async function beginPasswordLogin() {
    if (busy || passwordSigningIn) return false;
    passwordSigningIn = true;
    await stopAutofill();
    return true;
  }
  function endPasswordLogin() { passwordSigningIn = false; void startAutofill(); }
  async function registerPasskey(currentPassword, name) {
    const options = await api("/api/passkeys/register/options", { method: "POST", json: { password: currentPassword, name } });
    const credential = await navigator.credentials.create({ publicKey: { ...options, challenge: decode(options.challenge), user: { ...options.user, id: decode(options.user.id) }, excludeCredentials: (options.excludeCredentials || []).map((key) => ({ ...key, id: decode(key.id) })) } });
    if (!credential) throw new Error("No passkey created.");
    await api("/api/passkeys/register/verify", { method: "POST", json: serialize(credential) });
  }
  async function action(button, fn, target = status) {
    if (busy || passwordSigningIn) return;
    busy = true; button.disabled = true; target.textContent = "";
    try { await fn(); } catch (error) { target.textContent = errorText(error); }
    finally { busy = false; button.disabled = !supported; password.value = ""; void startAutofill(); }
  }
  async function refresh() {
    const current = ++generation, identity = `${state.user?.username}:${state.csrfToken}`;
    if (!state.user) { list.replaceChildren(); return; }
    const data = await api("/api/passkeys");
    if (current !== generation || identity !== `${state.user?.username}:${state.csrfToken}`) return;
    list.replaceChildren();
    remindersDisabled = data.remindersDisabled === true;
    byId("passkeyRemindersButton").textContent = remindersDisabled ? "Turn on setup reminders" : "Turn off setup reminders";
    if (!data.passkeys.length) { const empty = document.createElement("p"); empty.textContent = "No passkeys registered. Add one on a device you trust."; list.append(empty); }
    for (const key of data.passkeys) {
      const row = document.createElement("div"); row.className = "panel-title-row";
      const details = document.createElement("p"), name = document.createElement("strong"), date = document.createElement("small");
      name.textContent = key.name;
      date.textContent = `Added ${new Date(key.createdAt).toLocaleDateString()}${key.lastUsedAt ? `. Last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : ""}`;
      details.append(name, document.createElement("br"), date);
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "ghost-light-button compact-button"; remove.textContent = "Remove"; remove.setAttribute("aria-label", `Remove ${key.name}`);
      remove.onclick = () => action(remove, async () => {
        if (!password.value) throw new Error("Enter your current password to remove a passkey.");
        await api("/api/passkeys/remove", { method: "POST", json: { id: key.id, password: password.value } });
        await refresh(); status.textContent = "Passkey removed. It can no longer sign in.";
      });
      row.append(details, remove); list.append(row);
    }
  }
  login.disabled = add.disabled = !supported;
  if (!supported) status.textContent = "Passkeys need HTTPS and a supported browser. You can continue using your password.";
  login.onclick = () => action(login, async () => {
    await stopAutofill();
    const options = await api("/api/passkeys/login/options", { method: "POST", json: {} });
    const credential = await navigator.credentials.get({ publicKey: requestOptions(options) });
    if (!credential) throw new Error("No passkey selected.");
    await completePasskeyLogin(credential);
  }, byId("loginError"));
  add.onclick = () => action(add, async () => {
    if (!password.value) throw new Error("Enter your current password to add a passkey.");
    const currentPassword = password.value; password.value = "";
    await registerPasskey(currentPassword, byId("passkeyName").value);
    byId("passkeyName").value = ""; await refresh(); status.textContent = "Passkey added. You can now use it on the sign-in screen.";
  });
  byId("passkeyRefreshButton").onclick = () => refresh().catch((error) => { status.textContent = error.message; });
  byId("passkeyRemindersButton").onclick = () => action(byId("passkeyRemindersButton"), async () => {
    await api("/api/passkeys/reminders", { method: "POST", json: { disabled: !remindersDisabled } });
    await refresh(); status.textContent = remindersDisabled ? "Setup reminders turned off for your account." : "Setup reminders will appear after 20 password logins without a passkey.";
  });
  window.ConnectifiPasskeys = { offerLogin, startAutofill, stopAutofill, beginPasswordLogin, endPasswordLogin, showSetupPrompt() {
    if (!supported || !state.loggedIn || setupDialog) return;
    const dialog = document.createElement("dialog"); dialog.className = "school-dialog passkey-setup-dialog";
    dialog.setAttribute("aria-labelledby", "passkeySetupHeading"); dialog.setAttribute("aria-describedby", "passkeySetupDescription");
    // Static markup only. Account data never enters HTML.
    dialog.innerHTML = '<h2 id="passkeySetupHeading">Add a passkey</h2><p id="passkeySetupDescription">Use your fingerprint, face, device PIN or a security key to sign in. Your device keeps the private key. Your password remains available.</p><form class="school-editor"><label>Passkey name<input name="name" maxlength="80" placeholder="My laptop" autocomplete="off"></label><details><summary>Need to confirm your password?</summary><p class="panel-note">Your recent password sign-in normally covers this. If setup says your password is needed, enter it below.</p><label>Current password<input name="password" type="password" autocomplete="current-password"></label></details><p class="inline-status" role="status" aria-live="polite"></p><div class="button-row"><button type="submit" class="primary-button">Set up passkey</button><button type="button" class="secondary-button" data-later>Maybe later</button></div><div class="passkey-reminder-footer"><button type="button" class="passkey-reminder-dismiss">Don’t remind me again</button></div></form>';
    const form = dialog.querySelector("form"), feedback = dialog.querySelector("[role=status]"), submit = form.querySelector("[type=submit]"), dismiss = form.querySelector(".passkey-reminder-dismiss");
    const identity = `${state.user?.username}:${state.csrfToken}`;
    const close = () => { form.elements.password.value = ""; dialog.close(); };
    dialog.querySelector("[data-later]").onclick = close;
    dialog.addEventListener("close", () => { form.reset(); dialog.remove(); if (setupDialog === dialog) setupDialog = null; });
    form.onsubmit = (event) => { event.preventDefault(); void action(submit, async () => {
      const currentPassword = form.elements.password.value; form.elements.password.value = "";
      await registerPasskey(currentPassword, form.elements.name.value);
      if (identity === `${state.user?.username}:${state.csrfToken}`) { close(); notify("Passkey added. Use it next time you sign in."); }
    }, feedback); };
    dismiss.onclick = () => action(dismiss, async () => {
      await api("/api/passkeys/reminders", { method: "POST", json: { disabled: true } }); close();
    }, feedback);
    setupDialog = dialog; document.body.append(dialog); dialog.showModal();
  } };
  new MutationObserver(() => { if (byId("appView").classList.contains("hidden")) { generation++; setupDialog?.close(); password.value = ""; list.replaceChildren(); } }).observe(byId("appView"), { attributes: true, attributeFilter: ["class"] });
  const profile = byId("profileView");
  new MutationObserver(() => { if (profile.classList.contains("active")) refresh().catch((error) => { status.textContent = error.message; }); }).observe(profile, { attributes: true, attributeFilter: ["class"] });
  const loginObserver = new MutationObserver(() => { if (visibleLogin()) void startAutofill(); else void stopAutofill(); });
  for (const element of [loginView, loginForm, byId("passwordResetRequestForm"), byId("passwordResetCompleteForm")].filter(Boolean)) loginObserver.observe(element, { attributes: true, attributeFilter: ["class", "hidden"] });
  byId("loginUsername").addEventListener("focus", () => { void startAutofill(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) void stopAutofill(); else void startAutofill(); });
  window.addEventListener("pagehide", () => { void stopAutofill(); });
  window.addEventListener("pageshow", () => { void startAutofill(); });
})();
