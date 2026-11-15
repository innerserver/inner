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
  async function registerPasskey(currentPassword, name) {
    const options = await api("/api/passkeys/register/options", { method: "POST", json: { password: currentPassword, name } });
    const credential = await navigator.credentials.create({ publicKey: { ...options, challenge: decode(options.challenge), user: { ...options.user, id: decode(options.user.id) }, excludeCredentials: (options.excludeCredentials || []).map((key) => ({ ...key, id: decode(key.id) })) } });
    if (!credential) throw new Error("No passkey created.");
    await api("/api/passkeys/register/verify", { method: "POST", json: serialize(credential) });
  }
  async function action(button, fn, target = status) {
    if (busy) return;
    busy = true; button.disabled = true; target.textContent = "";
    try { await fn(); } catch (error) { target.textContent = errorText(error); }
    finally { busy = false; button.disabled = !supported; password.value = ""; }
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
    const options = await api("/api/passkeys/login/options", { method: "POST", json: {} });
    const credential = await navigator.credentials.get({ publicKey: { ...options, challenge: decode(options.challenge), allowCredentials: (options.allowCredentials || []).map((key) => ({ ...key, id: decode(key.id) })) } });
    if (!credential) throw new Error("No passkey selected.");
    await api("/api/passkeys/login/verify", { method: "POST", json: serialize(credential) });
    els.loginPassword.value = ""; showApp();
    await loadState();
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
  window.ConnectifiPasskeys = { showSetupPrompt() {
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
})();
