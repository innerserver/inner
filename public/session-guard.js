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
