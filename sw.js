/* File: plataforma cursos SyM/sw.js */
'use strict';

const CACHE_NAME = 'cursos-sym-v14';

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/main.css',
  '/assets/css/components.css',
  '/assets/css/responsive.css',
  '/assets/js/app.js',
  '/assets/js/auth.js',
  '/assets/js/db.js',
  '/assets/js/storage.js',
  '/assets/js/payments.js',
  '/assets/js/notifications.js',
  '/img/logo-oscuro.png',
  '/img/logo-claro.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navegaciones: siempre red primero, caché solo como respaldo offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Resto (JS, CSS, imágenes): siempre red primero para nunca servir
  // archivos viejos; si falla (offline), se usa la caché.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok &&
            (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/img/'))) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
