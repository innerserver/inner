const http = require('http');
const net = require('net');
const crypto = require('crypto');
const base = 'http://127.0.0.1:3130';
const jar = [];
function request(path, method='GET', body=null) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = http.request(base + path, {method, headers: {
      'content-type': 'application/json',
      'content-length': data ? data.length : 0,
      'cookie': jar.join('; ')
    }}, res => {
      const setCookie = res.headers['set-cookie'] || [];
      setCookie.forEach(c => jar.push(c.split(';')[0]));
      let text='';
      res.on('data', c => text += c);
      res.on('end', () => resolve({status: res.statusCode, text}));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}
(async () => {
  const login = await request('/api/login', 'POST', {username:'admin', password:'adminpass'});
  if (login.status !== 200) throw new Error('login failed ' + login.status + ' ' + login.text);
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve, reject) => {
      const key = crypto.randomBytes(16).toString('base64');
      const socket = net.connect(3130, '127.0.0.1', () => {
        socket.write([
          'GET /ws HTTP/1.1',
          'Host: 127.0.0.1:3130',
          'Upgrade: websocket',
          'Connection: Upgrade',
          'Sec-WebSocket-Version: 13',
          'Sec-WebSocket-Key: ' + key,
          'Cookie: ' + jar.join('; '),
          '', ''
        ].join('\r\n'));
      });
      socket.once('data', () => socket.destroy());
      socket.once('close', resolve);
      socket.once('error', resolve);
      setTimeout(() => { socket.destroy(); resolve(); }, 500);
    });
  }
  const health = await request('/api/health');
  console.log(JSON.stringify({health: health.status, alive: health.status === 200}));
})().catch(err => { console.error(err); process.exit(1); });
