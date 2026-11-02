import { STORAGE_KEY, type Store } from "./storage";
const DATABASE = "store-workbench";
const OBJECT_STORE = "workspace";
const notifications =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("store-workbench:changes")
    : undefined;
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(OBJECT_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error("database blocked"));
  });
}
export const database: Store = {
  async getItem(key) {
    const db = await open();
    try {
      const value = await new Promise<string | undefined>((resolve, reject) => {
        const tx = db.transaction(OBJECT_STORE, "readonly"),
          request = tx.objectStore(OBJECT_STORE).get(key);
        request.onsuccess = () => resolve(request.result as string | undefined);
        request.onerror = () => reject(request.error);
      });
      // Legacy data remains untouched. A successful validated save migrates it.
      return value ?? localStorage.getItem(key);
    } finally {
      db.close();
    }
  },
  async setItem(key, value) {
    const db = await open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(OBJECT_STORE, "readwrite");
        tx.objectStore(OBJECT_STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? Error("aborted"));
      });
      notifications?.postMessage({ key });
    } finally {
      db.close();
    }
  },
};
export function subscribeChanges(callback: () => void) {
  if (notifications)
    notifications.onmessage = (event) => {
      if (event.data?.key === STORAGE_KEY) callback();
    };
}
