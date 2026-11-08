// (UP) يختم بصمة كل ملف في sw.js (FILES) قبل الرفع إلى GitHub: node stamp_sw.js [folder]
// يُشغَّل بعد أي تعديل على index.html أو portal.html أو config.js أو manifest أو الشعار، ومعه يُرفع رقم CACHE وAPPV.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const dir = path.resolve(process.argv[2] || __dirname), swp = path.join(dir, 'sw.js');
const h = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, f))).digest('hex').slice(0, 16);
const map = { './': 'index.html', './index.html': 'index.html', './portal.html': 'portal.html', './config.js': 'config.js', './manifest.webmanifest?v=89': 'manifest.webmanifest', './icons/logo.webp': 'icons/logo.webp' };
let s = fs.readFileSync(swp, 'utf8');
for (const k in map) {
  const re = new RegExp("('" + k.replace(/[.?*+^$()[\]\\/]/g, '\\$&') + "': ')([^']*)(')");
  if (!re.test(s)) throw new Error('FILES entry missing: ' + k);
  s = s.replace(re, (m, a, b, c) => a + h(map[k]) + c);
}
fs.writeFileSync(swp, s);
console.log('stamped', Object.keys(map).map(k => k + '=' + h(map[k])).join(' '));
