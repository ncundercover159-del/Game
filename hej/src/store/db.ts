// Minimal promise wrapper around IndexedDB. Stores:
//   kv       – save game, settings (key/value)
//   cards    – SRS cards (keyPath "id")
//   reports  – "report a mistake" entries (auto-increment)
//   log      – review history (auto-increment)

const DB_NAME = 'hej';
const VERSION = 1;
export type StoreName = 'kv' | 'cards' | 'reports' | 'log';

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('cards')) db.createObjectStore('cards', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('reports')) db.createObjectStore('reports', { autoIncrement: true });
      if (!db.objectStoreNames.contains('log')) db.createObjectStore('log', { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name: StoreName, mode: IDBTransactionMode) {
  return (await open()).transaction(name, mode).objectStore(name);
}

export const db = {
  async get<T>(s: StoreName, key: IDBValidKey): Promise<T | undefined> {
    return wrap((await store(s, 'readonly')).get(key));
  },
  async put(s: StoreName, value: unknown, key?: IDBValidKey): Promise<void> {
    await wrap((await store(s, 'readwrite')).put(value, key));
  },
  async add(s: StoreName, value: unknown): Promise<void> {
    await wrap((await store(s, 'readwrite')).add(value));
  },
  async all<T>(s: StoreName): Promise<T[]> {
    return wrap((await store(s, 'readonly')).getAll());
  },
  async putMany(s: StoreName, values: unknown[]): Promise<void> {
    const tx = (await open()).transaction(s, 'readwrite');
    const os = tx.objectStore(s);
    for (const v of values) os.put(v);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },
  async clear(s: StoreName): Promise<void> {
    await wrap((await store(s, 'readwrite')).clear());
  },
};
