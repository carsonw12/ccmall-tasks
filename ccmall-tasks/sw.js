const CACHE_NAME = 'ccmall-v5';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/app.css',
  '/js/app.js',
  '/js/db.js',
  '/js/models.js',
  '/js/ai.js',
  '/js/notifications.js',
  '/js/ui.js',
  '/js/utils.js',
  '/js/router.js'
];

// Install — 预缓存 App Shell（单个失败不影响整体）
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        APP_SHELL.map(url =>
          cache.add(url).catch(err =>
            console.warn('[SW] Failed to cache:', url, err.message)
          )
        )
      )
    )
  );
  self.skipWaiting();
});

// Activate — 清理旧缓存
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — 网络优先，失败时回退到缓存（API 不缓存）
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API 请求：只走网络，不缓存
  if (url.pathname.startsWith('/api/') || url.hostname === 'api.deepseek.com') {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
