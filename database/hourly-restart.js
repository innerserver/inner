const ONE_HOUR = 60 * 60 * 1000;

console.log('[auto-restart] hourly restart enabled');

setInterval(() => {
  console.log('[auto-restart] restarting service');
  process.exit(0);
}, ONE_HOUR);
