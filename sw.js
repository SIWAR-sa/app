/* عامل الخدمة: يحفظ ملفات صفحة التطبيق وسوار الثابتة فقط (لا يحفظ أي بيانات من سوار أو البرامج).
   النسخة المحفوظة تُعرض فوراً، وأي تحديث على GitHub يصل في الفتح التالي.
   إشعارات الجوال: الإشعار يصل بلا محتوى، فيطلب العامل نصوصه من سوار برمز هذا الجهاز (المحفوظ في siwar-push) ثم يعرضها. */
const CACHE = 'siwar-app-v56';
const PUSHC = 'siwar-push', PUSHK = './__push';
const FILES = ['./', './index.html', './portal.html', './config.js', './manifest.webmanifest', './icons/logo.webp', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png', './icons/favicon-64.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== PUSHC).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (/\/__push$/.test(url.pathname)) return;
  // مفتاح الحفظ بلا معاملات (?open=… لا تُنشئ نسخاً مكررة)
  const key = new Request(url.origin + url.pathname);
  // من ذاكرة الجهاز فوراً، والتحديث من GitHub يُحفظ في الخلفية ويظهر في الفتح التالي
  e.respondWith(caches.open(CACHE).then(c => c.match(key).then(hit => {
    const net = fetch(new Request(url.href, { cache: 'no-cache', credentials: 'same-origin' })).then(r => { if (r && r.ok) c.put(key, r.clone()).catch(() => {}); return r; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net.catch(() => c.match('./index.html'));
  })));
});

/* ── إشعارات الجوال ── */
function pushCfg() { return caches.open(PUSHC).then(c => c.match(PUSHK)).then(r => r ? r.json() : null).catch(() => null); }
function portalPost(cfg, body) {
  return fetch(cfg.url, { method: 'POST', credentials: 'omit', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).then(r => r.json());
}
const FALLBACK = {
  ar: { title: 'سوار', body: 'لديك إشعار جديد في سوار.' },
  en: { title: 'SIWAR', body: 'You have a new notification in SIWAR.' }
};
async function onPush() {
  const cfg = await pushCfg();
  let items = [];
  if (cfg && cfg.url && cfg.id) {
    try { const j = await portalPost(cfg, { action: 'push_pull', id: cfg.id, tok: cfg.tok }); if (j && j.ok && Array.isArray(j.items)) items = j.items; } catch (e) { items = []; }
  }
  // لا يُترك وصول الإشعار بلا عرض (المتصفح يشترط ذلك)، فإن تعذّر جلب النص يظهر إشعار عام يفتح التطبيق
  if (!items.length) { const f = FALLBACK[cfg && cfg.lang === 'en' ? 'en' : 'ar']; items = [{ id: 'g', title: f.title, body: f.body, url: self.registration.scope, lang: cfg && cfg.lang }]; }
  await Promise.all(items.map(it => {
    const en = it.lang === 'en';
    return self.registration.showNotification(String(it.title || 'سوار'), {
      body: String(it.body || ''), tag: 'siwar-' + it.id, renotify: false, lang: en ? 'en' : 'ar', dir: en ? 'ltr' : 'rtl',
      icon: 'icons/icon-192.png', data: { url: String(it.url || self.registration.scope) }
    });
  }));
}
self.addEventListener('push', e => { e.waitUntil(onPush()); });

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || self.registration.scope, self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const app = list.find(c => c.frameType !== 'nested' && c.url.indexOf(self.registration.scope) === 0 && !/portal\.html/.test(c.url));
    if (app) {
      // التطبيق مفتوح: يُرسل له الرابط ليفتح النظام فوراً، ويُنقل للأمام
      app.postMessage({ siwar: 'deep', url: url });
      return app.focus ? app.focus().catch(() => {}) : null;
    }
    return self.clients.openWindow(url);
  }));
});

// المتصفح جدّد الاشتراك (نادر): يُبلَّغ سوار بالعنوان الجديد برمز الجهاز نفسه
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil(pushCfg().then(cfg => {
    if (!cfg || !cfg.id) return;
    const opts = e.oldSubscription && e.oldSubscription.options;
    const next = e.newSubscription ? Promise.resolve(e.newSubscription) : (opts ? self.registration.pushManager.subscribe(opts) : Promise.resolve(null));
    return next.then(sub => sub ? portalPost(cfg, { action: 'push_resub', id: cfg.id, tok: cfg.tok, sub: sub.toJSON() }) : portalPost(cfg, { action: 'push_drop', id: cfg.id, tok: cfg.tok }));
  }).catch(() => {}));
});
