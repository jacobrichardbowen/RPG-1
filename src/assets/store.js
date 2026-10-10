// IndexedDB persistence for asset overrides (and the linked-folder handle).
// Every call is wrapped so the game keeps working when storage is blocked.
const DB_NAME = 'brackwater-assets';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('overrides')) db.createObjectStore('overrides', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

export class OverrideStore {
  constructor() {
    this.dbp = null;
  }
  db() {
    if (!this.dbp) this.dbp = openDB().catch((e) => { this.dbp = null; throw e; });
    return this.dbp;
  }
  async tx(storeName, mode, fn) {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const t = db.transaction(storeName, mode);
      const store = t.objectStore(storeName);
      let result;
      Promise.resolve(fn(store)).then((r) => { result = r; });
      t.oncomplete = () => resolve(result && result.result !== undefined ? result.result : result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }
  async all() {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const t = db.transaction('overrides', 'readonly');
      const req = t.objectStore('overrides').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
  put(rec) { return this.tx('overrides', 'readwrite', (s) => s.put(rec)); }
  delete(id) { return this.tx('overrides', 'readwrite', (s) => s.delete(id)); }
  async getMeta(key) {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const t = db.transaction('meta', 'readonly');
      const req = t.objectStore('meta').get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  setMeta(key, value) { return this.tx('meta', 'readwrite', (s) => s.put(value, key)); }
}
