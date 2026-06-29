/**
 * sw.js — Service Worker P3D Dashboard Ustadz/ah
 * Strategi: Cache-First untuk aset statis, Network-First untuk CDN eksternal.
 * Data santri tetap di localStorage (tidak di-cache SW).
 */

const CACHE_NAME = 'p3d-ustadz-v1';

// Aset lokal yang di-cache saat instalasi
const PRECACHE_ASSETS = [
  './P3D_Dashboard_Ustadz_v3.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// Domain CDN eksternal — di-cache setelah pertama kali diakses (network-first)
const CDN_HOSTS = [
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

// ── Install: pre-cache aset lokal ──────────────────────────────────────────
self.addEventListener('install', function (event) {
  console.log('[SW P3D] Install — pre-caching aset lokal...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(function () {
      console.log('[SW P3D] Pre-cache selesai.');
      return self.skipWaiting(); // Aktifkan SW baru segera
    })
  );
});

// ── Activate: hapus cache lama ─────────────────────────────────────────────
self.addEventListener('activate', function (event) {
  console.log('[SW P3D] Activate — membersihkan cache lama...');
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) {
            console.log('[SW P3D] Hapus cache lama:', key);
            return caches.delete(key);
          })
      );
    }).then(function () {
      return self.clients.claim(); // Ambil alih semua tab yang terbuka
    })
  );
});

// ── Fetch: strategi caching ────────────────────────────────────────────────
self.addEventListener('fetch', function (event) {
  const url = new URL(event.request.url);

  // Skip non-GET dan chrome-extension
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // CDN eksternal → Network-First (fallback ke cache)
  if (CDN_HOSTS.some(function (host) { return url.hostname.includes(host); })) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Aset lokal → Cache-First (fallback ke network)
  event.respondWith(cacheFirst(event.request));
});

// ── Strategi: Cache-First ──────────────────────────────────────────────────
function cacheFirst(request) {
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (cached) {
        console.log('[SW P3D] Cache-hit:', request.url);
        return cached;
      }
      return fetch(request).then(function (response) {
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(function () {
        // Fallback offline page jika ada
        return caches.match('./P3D_Dashboard_Ustadz_v3.html');
      });
    });
  });
}

// ── Strategi: Network-First ────────────────────────────────────────────────
function networkFirst(request) {
  return fetch(request).then(function (response) {
    if (response && response.status === 200) {
      caches.open(CACHE_NAME).then(function (cache) {
        cache.put(request, response.clone());
      });
    }
    return response;
  }).catch(function () {
    return caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(request);
    });
  });
}
