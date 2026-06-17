/* ═══════════════════════════════════════════
   db.js — IndexedDB layer (multi-store)
   ═══════════════════════════════════════════ */

import { STORES, isLegacyTask, migrateTask } from './models.js';

const DB_NAME = 'ccmall_tasks_db', DB_VERSION = 2;
let db = null;

export function getDB() { return db; }

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (e.oldVersion < 1 && !d.objectStoreNames.contains(STORES.TASKS)) {
        d.createObjectStore(STORES.TASKS, { keyPath: 'id' });
      }
      if (e.oldVersion < 2) {
        if (!d.objectStoreNames.contains(STORES.BRANDS)) d.createObjectStore(STORES.BRANDS, { keyPath: 'id' });
        if (!d.objectStoreNames.contains(STORES.CONTRACTS)) d.createObjectStore(STORES.CONTRACTS, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

export function getAll(storeName) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('DB not open'));
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function getById(storeName, id) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('DB not open'));
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function put(storeName, item) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('DB not open'));
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function remove(storeName, id) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('DB not open'));
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function putAll(storeName, items) {
  if (!db) throw new Error('DB not open');
  const tx = db.transaction(storeName, 'readwrite'), store = tx.objectStore(storeName);
  for (const item of items) store.put(item);
  return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
}

export async function loadTasks() {
  const raw = await getAll(STORES.TASKS);
  const migrated = raw.map(t => isLegacyTask(t) ? migrateTask(t) : t);
  if (raw.some(t => isLegacyTask(t))) await putAll(STORES.TASKS, migrated);
  return migrated;
}

export async function saveTask(task) { return put(STORES.TASKS, task); }
export async function deleteTask(id) { return remove(STORES.TASKS, id); }
export async function loadBrands() { return getAll(STORES.BRANDS); }
export async function saveBrand(brand) { return put(STORES.BRANDS, brand); }
export async function deleteBrand(id) { return remove(STORES.BRANDS, id); }
export async function loadContracts() { return getAll(STORES.CONTRACTS); }
export async function saveContract(contract) { return put(STORES.CONTRACTS, contract); }
export async function deleteContract(id) { return remove(STORES.CONTRACTS, id); }

export async function migrateFromLocalStorage() {
  const old = localStorage.getItem('ccmall_tasks_v2');
  if (!old) return 0;
  try {
    const tl = JSON.parse(old);
    if (tl.length > 0) {
      const migrated = tl.map(migrateTask);
      await putAll(STORES.TASKS, migrated);
      localStorage.removeItem('ccmall_tasks_v2');
      return migrated.length;
    }
  } catch (_) {}
  return 0;
}
