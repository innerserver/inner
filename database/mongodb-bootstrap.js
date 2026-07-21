const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const DB_MODE = String(process.env.INNER_DB || '').toLowerCase();
const MONGODB_URI = process.env.MONGODB_URI || '';

if (DB_MODE === 'mongodb' && MONGODB_URI) {
  const { MongoClient } = require('mongodb');

  const ROOT = path.resolve(__dirname, '..');
  const DATA_DIR = process.env.INNER_DATA_DIR
    ? path.resolve(process.env.INNER_DATA_DIR)
    : path.join(ROOT, 'data');

  const DATABASE_NAME = process.env.MONGODB_DB || 'inner';
  const COLLECTION_NAME = 'storage';

  const jsonFiles = new Set([
    'users.json',
    'rooms.json',
    'messages.json',
    'dms.json',
    'files.json',
    'store.json',
    'ai-requests.json',
    'ai.json',
    'settings.json',
    'vpn.json'
  ]);

  function isManagedFile(filePath) {
    const absolute = path.resolve(String(filePath));
    return absolute.startsWith(DATA_DIR + path.sep)
      && jsonFiles.has(path.basename(absolute));
  }

  function documentId(filePath) {
    return path.basename(String(filePath), '.json');
  }

  function fallbackValue(id) {
    switch (id) {
      case 'store':
        return { items: [], orders: [] };
      case 'settings':
        return {
          serverEnabled: true,
          roomName: 'Inner',
          featureLocks: {}
        };
      case 'ai':
        return { apiKey: '' };
      case 'vpn':
        return { enabled: false };
      default:
        return [];
    }
  }

  const client = new MongoClient(MONGODB_URI);

  const collectionPromise = client.connect()
    .then(() => {
      console.log('[mongodb] persistence enabled');
      return client.db(DATABASE_NAME).collection(COLLECTION_NAME);
    })
    .catch((error) => {
      console.error('[mongodb] connection failed', error);
      return null;
    });

  const originalReadFile = fsp.readFile.bind(fsp);
  const originalWriteFile = fsp.writeFile.bind(fsp);
  const originalExistsSync = fs.existsSync.bind(fs);

  fs.existsSync = function patchedExistsSync(filePath) {
    if (isManagedFile(filePath)) return true;
    return originalExistsSync(filePath);
  };

  fsp.readFile = async function patchedReadFile(filePath, options) {
    if (!isManagedFile(filePath)) {
      return originalReadFile(filePath, options);
    }

    const collection = await collectionPromise;

    if (!collection) {
      return originalReadFile(filePath, options);
    }

    const id = documentId(filePath);

    const document = await collection.findOne({ _id: id });

    const data = document?.data ?? fallbackValue(id);

    return Buffer.from(JSON.stringify(data, null, 2));
  };

  fsp.writeFile = async function patchedWriteFile(filePath, content, options) {
    if (!isManagedFile(filePath)) {
      return originalWriteFile(filePath, content, options);
    }

    const collection = await collectionPromise;

    if (!collection) {
      return originalWriteFile(filePath, content, options);
    }

    const text = Buffer.isBuffer(content)
      ? content.toString('utf8')
      : String(content);

    const data = JSON.parse(text || 'null');

    await collection.updateOne(
      { _id: documentId(filePath) },
      {
        $set: {
          data,
          updatedAt: new Date()
        }
      },
      {
        upsert: true
      }
    );
  };
}


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
