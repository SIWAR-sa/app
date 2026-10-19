/* عامل الخدمة: يحفظ ملفات صفحة التطبيق فقط (لا يحفظ أي بيانات من البوابة أو البرامج). */
const CACHE = 'siwar-app-v4';
const FILES = ['./', './index.html', './config.js', './manifest.webmanifest', './icons/logo.webp', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// الشبكة أولاً (فأي تحديث على GitHub يصل فوراً)، والنسخة المحفوظة عند انقطاع الإنترنت
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
