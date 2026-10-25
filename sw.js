/* عامل الخدمة: يحفظ ملفات صفحة التطبيق وسوار الثابتة فقط (لا يحفظ أي بيانات من سوار أو البرامج).
   النسخة المحفوظة تُعرض فوراً، وأي تحديث على GitHub يصل في الفتح التالي. */
const CACHE = 'siwar-app-v51';
const FILES = ['./', './index.html', './portal.html', './config.js', './manifest.webmanifest', './icons/logo.webp', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png', './icons/favicon-64.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
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
  // من ذاكرة الجهاز فوراً، والتحديث من GitHub يُحفظ في الخلفية ويظهر في الفتح التالي
  e.respondWith(caches.open(CACHE).then(c => c.match(key).then(hit => {
    const net = fetch(new Request(url.href, { cache: 'no-cache', credentials: 'same-origin' })).then(r => { if (r && r.ok) c.put(key, r.clone()).catch(() => {}); return r; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net.catch(() => c.match('./index.html'));
  })));
});
