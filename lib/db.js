// IndexedDB storage: 'items' (everything saved) and 'media' (screenshots, recordings, uploads as Blob).
const DB_NAME = 'moodboard';
const VERSION = 1;
const channel = new BroadcastChannel('moodboard');
let dbPromise;

function open() {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('items')) {
        const s = db.createObjectStore('items', { keyPath: 'id' });
        s.createIndex('type', 'type');
      }
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const notify = () => channel.postMessage('changed');

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export async function putItem(item) {
  item.id ||= uid();
  item.createdAt ||= Date.now();
  item.updatedAt = Date.now();
  await run('items', 'readwrite', s => s.put(item));
  notify();
  return item;
}

export const getItem = id => run('items', 'readonly', s => s.get(id));
export const allItems = () => run('items', 'readonly', s => s.getAll());

export async function deleteItem(id) {
  const item = await getItem(id);
  await run('items', 'readwrite', s => s.delete(id));
  for (const key of [item?.mediaKey, item?.posterKey]) {
    if (key) await run('media', 'readwrite', s => s.delete(key));
  }
  notify();
}

export async function putMedia(blob, key = uid()) {
  await run('media', 'readwrite', s => s.put(blob, key));
  return key;
}

export const getMedia = key => run('media', 'readonly', s => s.get(key));

export const deleteMedia = key => run('media', 'readwrite', s => s.delete(key));
