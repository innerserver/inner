const http = require('http');
const received = [];
const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      received.push(JSON.parse(body || '{}'));
      res.writeHead(200, {'content-type':'application/json'});
      res.end(JSON.stringify({ok:true, count: received.length}));
    });
    return;
  }
  res.writeHead(200, {'content-type':'application/json'});
  res.end(JSON.stringify(received));
});
server.listen(3141, '127.0.0.1', () => console.log('collector ready'));
