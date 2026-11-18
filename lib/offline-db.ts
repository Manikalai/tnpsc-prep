"use client";
// Tiny IndexedDB wrapper for the offline pack (no extra libraries).
const DB = "tnpsc-offline";
const STORES = ["kv", "questions", "attempts"] as const;
type Store = (typeof STORES)[number];

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("questions")) db.createObjectStore("questions", { keyPath: "id" }).createIndex("unit", "unit_id");
      if (!db.objectStoreNames.contains("attempts")) db.createObjectStore("attempts", { keyPath: "localId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => resolve((r ? (r as IDBRequest).result : undefined) as T);
    t.onerror = () => reject(t.error);
  });
}

export const idb = {
  get: <T,>(key: string) => tx<T | undefined>("kv", "readonly", (s) => s.get(key)),
  set: (key: string, value: unknown) => tx<void>("kv", "readwrite", (s) => s.put(value, key)),
  allQuestions: <T,>() => tx<T[]>("questions", "readonly", (s) => s.getAll()),
  replaceQuestions: async (rows: unknown[]) => {
    await tx<void>("questions", "readwrite", (s) => { s.clear(); });
    for (let i = 0; i < rows.length; i += 500) {
      const part = rows.slice(i, i + 500);
      await tx<void>("questions", "readwrite", (s) => { part.forEach((r) => s.put(r)); });
    }
  },
  putAttempt: (a: unknown) => tx<void>("attempts", "readwrite", (s) => s.put(a)),
  attempts: <T,>() => tx<T[]>("attempts", "readonly", (s) => s.getAll()),
  deleteAttempt: (id: string) => tx<void>("attempts", "readwrite", (s) => s.delete(id)),
};
