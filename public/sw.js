const CACHE_NAME = 'attendance-cache-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// IndexedDB helpers for Service Worker
const DB_NAME = 'attendance-sync-db';
const DB_VERSION = 1;
const STORE_NAME = 'sync-queue';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllFromSyncQueue() {
  return openDb().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  });
}

function removeFromSyncQueue(id) {
  return openDb().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

// Install a service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Cache and return requests — Stale-While-Revalidate strategy
self.addEventListener('fetch', event => {
  // Skip non-GET requests and Supabase API calls
  if (event.request.method !== 'GET' || event.request.url.includes('supabase')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response immediately, but also fetch fresh copy
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // Update cache with fresh response
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, clone);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Network failed, cached response will be used
          return cachedResponse;
        });

        return cachedResponse || fetchPromise;
      })
  );
});

// Update a service worker
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Background Sync for Attendance — Now with IndexedDB direct sync
self.addEventListener('sync', event => {
  if (event.tag === 'sync-attendance') {
    event.waitUntil(syncAttendance());
  }
});

async function syncAttendance() {
  console.log('[SW] Attempting background sync via IndexedDB...');

  try {
    const db = await openDb();
    
    // 1. Get Config
    const configRecords = await new Promise((resolve, reject) => {
      const tx = db.transaction('config', 'readonly');
      const store = tx.objectStore('config');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    const config = {};
    configRecords.forEach(r => config[r.key] = r.value);

    // 2. Get Records
    const records = await getAllFromSyncQueue();

    if (records.length === 0) {
      console.log('[SW] No records in sync queue');
      await notifyClients();
      return;
    }

    console.log(`[SW] Found ${records.length} records to sync from IndexedDB`);

    if (config.supabase_url && config.supabase_key) {
      const baseUrl = config.supabase_url.endsWith('/') ? config.supabase_url.slice(0, -1) : config.supabase_url;
      const apiUrl = `${baseUrl}/rest/v1/attendance`;
      
      const generateDeterministicUUID = (input) => {
        let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
        for (let i = 0, ch; i < input.length; i++) {
          ch = input.charCodeAt(i);
          h1 = Math.imul(h1 ^ ch, 2654435761);
          h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        const part = (h) => (h >>> 0).toString(16).padStart(8, '0');
        const full = part(h1) + part(h2) + part(h1 ^ h2) + part(h1 & h2);
        return `${full.slice(0, 8)}-${full.slice(8, 12)}-4${full.slice(13, 16)}-a${full.slice(17, 20)}-${full.slice(20, 32)}`;
      };

      for (const record of records) {
        try {
          let finalRecord = record;
          if (!record.id.includes('-') || record.id.split('-').length < 5) {
            const newId = generateDeterministicUUID(record.id);
            finalRecord = { ...record, id: newId };
            console.log(`[SW] Migrated ID: ${record.id} -> ${newId}`);
          }

          const { syncStatus: _s, ...dbRecord } = finalRecord;
          
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'apikey': config.supabase_key,
              'Authorization': `Bearer ${config.supabase_key}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(dbRecord)
          });

          if (response.ok) {
            console.log(`[SW] Successfully synced record ${record.id}`);
            await removeFromSyncQueue(record.id);
          } else {
            console.error(`[SW] Failed to sync record ${record.id}:`, response.statusText);
          }
        } catch (recordErr) {
          console.error(`[SW] Network error syncing record ${record.id}:`, recordErr);
        }
      }
    }

    // Still notify main thread to refresh its state
    await notifyClients();

  } catch (err) {
    console.error('[SW] Background sync failed:', err);
    await notifyClients();
  }
}

async function notifyClients() {
  const allClients = await clients.matchAll({ includeUncontrolled: true });
  console.log(`[SW] Notifying ${allClients.length} active clients to sync`);
  allClients.forEach(client => {
    client.postMessage({
      type: 'SYNC_RECORDS'
    });
  });
}
