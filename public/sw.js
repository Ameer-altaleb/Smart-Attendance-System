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
    const records = await getAllFromSyncQueue();

    if (records.length === 0) {
      console.log('[SW] No records in sync queue');
      // Still notify main thread to check localStorage-based records
      await notifyClients();
      return;
    }

    console.log(`[SW] Found ${records.length} records to sync from IndexedDB`);

    // Try to get Supabase URL and key from a cached config
    // Since we can't access env vars, we'll try to notify the main thread
    // The main thread has the Supabase client and can do the actual sync
    await notifyClients();

  } catch (err) {
    console.error('[SW] Background sync failed:', err);
    // Fall back to notifying main thread
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
