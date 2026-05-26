const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT = process.cwd();
const DATA_DIR = process.env.INNER_DATA_DIR ? path.resolve(process.env.INNER_DATA_DIR) : path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const FILES_JSON = path.join(DATA_DIR, 'files.json');
const REPO = process.env.GITHUB_REPO || 'devshah20-coder/inner';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/data/uploads`;

let syncing = false;
let pending = false;
let lastJsonWrite = 0;

function safeReadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function safeWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function normalizeUploadUrls() {
  const files = safeReadJson(FILES_JSON, []);
  if (!Array.isArray(files)) return false;

  let changed = false;
  const next = files.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    if (!entry.storedName) return entry;

    const encodedName = encodeURIComponent(entry.storedName);
    const rawUrl = `${RAW_BASE}/${encodedName}`;

    if (entry.url !== rawUrl || entry.rawUrl !== rawUrl || entry.githubUrl !== rawUrl) {
      changed = true;
      return {
        ...entry,
        url: rawUrl,
        rawUrl,
        githubUrl: rawUrl,
        storage: 'github'
      };
    }

    return entry;
  });

  if (changed) {
    lastJsonWrite = Date.now();
    safeWriteJson(FILES_JSON, next);
    console.log('[github-upload-sync] normalized file URLs');
  }

  return changed;
}

function gitSync() {
  if (syncing) {
    pending = true;
    return;
  }

  syncing = true;
  pending = false;

  normalizeUploadUrls();

  exec(
    'git add data/uploads data/files.json && git diff --cached --quiet || (git commit -m "Sync uploaded files" && git push)',
    { cwd: ROOT },
    (error, stdout, stderr) => {
      syncing = false;

      if (error) {
        console.error('[github-upload-sync] sync failed:', stderr || error.message);
      } else {
        console.log('[github-upload-sync] uploads synced to GitHub');
      }

      if (pending) setTimeout(gitSync, 1500);
    }
  );
}

function scheduleSync() {
  clearTimeout(scheduleSync.timer);
  scheduleSync.timer = setTimeout(gitSync, 2500);
}

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(FILES_JSON)) safeWriteJson(FILES_JSON, []);

normalizeUploadUrls();

fs.watchFile(FILES_JSON, { interval: 1500 }, () => {
  if (Date.now() - lastJsonWrite < 1200) return;
  scheduleSync();
});

fs.watch(UPLOAD_DIR, { recursive: false }, () => {
  scheduleSync();
});

setTimeout(gitSync, 3000);
console.log('[github-upload-sync] active');
