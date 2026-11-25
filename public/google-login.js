(() => {
  const button=document.getElementById('googleLoginButton');
  button.onclick=async()=>{
    button.disabled=true;
    await window.ConnectifiPasskeys?.stopAutofill();
    window.location.assign('/api/auth/google/start');
  };
  fetch('/api/auth/google/status',{credentials:'same-origin'}).then(response=>response.ok?response.json():{enabled:false}).then(data=>{button.hidden=!data.enabled;button.disabled=!data.enabled;}).catch(()=>{button.hidden=true;});
  const codes={blocked:'This account cannot sign in right now. Try your password for details or contact an admin.',expired:'Google sign-in expired. Please try again.',cancelled:'Google sign-in was cancelled.',failed:'Google sign-in could not complete. You can use your password.',email:'Use a Gmail or Google Workspace account, or sign in with your password.',account:'Google sign-in needs one approved Connectifi account with this Google email. Ask an admin to check your saved email.'};
  window.ConnectifiGoogleLogin={error(){const url=new URL(location.href),code=url.searchParams.get('google_error');if(!code)return '';url.searchParams.delete('google_error');history.replaceState(null,'',url.pathname+url.search+url.hash);return codes[code]||codes.failed;}};
})();
