(async () => {
  const PICK = { 'APP-003': 'APP-003|__snape|page=tasks|all', 'APP-001': 'APP-001|__snape||', 'APP-002': 'APP-002|__snape|cal|', 'APP-004': 'APP-004|__snape|p=home|', 'APP-005': 'APP-005|__snape|home|' };
  const pfr = document.querySelector('#portal iframe'), pw = pfr.contentWindow, pd = pw.document;
  try { pw.eval('show("home")'); } catch (e) {}
  await new Promise(r => setTimeout(r, 600));
  const names = {}; pw.eval('S.apps').forEach(a => { names[a.id] = pw.eval('S.lang') === 'en' ? (a.nameEN || a.nameAR) : a.nameAR; });
  const clone = pd.documentElement.cloneNode(true);
  clone.querySelectorAll('script,noscript,#pvPanel,#pvFab,.pv-tag,#vaultFabVeil').forEach(e => e.remove());
  clone.classList.remove('pv-soul');
  const hook = '<script>document.addEventListener("click",function(e){var b=e.target.closest("[data-act=launch]");e.preventDefault();e.stopPropagation();if(!b||!b.dataset.id||b.dataset.go)return;var i=b.querySelector(".app-icon")||b,r=i.getBoundingClientRect();parent.simOpen(b.dataset.id,{x:r.left,y:r.top,w:r.width,h:r.height});},true);<\/script>';
  const portalHTML = '<!doctype html>' + clone.outerHTML.replace('</body>', hook + '</body>');
  const shellCSS = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
  const progHTML = document.getElementById('prog').outerHTML;
  const logo = await fetch('icons/logo.webp').then(r => r.blob()).then(b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }));
  const db = await new Promise((r, j) => { const q = indexedDB.open('siwar_kv', 1); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
  const get = k => new Promise(r => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(null); });
  const snaps = {};
  for (const id in PICK) { const v = await get(PICK[id]); if (v && v.html) snaps[id] = v.html.replace(/<script\b[\s\S]*?<\/script>/gi, ''); }
  const DATA = { portal: portalHTML, snaps, names, logo };
  const tpl = window.__SIM_TPL;
  const out = tpl.replace('/*__CSS__*/', () => shellCSS).replace('<!--__PROG__-->', () => progHTML).replace('"__DATA__"', () => JSON.stringify(DATA).replace(/<\/(script)/gi, '<\\/$1'));
  const blob = new Blob([out], { type: 'text/html' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'siwar-colors-simulator.html'; document.body.appendChild(a); a.click();
  return { bytes: out.length, snaps: Object.keys(snaps), names };
})()
