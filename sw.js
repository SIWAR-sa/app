/* عامل الخدمة: يحفظ ملفات صفحة التطبيق وسوار الثابتة فقط (لا يحفظ أي بيانات من سوار أو البرامج).
   النسخة المحفوظة تُعرض فوراً، وأي تحديث على GitHub يصل في الفتح التالي.
   إشعارات الجوال: الإشعار يصل بلا محتوى، فيطلب العامل نصوصه من سوار برمز هذا الجهاز (المحفوظ في siwar-push) ثم يعرضها. */
const CACHE = 'siwar-app-v130';   // يساوي دائماً APPV في index.html (يُرفعان معاً)
const PUSHC = 'siwar-push', PUSHK = './__push';
/* (UP) بصمة كل ملف (أول 16 حرفاً من sha256 لمحتواه) تُختم هنا عند كل إصدار (stamp_sw.js). عند تثبيت عامل جديد يُنزَّل الملف الذي تغيّرت بصمته فقط،
   وغير المتغيّر يُنسخ من النسخة المحفوظة على الجهاز. ولا يُعاد تنزيل ملفات التطبيق في كل فتح: النسخة المحفوظة ببصمتها هي الأحدث،
   والتحديث يصل بعامل جديد (sw.js صغير يفحصه المتصفح). فحص احتياطي مرة كل 24 ساعة بطلب مشروط (304 بلا محتوى إن لم يتغيّر) */
const FILES = {
  './': '977d5c0f9858c2c0', './index.html': '977d5c0f9858c2c0', './portal.html': '60a0a03751adafe0', './config.js': 'c0607a481ed95db2',
  './manifest.webmanifest?v=89': '6fecf35b4a5b5f40', './icons/logo.webp': '8b1d4d5eac530863'
};
const HK = f => './__h/' + f.replace(/^\.\//, '').replace(/[?=]/g, '_');
const DAY = 24 * 3600000, LASTK = './__h/__last';

// (v94) الجلب من GitHub بمعامل فريد (?sw=…): لا يأتي من ذاكرة المتصفح ولا من نسخة وسيطة قديمة
const bust = u => u + (u.indexOf('?') < 0 ? '?' : '&') + 'sw=' + Date.now().toString(36);
// نسخة محفوظة بالبصمة نفسها في أي ذاكرة سابقة للتطبيق
async function reuse(f, h) {
  const ks = (await caches.keys()).filter(k => /^siwar-app-/.test(k) && k !== CACHE);
  for (const k of ks) {
    const c = await caches.open(k), m = await c.match(HK(f));
    if (m && (await m.text()) === h) { const r = await c.match(f); if (r) return r; }
  }
  return null;
}
// (v119) رقم هذا العامل: لا يُثبَّت عامل أقدم من نسخة موجودة على الجهاز (الخادم الوسيط قد يقدّم sw.js قديماً لدقائق بعد النشر — كان يسبب تحديثاً ذهاباً وإياباً)
const MYV = Number((/v(\d+)$/.exec(CACHE) || [])[1]) || 0;
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const newer = (await caches.keys()).some(k => { const m = /^siwar-app-v(\d+)$/.exec(k); return m && Number(m[1]) > MYV; });
    if (newer) throw new Error('older worker');
    const c = await caches.open(CACHE), got = {};
    for (const f of Object.keys(FILES)) {
      const h = FILES[f];
      let r = got[h] && h.indexOf('__H_') < 0 ? got[h].clone() : (h.indexOf('__H_') < 0 ? await reuse(f, h) : null);
      if (!r) { r = await fetch(new Request(bust(f), { cache: 'reload' })); if (!r.ok) throw new Error(f); }
      got[h] = r.clone();
      await c.put(f, r);
      await c.put(HK(f), new Response(h));
    }
    await c.put(LASTK, new Response(String(Date.now())));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== PUSHC).map(k => caches.delete(k)))).then(() => self.clients.claim()).then(() =>
    // (v119) صفحة قديمة في الخلفية (جهاز فُتح آخر مرة على إصدار سابق): تُفتح من جديد على هذا الإصدار مباشرة — قفزة واحدة إلى الأحدث.
    // الصفحة الظاهرة لا تُعاد تحميلها من هنا؛ هي تطبّق التحديث بنفسها في أول لحظة آمنة
    self.clients.matchAll({ type: 'window' }).then(list => Promise.all(list.map(cl => cl.visibilityState === 'hidden' && cl.navigate ? cl.navigate(cl.url).catch(() => {}) : null)))).catch(() => {}));
});

// فحص احتياطي يومي: طلب مشروط لملفات التطبيق؛ إن اختلف ملف عن المحفوظ (نُشر بلا ختم بصمة) يُحفظ ويُبلَّغ التطبيق بزر «تحديث»
async function daily(c) {
  const l = await c.match(LASTK), at = l ? Number(await l.text()) || 0 : 0;
  if (Date.now() - at < DAY) return;
  await c.put(LASTK, new Response(String(Date.now())));
  for (const f of ['./index.html', './portal.html', './config.js']) {
    try {
      const r = await fetch(new Request(f, { cache: 'no-cache', credentials: 'same-origin' }));
      const hit = await c.match(f);
      if (!r.ok || !hit) continue;
      const a = await hit.clone().text(), b = await r.clone().text();
      if (a !== b) { await c.put(f, r); if (f === './index.html') await c.put('./', r.clone()); newer(f); }
    } catch (x) {}
  }
}

/* (v125 · طلب محمد: «البوابة بتعمل تحميل مرتين») كان الجهاز يفتح النسخة المحفوظة ثم يكتشف إصداراً أحدث فيعيد التحميل مرة ثانية.
   الآن صفحة التطبيق تُطلب من الشبكة أولاً بطلب مشروط صغير (304 إن لم تتغيّر) ومهلة قصيرة؛ إن وصلت نسخة أحدث تُعرض هي مباشرة
   وتُطلب صفحة سوار (portal.html) أحدث معها — فتح واحد على أحدث إصدار بلا إعادة تحميل. بلا شبكة أو شبكة بطيئة: النسخة المحفوظة فوراً كما كانت */
const NAVMS = 900, PORTMS = 6000;
let freshAt = 0;   // وقت وصول صفحة تطبيق أحدث من المحفوظة: صفحة سوار التالية تُطلب من الشبكة أيضاً
async function hex16(r) {
  try { const b = await crypto.subtle.digest('SHA-256', await r.arrayBuffer()); return Array.from(new Uint8Array(b).slice(0, 8)).map(x => x.toString(16).padStart(2, '0')).join(''); } catch (x) { return ''; }
}
function timed(p, ms) { return Promise.race([p, new Promise(res => setTimeout(() => res(null), ms))]); }
async function netFirst(e, c, key, hit, nav) {
  const f = './' + key.url.slice(self.registration.scope.length);
  const net = fetch(new Request(key.url, { cache: 'no-cache', credentials: 'same-origin' })).then(async r => {
    if (!r || !r.ok) return null;
    const a = hit ? await hit.clone().text() : null, b = await r.clone().text();
    if (a === b) return { same: true };
    await c.put(key, r.clone());
    if (nav) { await c.put('./', r.clone()); await c.put('./index.html', r.clone()); freshAt = Date.now(); }
    const h = await hex16(r.clone());
    if (h) { if (nav) { await c.put(HK('./'), new Response(h)); await c.put(HK('./index.html'), new Response(h)); } else await c.put(HK(f), new Response(h)); }
    return { r: r };
  }).catch(() => null);
  e.waitUntil(net);
  const got = await timed(net, nav ? NAVMS : PORTMS);
  if (got && got.r) return got.r;
  if (hit) return hit;
  return (await net) && (await c.match(key)) || fetch(key);
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (/\/__push$|\/__h\//.test(url.pathname)) return;
  // مفتاح الحفظ بلا معاملات (?open=… لا تُنشئ نسخاً مكررة)
  const key = new Request(url.origin + url.pathname);
  const shell = /\/($|index\.html$|portal\.html$|config\.js$)/.test(url.pathname);
  const nav = e.request.mode === 'navigate' && /\/($|index\.html$)/.test(url.pathname);
  const port = /\/portal\.html$/.test(url.pathname) && freshAt && Date.now() - freshAt < 60000;
  if ((nav || port) && self.navigator.onLine !== false) {
    if (port) freshAt = 0;
    e.respondWith(caches.open(CACHE).then(c => c.match(key).then(hit => netFirst(e, c, key, hit, nav))));
    return;
  }
  e.respondWith(caches.open(CACHE).then(c => c.match(key).then(hit => {
    if (hit) {
      // (UP) النسخة المحفوظة ببصمتها هي الأحدث: لا تنزيل في الخلفية، إلا الفحص الاحتياطي اليومي لملفات التطبيق
      if (shell) e.waitUntil(daily(c).catch(() => {}));
      return hit;
    }
    return fetch(new Request(url.href, { cache: 'reload', credentials: 'same-origin' })).then(r => {
      if (r && r.ok) e.waitUntil(c.put(key, r.clone()).catch(() => {}));
      return r;
    }).catch(() => c.match('./index.html'));
  })));
});

function newer(path) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => list.forEach(cl => { try { cl.postMessage({ siwar: 'newer', path: path }); } catch (x) {} }));
}
// «تحديث الآن»: الصفحة تطلب تفعيل العامل الجديد إن كان ينتظر
self.addEventListener('message', e => {
  if (e.data && e.data.siwar === 'skip') self.skipWaiting();
  // (v94) رقم نسخة هذا العامل: الصفحة لا تعرض بطاقة التحديث لعامل بنسختها نفسها
  if (e.data && e.data.siwar === 'ver' && e.ports && e.ports[0]) e.ports[0].postMessage({ v: CACHE });
});

/* ── إشعارات الجوال ── */
function pushCfg() { return caches.open(PUSHC).then(c => c.match(PUSHK)).then(r => r ? r.json() : null).catch(() => null); }
function portalPost(cfg, body) {
  return fetch(cfg.url, { method: 'POST', credentials: 'omit', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).then(r => r.json());
}
const FALLBACK = {
  ar: { title: 'سوار | SIWAR', body: 'لديك إشعار جديد في سوار | SIWAR.' },
  en: { title: 'سوار | SIWAR', body: 'You have a new notification in سوار | SIWAR.' }
};
async function onPush() {
  const cfg = await pushCfg();
  let items = [];
  let bell = [];
  if (cfg && cfg.url && cfg.id) {
    try { const j = await portalPost(cfg, { action: 'push_pull', id: cfg.id, tok: cfg.tok }); if (j && j.ok && Array.isArray(j.items)) { items = j.items; bell = Array.isArray(j.bell) ? j.bell : []; } } catch (e) { items = []; }
  }

  // لا يُترك وصول الإشعار بلا عرض (المتصفح يشترط ذلك)، فإن تعذّر جلب النص يظهر إشعار عام يفتح التطبيق
  if (!items.length) { const f = FALLBACK[cfg && cfg.lang === 'en' ? 'en' : 'ar']; items = [{ id: 'g', title: f.title, body: f.body, url: self.registration.scope, lang: cfg && cfg.lang }]; }
  // (NT) الجرس الحي: التطبيق المفتوح يستلم صفوف الإشعار فوراً (جرس سوار وجرس النظام) بلا انتظار التحديث الدوري؛ وإن تعذّر السحب تصله رسالة بلا صفوف فيحدّث جرسه بنفسه
  liveBell(bell, items);
  await Promise.all(items.map(it => {
    const en = it.lang === 'en';
    return self.registration.showNotification(String(it.title || 'سوار | SIWAR'), {
      // (v87) tag من سوار: إشعارات الطلب نفسه تحل محل السابق بدل أن تتراكم، ويُنبَّه الموظف للجديد منها
      // (NT) quiet: تحديث متقارب على الطلب نفسه يحل محل السابق بلا صوت ولا اهتزاز
      body: String(it.body || ''), tag: 'siwar-' + String(it.tag || it.id), renotify: !!it.tag && it.tag !== it.id && !it.quiet, silent: !!it.quiet, lang: en ? 'en' : 'ar', dir: en ? 'ltr' : 'rtl',
      icon: 'icons/icon-192.png?v=85', data: { url: String(it.url || self.registration.scope), nid: String(it.id || '') }
    });
  }));
}
self.addEventListener('push', e => { e.waitUntil(onPush()); });
function liveBell(bell, items) {
  const msg = { siwar: 'push', bell: bell.slice(0, 20), ids: items.map(it => String(it.id || '')) };
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => list.forEach(cl => {
    if (cl.frameType === 'nested' || cl.url.indexOf(self.registration.scope) !== 0 || /portal\.html/.test(cl.url)) return;
    try { cl.postMessage(msg); } catch (x) {}
  })).catch(() => {});
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || self.registration.scope, self.registration.scope).href, nid = String((e.notification.data && e.notification.data.nid) || '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const app = list.find(c => c.frameType !== 'nested' && c.url.indexOf(self.registration.scope) === 0 && !/portal\.html/.test(c.url));
    if (app) {
      // التطبيق مفتوح: يُرسل له الرابط ليفتح النظام فوراً، ويُنقل للأمام
      // (NT) فتح دافئ: النظام المفتوح يفتح المرجع في مكانه بلا إعادة تحميل (index.html: deepWarm)
      app.postMessage({ siwar: 'deep', url: url, nid: nid, t: Date.now() });
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
