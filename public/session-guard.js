(() => {
  const NativeWebSocket = window.WebSocket;

  window.WebSocket = function (...args) {
    const socket = new NativeWebSocket(...args);

    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data && data.type === 'force:logout') {
          try {
            localStorage.clear();
            sessionStorage.clear();
          } catch {}

          alert(data.reason || 'You were logged out by an admin.');

          window.location.href = '/';
        }
      } catch {}
    });

    return socket;
  };

  window.WebSocket.prototype = NativeWebSocket.prototype;
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
