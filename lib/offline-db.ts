"use client";
// IndexedDB storage for full offline mode (no extra libraries).
// Stores: kv (settings, metadata), questions, attempts (tests waiting to sync), chapters, chtext (lesson text),
// chnotes (summary / facts / revision per lesson), explanations.
const DB = "tnpsc-offline";
const VERSION = 2;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const make = (name: string, opts?: IDBObjectStoreParameters) => (db.objectStoreNames.contains(name) ? null : db.createObjectStore(name, opts));
      make("kv");
      const q = db.objectStoreNames.contains("questions") ? req.transaction!.objectStore("questions") : db.createObjectStore("questions", { keyPath: "id" });
      if (!q.indexNames.contains("unit")) q.createIndex("unit", "unit_id");
      if (!q.indexNames.contains("chapter")) q.createIndex("chapter", "chapter_id");
      make("attempts", { keyPath: "localId" });
      make("chapters", { keyPath: "id" });
      make("chtext", { keyPath: "chapter_id" });
      make("chnotes", { keyPath: "key" });
      make("explanations", { keyPath: "question_id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbp: Promise<IDBDatabase> | null = null;
const db = () => (dbp ??= open());

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(store, mode);
        const r = fn(t.objectStore(store));
        t.oncomplete = () => resolve((r ? (r as IDBRequest).result : undefined) as T);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export const idb = {
  get: <T,>(key: string) => run<T | undefined>("kv", "readonly", (s) => s.get(key)),
  set: (key: string, value: unknown) => run<void>("kv", "readwrite", (s) => s.put(value, key)),
  getOne: <T,>(store: string, key: IDBValidKey) => run<T | undefined>(store, "readonly", (s) => s.get(key)),
  all: <T,>(store: string) => run<T[]>(store, "readonly", (s) => s.getAll()),
  byIndex: <T,>(store: string, index: string, key: IDBValidKey) => run<T[]>(store, "readonly", (s) => s.index(index).getAll(key)),
  count: (store: string) => run<number>(store, "readonly", (s) => s.count()),
  clear: (store: string) => run<void>(store, "readwrite", (s) => { s.clear(); }),
  putMany: async (store: string, rows: unknown[]) => {
    for (let i = 0; i < rows.length; i += 500) {
      const part = rows.slice(i, i + 500);
      await run<void>(store, "readwrite", (s) => { part.forEach((r) => s.put(r)); });
    }
  },
  deleteMany: (store: string, keys: IDBValidKey[]) => run<void>(store, "readwrite", (s) => { keys.forEach((k) => s.delete(k)); }),
  // kept for the earlier offline page API
  allQuestions: <T,>() => run<T[]>("questions", "readonly", (s) => s.getAll()),
  putAttempt: (a: unknown) => run<void>("attempts", "readwrite", (s) => s.put(a)),
  attempts: <T,>() => run<T[]>("attempts", "readonly", (s) => s.getAll()),
  deleteAttempt: (id: string) => run<void>("attempts", "readwrite", (s) => s.delete(id)),
};
