const DB_NAME = "moneyTrackerDB";
const DB_VERSION = 1;

const STORE_NAMES = [
  "accounts",
  "transactions",
  "plannedExpenses",
  "allocations",
  "categories",
  "settings",
];

let dbPromise = null;

/**
 * Opens (and if needed, creates) the database.
 * Returns a promise that resolves to the IDBDatabase instance.
 * We cache the promise so every module shares the same open connection.
 */
export function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("accounts")) {
        db.createObjectStore("accounts", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("transactions")) {
        const store = db.createObjectStore("transactions", { keyPath: "id" });
        store.createIndex("byAccount", "accountId");
        store.createIndex("byDate", "date");
        store.createIndex("byType", "type");
      }
      if (!db.objectStoreNames.contains("plannedExpenses")) {
        db.createObjectStore("plannedExpenses", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("allocations")) {
        db.createObjectStore("allocations", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("categories")) {
        db.createObjectStore("categories", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => {
      console.error("Failed to open IndexedDB", event.target.error);
      reject(event.target.error);
    };
    request.onblocked = () => {
      console.warn("IndexedDB open request is blocked by another tab.");
    };
  });

  return dbPromise;
}

/** Generates a reasonably unique id without needing a library. */
export function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Reads every record from a store. */
export async function getAll(storeName) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Reads a single record by id. */
export async function getOne(storeName, id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/** Creates or overwrites a record. Returns the record that was saved. */
export async function putOne(storeName, record) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

/** Deletes a record by id. */
export async function removeOne(storeName, id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/** Wipes every store. Used before a full backup restore. */
export async function clearAllStores() {
  const db = await openDatabase();
  return Promise.all(
    STORE_NAMES.map(
      (name) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(name, "readwrite");
          tx.objectStore(name).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        })
    )
  );
}

export { STORE_NAMES };
