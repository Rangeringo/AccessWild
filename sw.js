const CACHE_NAME = 'accesswild-v6';
const TILES_CACHE = 'accesswild-tiles-v1';
const MAX_CACHED_TILES = 300;

const STATIC_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './icon-192.svg',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js',
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            // Cache static assets gracefully even if an external icon fails
            for (const asset of STATIC_ASSETS) {
                try {
                    await cache.add(asset);
                } catch (err) {
                    console.warn(`ServiceWorker pre-cache notice for ${asset}:`, err);
                }
            }
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME && key !== TILES_CACHE) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const url = e.request.url;

    // 1. Bypass Firestore & Google API requests - handled natively by Firebase IndexedDB persistence
    if (url.includes('firestore.googleapis.com') || url.includes('googleapis.com')) {
        return;
    }

    // 2. OpenStreetMap, Esri Satellite, OpenTopoMap Tiles: Cache for offline backcountry map viewing
    const isTile = url.includes('tile.openstreetmap.org') || 
                   url.includes('arcgisonline.com') || 
                   url.includes('opentopomap.org');

    if (isTile) {
        e.respondWith(
            caches.open(TILES_CACHE).then(async (tilesCache) => {
                const cachedResponse = await tilesCache.match(e.request);
                if (cachedResponse) {
                    return cachedResponse;
                }
                try {
                    const networkResponse = await fetch(e.request);
                    if (networkResponse && networkResponse.status === 200) {
                        tilesCache.put(e.request, networkResponse.clone());
                    }
                    return networkResponse;
                } catch (networkErr) {
                    // If offline and tile wasn't pre-cached, return cached or transparent response
                    return cachedResponse || new Response('', { status: 408, headers: { 'Content-Type': 'image/png' } });
                }
            })
        );
        return;
    }

    // 3. Navigation requests (App Shell): Network first, fall back to cached index.html
    if (e.request.mode === 'navigate') {
        e.respondWith(
            fetch(e.request).catch(() => caches.match('./index.html'))
        );
        return;
    }

    // 4. Static assets (JS, CSS, Leaflet): Cache first, fall back to network
    e.respondWith(
        caches.match(e.request).then((cached) => {
            if (cached) return cached;
            return fetch(e.request).then((response) => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, responseClone);
                    });
                }
                return response;
            });
        })
    );
});
