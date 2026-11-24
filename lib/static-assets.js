const fs = require('fs/promises');
const { gzip } = require('zlib');
const { promisify } = require('util');
const compress = promisify(gzip), cache = new Map();
let cachedBytes = 0;
module.exports = async function sendStaticAsset(req, res, file, stat, type) {
  const etag = `W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
  const headers = { 'Content-Type': type, ETag: etag, 'Cache-Control': 'public, max-age=0, must-revalidate', Vary: 'Accept-Encoding' };
  if ((req.headers['if-none-match'] || '').split(/,\s*/).includes(etag)) { res.writeHead(304, headers); res.end(); return true; }
  if (stat.size < 1024 || stat.size > 2 * 1024 * 1024 || !/\.(js|mjs|css|html|json|svg)$/i.test(file)) return false;
  const acceptsGzip = (req.headers['accept-encoding'] || '').split(',').some(item => /^\s*gzip\s*(?:;\s*q=(?!0(?:\.0*)?\s*$)[\d.]+)?\s*$/i.test(item));
  if (!acceptsGzip) return false;
  let entry = cache.get(file);
  if (!entry || entry.etag !== etag) {
    if (entry) { cachedBytes -= entry.size; cache.delete(file); }
    entry = { etag, size: 0, promise: compress(await fs.readFile(file), { level: 6 }) };
    cache.set(file, entry);
    try { const body = await entry.promise; if (cache.get(file) === entry) { entry.size = body.length; cachedBytes += body.length; } }
    catch (error) { if (cache.get(file) === entry) cache.delete(file); throw error; }
    while (cache.size > 32 || cachedBytes > 8 * 1024 * 1024) { const [key,old] = cache.entries().next().value; cachedBytes -= old.size; cache.delete(key); }
  }
  const body = await entry.promise;
  res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': body.length });
  res.end(req.method === 'HEAD' ? undefined : body); return true;
};
