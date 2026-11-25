module.exports = function protectServer(server, options = {}) {
  const cap = Math.min(10000, Math.max(32, Number(options.activeRequests) || 1024));
  let active = 0;
  server.headersTimeout = 15000;
  server.requestTimeout = 120000;
  server.keepAliveTimeout = 5000;
  server.maxRequestsPerSocket = 1000;
  server.maxHeadersCount = 100;
  server.maxConnections = Math.min(20000, Math.max(64, Number(options.connections) || 2048));
  return function limitRequests(handler) {
    return (req, res) => {
      if (active >= cap) {
        res.writeHead(503, {'Content-Type':'application/json', 'Retry-After':'2', 'Connection':'close', 'Cache-Control':'no-store'});
        res.end('{"error":"Server is busy. Please retry shortly."}');return;
      }
      active++;
      let released = false;
      const release = () => { if (!released) { released = true; active--; } };
      res.once('finish',release);res.once('close',release);
      return handler(req,res);
    };
  };
};
