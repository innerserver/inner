(function installBanLogoutWatcher() {
  let checking = false;

  function showBannedLogin(message) {
    try {
      if (typeof closeSocket === 'function') closeSocket();
      if (typeof stopShare === 'function') stopShare({ silent: true });
      if (window.state) state.loggedIn = false;

      const appView = document.getElementById('appView');
      const loginView = document.getElementById('loginView');
      const loginError = document.getElementById('loginError');
      const loginPassword = document.getElementById('loginPassword');

      if (appView) appView.classList.add('hidden');
      if (loginView) loginView.classList.remove('hidden');
      if (loginError) loginError.textContent = message || 'Your account has been banned or logged out by an admin.';
      if (loginPassword) loginPassword.value = '';
    } catch (error) {
      window.location.reload();
    }
  }

  async function checkSession() {
    if (checking || !window.state || !state.loggedIn) return;
    checking = true;

    try {
      const response = await fetch('/api/me', {
        credentials: 'same-origin',
        cache: 'no-store'
      });

      if (response.status === 401 || response.status === 403) {
        showBannedLogin('Your account was removed, banned, or logged out by an admin.');
      }
    } catch (error) {
      // Ignore temporary network drops.
    } finally {
      checking = false;
    }
  }

  setInterval(checkSession, 2000);
  window.addEventListener('focus', checkSession);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkSession();
  });
})();


document.addEventListener("DOMContentLoaded",()=>{
 const u=localStorage.getItem("username")||"guest";
 const r=localStorage.getItem("role")||"user";
 const admin=(u==="devshah"||r==="admin");

 document.querySelectorAll("[data-feature='admin'],#adminBtn,.admin-btn,.admin-nav,.admin-panel").forEach(el=>{
   if(!admin){
      el.remove();
   }
 });

});
