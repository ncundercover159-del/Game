// Minimal promise wrapper around IndexedDB. Stores:
//   kv       – save game, settings (key/value)
//   cards    – SRS cards (keyPath "id")
//   reports  – "report a mistake" entries (auto-increment)
//   log      – review history (auto-increment)

const DB_NAME = 'hej';
const VERSION = 1;
export type StoreName = 'kv' | 'cards' | 'reports' | 'log';

let dbp: Promise<IDBDatabase> | null = null;

// If IndexedDB is blocked (private windows, previews, some embeds) the game still runs,
// keeping everything in memory for the session.
let memory: Record<StoreName, Map<IDBValidKey, unknown>> | null = null;
let autoKey = 1;
function mem() {
  return (memory ??= { kv: new Map(), cards: new Map(), reports: new Map(), log: new Map() });
}
async function useMemory(): Promise<boolean> {
  if (memory) return true;
  try {
    await open();
    return false;
  } catch {
    mem();
    return true;
  }
}

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no IndexedDB'));
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, VERSION);
    } catch (e) {
      return reject(e);
    }
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

const keyOf = (s: StoreName, value: unknown, key?: IDBValidKey): IDBValidKey =>
  key ?? (s === 'cards' ? (value as { id: string }).id : autoKey++);

export const db = {
  async get<T>(s: StoreName, key: IDBValidKey): Promise<T | undefined> {
    if (await useMemory()) return mem()[s].get(key) as T | undefined;
    return wrap((await store(s, 'readonly')).get(key));
  },
  async put(s: StoreName, value: unknown, key?: IDBValidKey): Promise<void> {
    if (await useMemory()) { mem()[s].set(keyOf(s, value, key), value); return; }
    await wrap((await store(s, 'readwrite')).put(value, key));
  },
  async add(s: StoreName, value: unknown): Promise<void> {
    if (await useMemory()) { mem()[s].set(keyOf(s, value), value); return; }
    await wrap((await store(s, 'readwrite')).add(value));
  },
  async all<T>(s: StoreName): Promise<T[]> {
    if (await useMemory()) return [...mem()[s].values()] as T[];
    return wrap((await store(s, 'readonly')).getAll());
  },
  async putMany(s: StoreName, values: unknown[]): Promise<void> {
    if (await useMemory()) { for (const v of values) mem()[s].set(keyOf(s, v), v); return; }
    const tx = (await open()).transaction(s, 'readwrite');
    const os = tx.objectStore(s);
    for (const v of values) os.put(v);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },
  async clear(s: StoreName): Promise<void> {
    if (await useMemory()) { mem()[s].clear(); return; }
    await wrap((await store(s, 'readwrite')).clear());
  },
};
