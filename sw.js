/* عامل الخدمة: يحفظ ملفات صفحة التطبيق وسوار الثابتة فقط (لا يحفظ أي بيانات من سوار أو البرامج).
   الشبكة أولاً بمهلة قصيرة: إن تأخرت تُعرض النسخة المحفوظة فوراً، وأي تحديث على GitHub يصل في الفتح التالي. */
const CACHE = 'siwar-app-v43';
const FILES = ['./', './index.html', './portal.html', './config.js', './manifest.webmanifest', './icons/logo.webp', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png', './icons/favicon-64.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const isIcon = /\/icons\//.test(url.pathname);
  // مفتاح الحفظ بلا معاملات (?open=… لا تُنشئ نسخاً مكررة)
  const key = new Request(url.origin + url.pathname);
  e.respondWith(caches.open(CACHE).then(c => {
    const hit = c.match(key);
    const net = fetch(e.request).then(r => { if (r && r.ok) c.put(key, r.clone()).catch(() => {}); return r; });
    if (isIcon) return hit.then(h => h || net);   // الأيقونات لا تتغير: من الذاكرة مباشرة
    const timeout = new Promise(res => setTimeout(res, 900)).then(() => hit.then(h => h || net));
    return Promise.race([net, timeout]).catch(() => hit.then(h => h || c.match('./index.html')));
  }));
});
