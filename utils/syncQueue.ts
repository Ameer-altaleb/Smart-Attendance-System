/**
 * IndexedDB-based sync queue for attendance records.
 * This allows the Service Worker to access pending records
 * (localStorage is NOT accessible from Service Workers).
 */

const DB_NAME = 'attendance-sync-db';
const DB_VERSION = 1;
const STORE_NAME = 'sync-queue';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Write an attendance record to the IndexedDB sync queue
 */
export async function writeToSyncQueue(record: any): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    // Strip syncStatus before storing
    const { syncStatus: _s, ...cleanRecord } = record;
    
    // Merge with existing record to preserve checkIn when adding checkOut while offline
    const getReq = store.get(cleanRecord.id);
    getReq.onsuccess = () => {
      let finalRecord = cleanRecord;
      if (getReq.result) {
        finalRecord = { ...getReq.result, ...cleanRecord };
      }
      const putReq = store.put(finalRecord);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Remove a synced record from the IndexedDB sync queue
 */
export async function removeFromSyncQueue(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get all records in the sync queue (used by Service Worker)
 */
export async function getAllFromSyncQueue(): Promise<any[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all records from the sync queue
 */
export async function clearSyncQueue(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
