/**
 * Service Worker — RU ↔ ZH Переводчик
 * Стратегия: Cache-First для оболочки, Network-Only для API
 * Спека: SPEC.md §5
 */

const CACHE_NAME = 'translator-v2';

// Только статика — API-запросы НИКОГДА не кэшируем
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ── Установка: кэшируем оболочку ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Активация: удаляем старые кэши ────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: оболочка из кэша, API из сети ──────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API MyMemory → всегда сеть (никакого кэша)
  if (url.hostname === 'api.mymemory.translated.net') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Статика → кэш, при ошибке → сеть
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        // Кэшируем только успешные ответы на GET
        if (
          event.request.method === 'GET' &&
          response.status === 200 &&
          response.type === 'basic'
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
