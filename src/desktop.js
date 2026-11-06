
/* ================= Desktop-App (Tauri): Ordner, Speichern, Überwachung, Git, Export ================= */
// Nur aktiv, wenn der Viewer in der Desktop-App läuft. Rust liefert Dateien und schreibt zurück (desktop/src-tauri/src/lib.rs).
const DESK = typeof window !== 'undefined' && window.__TAURI__ && window.__TAURI__.core ? window.__TAURI__ : null;
S.desk = null; S.dirty = new Set();
const deskInvoke = (cmd, args) => DESK.core.invoke(cmd, args || {});

async function deskOpen(root, keepView) {
  let f; try { f = await deskInvoke('open_folder', { root }); } catch (e) { toast(L('desk.openError', { msg: String(e) })); return false; }
  if (!f.files.some(x => isModelFile(x.name))) toast(L('ui.noModelFiles'));
  S.desk = { root: f.root, name: f.name }; store.set('deskRoot', f.root);
  S.dirty.clear(); deskDirty();
  if (keepView) { syncFiles(f.files, f.name); S.dirHandle = { desk: true }; renderNav(); }
  else { setFiles(f.files, f.name, { desk: true }); toast(Ln('ui.filesReadFrom', f.files.filter(x => isModelFile(x.name)).length, { dir: f.name })); }
  return true;
}
// Änderungen von außen übernehmen – Dateien mit ungespeicherten Änderungen bleiben, wie sie im Viewer sind
function deskMerge(f) {
  if (!S.desk || f.root !== S.desk.root) return;
  const mine = new Map(S.files.map(x => [x.name, x]));
  let conflict = false;
  const files = f.files.map(x => { if (!S.dirty.has(x.name)) return x; const m = mine.get(x.name); if (m && m.text !== x.text) conflict = true; return m || x; });
  for (const n of S.dirty) if (!files.some(x => x.name === n) && mine.has(n)) files.push(mine.get(n));
  const same = files.length === S.files.length && files.every(x => mine.has(x.name) && mine.get(x.name).text === x.text);
  if (same) return;
  S.vscReady = true; syncFiles(files, S.desk.name); S.dirHandle = { desk: true }; persist();
  toast(L(conflict ? 'desk.conflict' : 'desk.changed'));
}
async function deskSave() {
  if (!S.desk || !S.dirty.size) return;
  const names = [...S.dirty]; let ok = 0;
  for (const n of names) {
    const f = S.files.find(x => x.name === n); if (!f) { S.dirty.delete(n); continue; }
    try { await deskInvoke('save_model_file', { name: n, text: f.text }); S.dirty.delete(n); ok++; }
    catch (e) { toast(L('desk.saveError', { file: n, msg: String(e) })); }
  }
  deskDirty(); if (ok) toast(Ln('desk.saved', ok));
}
function deskDirty() {
  const b = $('saveBtn'); if (!b) return;
  b.hidden = !S.desk; b.disabled = !S.dirty.size;
  b.textContent = S.dirty.size ? L('desk.saveN', { n: S.dirty.size }) : L('desk.save');
  if (DESK) deskInvoke('set_dirty', { n: S.dirty.size }).catch(() => {});
  const sel = $('fileSel'); if (sel) [...sel.options].forEach((o, i) => { const f = S.files[i]; if (f) o.textContent = (S.dirty.has(f.name) ? '● ' : '') + o.textContent.replace(/^● /, ''); });
}
async function deskExport(V, kind) {
  if (!V.cur) return;
  const name = (MV.title || 'diagramm').replace(/[\\/:*?"<>|\s]+/g, '_') + '.' + kind;
  const save = (data, b64) => deskInvoke('save_export', { defaultName: name, data, base64: b64 }).then(p => p && toast(L('desk.exported', { file: p })), e => toast(String(e)));
  if (kind === 'svg') return save(standaloneSVG(V.cur), false);
  const { W, H } = V.cur; const sc = Math.min(2, 8000 / Math.max(W, H));
  const img = new Image(); const url = URL.createObjectURL(new Blob([standaloneSVG(V.cur)], { type: 'image/svg+xml' }));
  img.onload = () => { const c = document.createElement('canvas'); c.width = Math.round(W * sc); c.height = Math.round(H * sc); const x = c.getContext('2d'); x.scale(sc, sc); x.drawImage(img, 0, 0, W, H); URL.revokeObjectURL(url); save(c.toDataURL('image/png').split(',')[1], true); };
  img.onerror = () => { URL.revokeObjectURL(url); toast(L('ui.pngFailed')); };
  img.src = url;
}
async function deskBaselineGit() {
  if (!S.desk) { toast(L('desk.needFolder')); return; }
  toast(L('diff.gitLoading'));
  try { const b = await deskInvoke('git_baseline_cmd', { rev: 'HEAD' }); if (!b.files.length) toast(L('diff.gitEmpty')); else setBaseline(b.files, b.name); }
  catch (e) { toast(L('diff.gitError', { msg: String(e) })); }
}
async function deskBaselineDir() {
  try { const root = await deskInvoke('pick_folder'); if (!root) return; const f = await deskInvoke('read_folder_cmd', { root }); if (!f.files.length) { toast(L('ui.noModelFiles')); return; } setBaseline(f.files, f.name); }
  catch (e) { toast(String(e)); }
}
function initDesktop() {
  document.documentElement.classList.add('desk');
  // Ordner öffnen und neu einlesen über Rust
  $('dirBtn').onclick = async () => { try { const root = await deskInvoke('pick_folder'); if (root) await deskOpen(root); } catch (e) { toast(String(e)); } };
  $('reloadBtn').onclick = () => { if (S.desk) deskOpen(S.desk.root, true); };
  // Einzelne Dateien und Beispiel lösen die Verbindung zum Ordner
  const detach = () => { if (S.desk) { S.desk = null; S.dirty.clear(); store.set('deskRoot', ''); deskInvoke('close_folder').catch(() => {}); deskDirty(); } };
  $('file').addEventListener('change', detach, true); $('sampleBtn').addEventListener('click', detach, true);
  // Speichern
  const sb = document.createElement('button'); sb.className = 'btn'; sb.id = 'saveBtn'; sb.type = 'button'; sb.hidden = true; sb.title = L('desk.saveTitle');
  $('reloadBtn').after(sb); sb.onclick = deskSave;
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); deskSave(); } });
  ta.addEventListener('input', () => { if (S.desk && curFile()) { S.dirty.add(curFile().name); deskDirty(); } });
  // Export als Datei
  for (const [anchor, V] of [['pngBtn', MV], ['dPng', DV]]) {
    const a = $(anchor); if (!a) continue;
    const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.dataset.i18n = 'desk.saveSvg'; b.textContent = L('desk.saveSvg'); b.onclick = () => deskExport(V, 'svg');
    const c = document.createElement('button'); c.className = 'btn'; c.type = 'button'; c.dataset.i18n = 'desk.savePng'; c.textContent = L('desk.savePng'); c.onclick = () => deskExport(V, 'png');
    a.after(b, c);
  }
  // Ereignisse aus Rust
  DESK.event.listen('folder-changed', e => deskMerge(e.payload));
  DESK.event.listen('close-requested', async e => {
    const save = await deskInvoke('ask_close', { title: L('desk.closeTitle'), text: Ln('desk.closeText', e.payload), saveLabel: L('desk.saveClose'), discardLabel: L('desk.discardClose') });
    if (save) await deskSave();
    if (!save || !S.dirty.size) deskInvoke('quit');
  });
}
// Beim Start: Ordner aus der Kommandozeile oder der zuletzt geöffnete
async function deskStartup() {
  initDesktop();
  let root = null; try { root = await deskInvoke('startup_folder'); } catch (e) {}
  if (!root) root = store.get('deskRoot') || null;
  if (root && await deskOpen(root)) { setMode(S.mode); return true; }
  store.set('deskRoot', '');
  return false;
}
