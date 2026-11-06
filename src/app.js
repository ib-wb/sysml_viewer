/* ================= App ================= */
const SAMPLES = /*SAMPLE*/; // Beispielprojekt je Sprache
const DIAG_CSS = /*DIAGCSS_STR*/;
const TOKENS = ['--ink','--muted','--edge','--canvas','--n-bg','--n-part','--n-item','--n-port','--n-attr','--n-req','--n-state','--n-action','--n-usage','--port','--flow','--accent','--warn'];
const $ = s => document.getElementById(s);
const ta = $('code'), gutter = $('gutter');
const mctx = document.createElement('canvas').getContext('2d');
measureText = (t, f) => { mctx.font = f; return mctx.measureText(t).width; };
$('mdefs').innerHTML = MARKERS;
let elk = null; try { elk = new ELK(); } catch (e) { elk = null; }
const I18N = /*I18N*/;
setDicts(I18N);
/* ---------- Sprache ---------- */
function pickLang() {
  const saved = store.get('lang'); if (saved && I18N[saved]) return saved;
  for (const n of (navigator.languages || [navigator.language || ''])) { const c = String(n).toLowerCase().split('-')[0]; if (I18N[c]) return c; }
  return I18N.en ? 'en' : BASE_LANG;
}
function applyStatic() {
  document.documentElement.lang = LANG;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = L(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-html]')) el.innerHTML = L(el.dataset.i18nHtml);
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = L(el.dataset.i18nTitle);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', L(el.dataset.i18nAria));
  for (const el of document.querySelectorAll('[data-i18n-ph]')) el.placeholder = L(el.dataset.i18nPh);
  if (S.brand) { const bp = document.querySelector('.brand p'); bp.textContent = bp.title = S.brand(); }
  const sel = $('langSel');
  if (sel && !sel.options.length) sel.innerHTML = Object.keys(I18N).sort().map(c => `<option value="${c}">${esc(I18N[c]._name || c)}</option>`).join('');
  if (sel) sel.value = LANG;
}
function changeLang(code, noStore) {
  setLang(code); if (!noStore) store.set('lang', LANG);
  applyStatic();
  if (!$('info').dataset.custom) $('info').textContent = L('ui.info.diag');
  if (S.project === SAMPLE && isPristineSample(S.files) && S.files[0].text !== sampleFiles()[0].text) { setFiles(sampleFiles(), SAMPLE); return; }
  if (S.files.length) reparse(); else renderFocusBar();
  if (!$('detail').hidden) refreshDetail();
}
$('langSel').onchange = e => changeLang(e.target.value);
const SAMPLE = '__sample__'; // Projektname des Beispiels wird beim Anzeigen übersetzt
const sampleFiles = (code = LANG) => JSON.parse(JSON.stringify(SAMPLES[code] || SAMPLES.en || SAMPLES.de));
// Unverändertes Beispiel in irgendeiner Sprache? Nur dann darf der Sprachwechsel es austauschen.
const isPristineSample = files => Object.values(SAMPLES).some(sm => sm.length === files.length && sm.every(f => files.some(g => g.name === f.name && g.text === f.text)));
const projName = () => S.project === SAMPLE ? L('ui.sampleName') : S.project;

// In VS Code läuft der Viewer als Webview: Dateien kommen von der Erweiterung, Zustand über die State-API
const VSC = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
const vstate = VSC ? (VSC.getState() || {}) : null;
const store = {
  get(k) { if (VSC) return vstate[k] ?? null; try { return localStorage.getItem('sv2.' + k); } catch (e) { return null; } },
  set(k, v) { if (VSC) { if (k === 'files' || k === 'project') return; vstate[k] = v; VSC.setState(vstate); return; } try { localStorage.setItem('sv2.' + k, v); } catch (e) {} },
};
const S = {
  mode: store.get('mode') || 'nav', view: store.get('view') || 'struct', ctx: {}, opts: { feats: true, ports: false, attrs: false, usages: true, behav: true, byFile: true, depth: 2 },
  files: [], active: 0, project: SAMPLE, pick: {}, sel: null, lastKey: '', dstack: [], dirHandle: null,
};
try { Object.assign(S.opts, JSON.parse(store.get('opts') || '{}')); Object.assign(S.ctx, JSON.parse(store.get('ctx') || '{}')); S.pick = JSON.parse(store.get('pick') || '{}'); } catch (e) {}

const keyOf = el => el ? (el.qn || el.name || '') + '|' + el.kind + '|' + (el.isDef ? 'd' : 'u') + (el.anon || !el.name ? '|' + el.file + ':' + el.line : '') : '';
const findByKey = k => IDX && IDX.all.find(e => keyOf(e) === k);
const packages = () => IDX.all.filter(e => e.kind === 'package' && e.name);
const fileCands = () => S.files.length > 1 ? S.files.map(f => ({ key: 'file:' + f.name, get label() { return L('ui.ctx.file', { name: f.name }); }, file: f.name })) : [];
const VIEWS = {
  struct: { get label() { return L('view.struct'); }, needs: false, cands: () => [{ key: '', label: S.files.length > 1 ? L('ui.ctx.allFiles', { n: S.files.length }) : L('ui.ctx.whole') }, ...fileCands(), ...packages().map(p => ({ key: keyOf(p), label: L('ui.ctx.package', { name: p.qn }), el: p }))], build: c => viewStruct(c.el || (c.file ? fileScope(c.file) : null), S.opts) },
  ibd: { get label() { return L('view.ibd'); }, needs: true, cands: () => ibdCandidates().map(e => ({ key: keyOf(e), label: (e.isDef ? kindLabel(e) + ' ' : '') + e.name + (!e.isDef && e.types[0] ? ' : ' + shortT(e.types[0]) : ''), el: e })), build: c => viewIBD(c.el, S.opts.depth), get none() { return L('view.ibd.none'); } },
  states: { get label() { return L('view.states'); }, needs: true, cands: () => stateCandidates().map(e => ({ key: keyOf(e), label: (e.isDef ? 'state def ' : 'state ') + e.name, el: e })), build: c => viewStates(c.el), get none() { return L('view.states.none'); } },
  actions: { get label() { return L('view.actions'); }, needs: true, cands: () => actionCandidates().map(e => ({ key: keyOf(e), label: (e.isDef ? 'action def ' : 'action ') + e.name, el: e })), build: c => viewActions(c.el), get none() { return L('view.actions.none'); } },
  reqs: { get label() { return L('view.reqs'); }, needs: false, cands: () => [{ key: '', label: L('ui.ctx.whole') }, ...packages().map(p => ({ key: keyOf(p), label: L('ui.ctx.package', { name: p.qn }), el: p }))], build: c => viewReqs(c.el || null) },
};
function fileScope(name) { return { children: IDX.root.children.filter(c => c.file === name), kind: 'package' }; }
const LEG = {
  comp: ['<path d="M14,6 H32" class="e"/><path d="M2,6 L7,3 L12,6 L7,9 Z" class="mk-solid"/>', 'Komposition (part)'],
  spec: ['<path d="M12,6 H32" class="e"/><path d="M2,6 L12,1 L12,11 Z" class="mk-hollow"/>', 'Spezialisierung :>'],
  typed: ['<path d="M2,6 H30" class="e e-typed" marker-end="url(#m-open)"/>', 'typisiert / Verweis'],
  defby: ['<path d="M12,6 H32" class="e e-defby"/><path d="M2,6 L12,1 L12,11 Z" class="mk-hollow"/>', 'Usage : Definition'],
  conn: ['<path d="M2,6 H32" class="e e-conn"/>', 'connect'],
  iface: ['<path d="M2,6 H32" class="e e-iface"/>', 'interface'],
  flow: ['<path d="M2,6 H30" class="e e-flow" marker-end="url(#m-fill)"/>', 'flow'],
  port: ['<rect x="12" y="1" width="10" height="10" class="pt"/><path d="M14.5,3 L19.5,6 L14.5,9 Z" class="pa"/>', 'Port, Pfeil = Richtung'],
  trans: ['<path d="M2,6 H30" class="e" marker-end="url(#m-open)"/>', 'Transition'],
  succ: ['<path d="M2,6 H30" class="e" marker-end="url(#m-open)"/>', 'Nachfolge (then)'],
  init: ['<circle cx="17" cy="6" r="5" class="ps-fill"/>', 'Start'],
  final: ['<circle cx="17" cy="6" r="5.5" class="ps-ring"/><circle cx="17" cy="6" r="3" class="ps-fill"/>', 'Ende (done)'],
  satisfy: ['<path d="M2,6 H30" class="e e-satisfy" marker-end="url(#m-open)"/>', 'satisfy'],
  contain: ['<path d="M14,6 H32" class="e"/><circle cx="7" cy="6" r="5" class="mk-hollow"/><path d="M7,2 V10 M3,6 H11" class="mk-line"/>', 'enthält'],
  amb: ['<rect x="4" y="1" width="26" height="10" rx="1" class="nb" style="stroke:var(--warn);stroke-width:2"/>', 'Name mehrfach definiert'],
};
const legendHTML = (model) => {
  const used = new Set(model.edges.map(e => e.cls));
  (function w(ns) { for (const n of ns) { if (n.ports.length) used.add('port'); if (n.pseudo) used.add(n.pseudo); if (n.el && n.el.isDef && (IDX.defs.get(n.el.name) || []).length > 1) used.add('amb'); w(n.children); } })(model.roots);
  const TIPK = { comp: 'e-comp', spec: 'e-spec', typed: 'e-typed', defby: 'e-defby', conn: 'e-conn', iface: 'e-iface', flow: 'e-flow', port: 'port-generic', trans: 'e-trans', succ: 'e-succ', init: 'init', final: 'final', satisfy: 'e-satisfy', contain: 'e-contain', amb: 'amb' };
  return [...(model.legend || []), 'amb'].filter(k => used.has(k) && LEG[k]).map(k => `<span data-tip="${TIPK[k] || ''}"><svg class="dg" width="34" height="12" viewBox="0 0 34 12">${LEG[k][0]}</svg>${esc(L('leg.' + k))}</span>`).join('');
};

/* ---------- Zeichenfläche mit Zoom & Verschieben ---------- */
function makeViewer(canvas, vp, zl, onPick) {
  const V = { Z: { x: 0, y: 0, k: 1 }, cur: null };
  V.apply = () => { vp.setAttribute('transform', `translate(${V.Z.x},${V.Z.y}) scale(${V.Z.k})`); zl.textContent = Math.round(V.Z.k * 100) + '%'; };
  V.fit = () => {
    if (!V.cur) return; const b = canvas.getBoundingClientRect(); const { W, H } = V.cur;
    if (!b.width) return;
    const k = Math.max(0.12, Math.min((b.width - 24) / W, (b.height - 110) / H, 1.4));
    V.Z = { k, x: (b.width - W * k) / 2, y: Math.max(52, (b.height - H * k) / 2) }; V.apply();
  };
  V.zoomAt = (f, cx, cy) => { const k = Math.min(4, Math.max(0.08, V.Z.k * f)); const r = k / V.Z.k; V.Z.x = cx - (cx - V.Z.x) * r; V.Z.y = cy - (cy - V.Z.y) * r; V.Z.k = k; V.apply(); };
  V.center = () => { const b = canvas.getBoundingClientRect(); return [b.width / 2, b.height / 2]; };
  canvas.addEventListener('wheel', e => { e.preventDefault(); const b = canvas.getBoundingClientRect(); V.zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - b.left, e.clientY - b.top); }, { passive: false });
  const ptrs = new Map(); let drag = null, moved = false, pinch = null;
  canvas.addEventListener('pointerdown', e => {
    if (e.target.closest('button, select, .zoom')) return;
    canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = false;
    if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, zx: V.Z.x, zy: V.Z.y };
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: V.Z.k }; drag = null; }
  });
  canvas.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); const bb = canvas.getBoundingClientRect(); V.zoomAt((pinch.k * d / pinch.d) / V.Z.k, (a[0] + b[0]) / 2 - bb.left, (a[1] + b[1]) / 2 - bb.top); moved = true; return; }
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) { moved = true; canvas.classList.add('panning'); } V.Z.x = drag.zx + dx; V.Z.y = drag.zy + dy; V.apply(); }
  });
  const endPtr = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) { drag = null; canvas.classList.remove('panning'); } };
  canvas.addEventListener('pointerup', e => { if (!ptrs.has(e.pointerId)) return; const wasDrag = moved; endPtr(e); if (!wasDrag) { const t = document.elementFromPoint(e.clientX, e.clientY); onPick(t, e); } });
  canvas.addEventListener('pointercancel', endPtr);
  return V;
}
const MV = makeViewer($('canvas'), $('vp'), $('zl'), pickMain);
const DV = makeViewer($('dCanvas'), $('dVp'), $('dZl'), pickDetail);
for (const [V, p] of [[MV, ''], [DV, 'd']]) {
  $(p ? 'dZIn' : 'zIn').onclick = () => V.zoomAt(1.25, ...V.center());
  $(p ? 'dZOut' : 'zOut').onclick = () => V.zoomAt(0.8, ...V.center());
  $(p ? 'dZFit' : 'zFit').onclick = () => V.fit();
}
window.addEventListener('resize', () => { MV.fit(); if (!$('detail').hidden) DV.fit(); });

async function layoutAndShow(model, V, vpEl, legEl, noteEl) {
  const g = await elk.layout(elkGraph(model));
  const r = renderSVG(model, g); V.cur = r; vpEl.innerHTML = r.body;
  legEl.innerHTML = legendHTML(model);
  if (model.note) { noteEl.textContent = model.note; noteEl.hidden = false; } else noteEl.hidden = true;
  return r;
}

/* ---------- Parsen ---------- */
let IDXok = false, parseRes = null;
function reparse() {
  try { parseRes = parseFiles(S.files); buildIndex(parseRes.root, S.pick); IDXok = true; }
  catch (e) { console.error(e); IDXok = false; $('stat').textContent = L('ui.parseError', { msg: e.message }); return; }
  const nRel = IDX.all.reduce((a, e) => a + e.rels.length, 0) + IDX.root.rels.length;
  const nf = S.files.length;
  $('stat').textContent = [nf > 1 ? Ln('ui.stat.files', nf) : null, L('ui.stat.model', { el: Ln('count.elements', IDX.all.length), rel: Ln('ui.stat.rels', nRel) }), parseRes.warns.length ? Ln('ui.stat.warns', parseRes.warns.length) : L('ui.stat.noWarns')].filter(Boolean).join(' · ');
  $('nEl').textContent = IDX.all.length;
  try { buildTrace(); } catch (e) { console.error(e); }
  checkCache = null;
  renderAmbig(); renderWarns(); renderFileSel(); renderTree(); renderTabs();
  if (S.mode === 'diag') update(); else renderNav();
  if (!$('detail').hidden) refreshDetail();
}
function renderWarns() {
  const wl = $('wlist'); wl.innerHTML = '';
  for (const w of parseRes.warns.slice(0, 15)) {
    const b = document.createElement('button'); b.type = 'button';
    b.textContent = locText({ file: S.files.length > 1 ? w.file : null, line: w.line }) + ': ' + w.msg;
    b.onclick = () => gotoLine(w.file, w.line); wl.appendChild(b);
  }
}
function renderAmbig() {
  const box = $('ambig'); box.innerHTML = '';
  if (!IDX.ambig.length) { box.hidden = true; return; }
  box.hidden = false;
  const head = document.createElement('div'); head.className = 'amb-head';
  head.innerHTML = `<b>${esc(Ln('ui.amb.count', IDX.ambig.length))}</b><span>${esc(L('ui.amb.explain'))}</span>`;
  box.appendChild(head);
  for (const a of IDX.ambig) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'amb-item';
    const chosen = S.pick[a.name];
    b.innerHTML = `<span class="nm">${esc(a.name)}</span><span>${esc(L('ui.amb.times', { n: a.defs.length }))}</span><span class="ch">${esc(chosen ? L('ui.amb.chosen', { qn: chosen }) : L('ui.amb.auto'))}</span>`;
    b.onclick = () => openAmbig(a.name); box.appendChild(b);
  }
}
function openAmbig(name) {
  const list = IDX.defs.get(name) || []; if (list.length < 2) return;
  const wrap = document.createElement('form'); wrap.className = 'amb-form';
  const refs = IDX.all.filter(e => e.types.concat(e.specs).some(t => lastSeg(t) === name && !t.includes('::')));
  wrap.innerHTML = `<p>${L('ui.amb.dialog', { name: esc(name), n: list.length, refs: Ln('ui.amb.refs', refs.length), code: '<code>: ' + esc(name) + '</code>', qn: '<code>' + esc(list[0].qn) + '</code>' })}</p>`;
  const opts = [{ v: '', l: L('ui.amb.autoTitle'), d: L('ui.amb.autoText') }]
    .concat(list.map(d => ({ v: d.qn, l: d.qn, d: `${kindLabel(d)} · ${locText(d)}${d.doc ? ' · ' + d.doc : ''}` })));
  for (const o of opts) {
    const id = 'amb_' + Math.random().toString(36).slice(2, 8);
    const row = document.createElement('label'); row.className = 'amb-opt'; row.htmlFor = id;
    row.innerHTML = `<input type="radio" name="amb" id="${id}" value="${esc(o.v)}"${(S.pick[name] || '') === o.v ? ' checked' : ''}><span><b>${esc(o.l)}</b><small>${esc(o.d)}</small></span>`;
    wrap.appendChild(row);
  }
  if (refs.length) {
    const r = document.createElement('div'); r.className = 'amb-refs';
    r.innerHTML = `<small>${esc(L('ui.amb.affected'))}</small>`;
    for (const e of refs.slice(0, 10)) { const b = document.createElement('button'); b.type = 'button'; b.className = 'linkbtn'; b.textContent = `${e.qn} (${locText(e)})`; b.onclick = () => { closeModal(); gotoLine(e.file, e.line); }; r.appendChild(b); }
    wrap.appendChild(r);
  }
  const act = document.createElement('div'); act.className = 'amb-act';
  act.innerHTML = `<button class="btn primary" type="submit">${esc(L('ui.apply'))}</button>`;
  wrap.appendChild(act);
  wrap.onsubmit = e => {
    e.preventDefault(); const v = (wrap.querySelector('input[name="amb"]:checked') || {}).value || '';
    if (v) S.pick[name] = v; else delete S.pick[name];
    store.set('pick', JSON.stringify(S.pick)); closeModal(); reparse(); toast(v ? L('ui.amb.toastPick', { name, qn: v }) : L('ui.amb.toastAuto', { name }));
  };
  modal(L('ui.amb.title', { name }), '', wrap);
}

/* ---------- Ansichten ---------- */
function renderTabs() {
  const box = $('vtabs'); box.innerHTML = '';
  for (const [k, v] of Object.entries(VIEWS)) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'vtab'; b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(S.view === k));
    const n = IDXok && v.needs ? v.cands().length : null;
    b.innerHTML = v.label + (n != null ? `<span class="n">${n}</span>` : '');
    b.onclick = () => { S.view = k; store.set('view', k); renderTabs(); update(true); };
    box.appendChild(b);
  }
}
function renderOpts() {
  const o = $('opts'); o.innerHTML = '';
  const cb = (key, label) => { const l = document.createElement('label'); l.innerHTML = `<input type="checkbox" id="o_${key}"${S.opts[key] ? ' checked' : ''}> ${label}`; l.querySelector('input').onchange = e => { S.opts[key] = e.target.checked; store.set('opts', JSON.stringify(S.opts)); update(true); }; o.appendChild(l); };
  if (S.view === 'struct') { if (S.files.length > 1) cb('byFile', esc(L('opt.byFile'))); for (const k of ['feats', 'ports', 'attrs', 'behav', 'usages']) cb(k, esc(L('opt.' + k))); }
  if (S.view === 'ibd') {
    const l = document.createElement('label'); l.innerHTML = esc(L('opt.depth')) + ' <select id="o_depth"><option value="1">1</option><option value="2">2</option><option value="3">3</option></select>';
    const sel = l.querySelector('select'); sel.value = String(S.opts.depth); sel.onchange = e => { S.opts.depth = +e.target.value; store.set('opts', JSON.stringify(S.opts)); update(true); }; o.appendChild(l);
  }
}
let gen = 0;
async function update(refit) {
  if (!IDXok) return;
  const my = ++gen; const v = VIEWS[S.view];
  renderOpts();
  const cands = v.cands(); const sel = $('ctx');
  sel.innerHTML = cands.map(c => `<option value="${esc(c.key)}">${esc(c.label)}</option>`).join('');
  const F = navFocus();
  if (F && S.ctxFocus[S.view] !== keyOf(F)) { const k = ctxFor(S.view, F, cands); if (k != null) S.ctx[S.view] = k; S.ctxFocus[S.view] = keyOf(F); }
  let want = S.ctx[S.view]; if (!cands.some(c => c.key === want)) want = cands[0] ? cands[0].key : '';
  sel.value = want; sel.disabled = cands.length < 2;
  const cand = cands.find(c => c.key === want);
  const ctxKey = S.view + '::' + want; if (ctxKey !== S.lastKey) refit = true; S.lastKey = ctxKey;
  $('legend').innerHTML = ''; $('note').hidden = true;
  if (!cand || (v.needs && !cand.el)) { showEmpty(v.none || L('ui.nothing')); return; }
  let model; try { model = v.build(cand); } catch (e) { console.error(e); showEmpty(L('ui.buildError', { msg: esc(e.message) })); return; }
  if (model.empty) { showEmpty(model.empty); return; }
  if (!elk) { showEmpty(L('ui.noElk')); return; }
  $('busy').hidden = false;
  try { model = model; const g = await elk.layout(elkGraph(model)); if (my !== gen) return;
    const r = renderSVG(model, g); MV.cur = r; $('vp').innerHTML = r.body; $('legend').innerHTML = legendHTML(model);
    if (model.note) { $('note').textContent = model.note; $('note').hidden = false; }
  } catch (e) { console.error(e); $('busy').hidden = true; showEmpty(L('ui.layoutError', { msg: esc(e.message || String(e)) })); return; }
  $('busy').hidden = true; $('empty').hidden = true;
  MV.title = (cand.el ? cand.el.name : cand.file || projName()) + '_' + v.label;
  markFocus($('vp'));
  if (refit) MV.fit(); else MV.apply();
}
function showEmpty(html) { $('vp').innerHTML = ''; MV.cur = null; $('busy').hidden = true; const e = $('empty'); e.innerHTML = `<div>${html}</div>`; e.hidden = false; }
$('ctx').onchange = e => { S.ctx[S.view] = e.target.value; store.set('ctx', JSON.stringify(S.ctx)); update(true); };

/* ---------- Auswahl & Drill-down ---------- */
const elByEid = eid => IDX && IDX.all.find(e => String(e.eid) === String(eid));
function hitEl(t) { const g = t && t.closest && t.closest('[data-eid]'); return g && g.dataset.eid ? elByEid(g.dataset.eid) : null; }
function hitLine(t) { const p = t && t.closest && t.closest('[data-line]'); return p ? { line: +p.dataset.line, file: p.dataset.file } : null; }
function pickMain(t) {
  const el = hitEl(t);
  if (el) { setFocus(el, { here: true }); showInfo(el); if (isOpenable(el)) openDetail(el, true); return; }
  const l = hitLine(t); if (l) { showInfoLine(l); return; }
  $('info').textContent = L('ui.info.diag');
}
function markSel(vp, el) { vp.querySelectorAll('.sel').forEach(n => n.classList.remove('sel')); if (el) vp.querySelectorAll(`[data-eid="${el.eid}"]`).forEach(n => n.classList.add('sel')); }
function drillTargets(el) {
  const t = [];
  const tdef = el.types && el.types[0] ? resolveDef(el.types[0], el) : null;
  const pickC = (list) => list.includes(el) ? el : (tdef && list.includes(tdef) ? tdef : null);
  const ibEl = pickC(ibdCandidates()); if (ibEl) t.push([L('view.ibd'), 'ibd', ibEl]);
  const stEl = pickC(stateCandidates()); if (stEl) t.push([L('view.states'), 'states', stEl]);
  const acEl = pickC(actionCandidates()); if (acEl) t.push([L('view.actions'), 'actions', acEl]);
  return t;
}
const fileLine = el => locText({ file: S.files.length > 1 ? el.file : null, line: el.line });
function showInfo(el) {
  const info = $('info'); info.innerHTML = '';
  const k = document.createElement('span'); k.className = 'kd'; k.textContent = kindLabel(el) || el.kind; info.appendChild(k);
  const q = document.createElement('span'); q.className = 'qn'; q.textContent = el.qn || el.name || ''; info.appendChild(q);
  const h = document.createElement('span'); h.textContent = L('ui.info.inFocus'); info.appendChild(h);
}
function showInfoLine(l) { const info = $('info'); info.innerHTML = ''; const b = document.createElement('button'); b.className = 'linkbtn'; b.type = 'button'; b.textContent = L('ui.info.relSource', { loc: locText({ file: S.files.length > 1 ? l.file : null, line: l.line }) }); b.onclick = () => gotoLine(l.file, l.line); info.appendChild(b); }

/* ---------- Detaildiagramm ---------- */
async function openDetail(el, push) {
  if (push) { const top = S.dstack[S.dstack.length - 1]; if (top !== keyOf(el)) S.dstack.push(keyOf(el)); }
  $('detail').hidden = false;
  await renderDetail(el);
}
function refreshDetail() {
  while (S.dstack.length) { const el = findByKey(S.dstack[S.dstack.length - 1]); if (el) { renderDetail(el); return; } S.dstack.pop(); }
  closeDetail();
}
function closeDetail() { $('detail').hidden = true; S.dstack = []; }
let dgen = 0;
async function renderDetail(el) {
  const my = ++dgen;
  // Brotkrumen
  const cr = $('dCrumbs'); cr.innerHTML = '';
  S.dstack.forEach((k, i) => {
    const e = findByKey(k); if (!e) return;
    if (i) { const s = document.createElement('span'); s.className = 'sep'; s.textContent = '›'; cr.appendChild(s); }
    const b = document.createElement('button'); b.type = 'button'; b.textContent = e.name; b.className = i === S.dstack.length - 1 ? 'cur' : '';
    b.onclick = () => { S.dstack = S.dstack.slice(0, i + 1); renderDetail(e); }; cr.appendChild(b);
  });
  $('dBack').disabled = S.dstack.length < 2;
  // Metadaten
  const meta = $('dMeta'); meta.innerHTML = '';
  const add = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; n.textContent = txt; meta.appendChild(n); return n; };
  add('span', 'kd', kindLabel(el)); add('span', 'qn', el.qn || el.name);
  const b = add('button', 'linkbtn', fileLine(el)); b.type = 'button'; b.onclick = () => gotoLine(el.file, el.line);
  if (stageOf(el)) { const t = add('button', 'linkbtn', L('nav.tab.trace')); t.type = 'button'; t.onclick = () => navGo(el, 'trace'); const im = add('button', 'linkbtn', L('nav.tab.impact')); im.type = 'button'; im.onclick = () => navGo(el, 'impact'); }
  for (const [lab, view, ctxEl] of drillTargets(el)) { if (view === 'ibd') continue; const d = add('button', 'linkbtn', L('ui.openView', { view: lab })); d.type = 'button'; d.onclick = () => { closeDetail(); S.view = view; S.ctx[view] = keyOf(ctxEl); if (S.mode !== 'diag') setMode('diag'); renderTabs(); update(true); }; }
  const ambNames = new Set();
  if (el.isDef && (IDX.defs.get(el.name) || []).length > 1) ambNames.add(el.name);
  for (const t of el.types.concat(el.specs)) if (!t.includes('::') && (IDX.defs.get(lastSeg(t)) || []).length > 1) ambNames.add(lastSeg(t));
  for (const n of ambNames) { const w = add('button', 'ambbtn', L('ui.amb.check', { name: n })); w.type = 'button'; w.onclick = () => openAmbig(n); }
  const db = document.createElement('details'); db.className = 'dbrief'; db.open = briefOpen; db.innerHTML = `<summary>${esc(L('focus.brief'))}</summary>` + briefHTML(el); db.addEventListener('click', e => { if (briefClick(e, x => isOpenable(x) ? openDetail(x, true) : (closeDetail(), navGo(x, 'trace')))) e.preventDefault(); }); meta.appendChild(db);
  // Diagramm
  let model; try { model = viewDetail(el); } catch (e) { console.error(e); $('dVp').innerHTML = ''; return; }
  $('dBusy').hidden = false;
  try {
    const g = await elk.layout(elkGraph(model)); if (my !== dgen) return;
    const r = renderSVG(model, g); DV.cur = r; DV.title = el.name + '_Detail';
    $('dVp').innerHTML = r.body; $('dLegend').innerHTML = legendHTML(model);
    const nt = []; if (model.usedIn > 12) nt.push(L('ui.usedInLimited', { n: model.usedIn, shown: 12 })); if (model.note) nt.push(model.note);
    $('dNote').textContent = nt.join(' · '); $('dNote').hidden = !nt.length;
    $('dSel').textContent = L('ui.info.detail');
  } catch (e) { console.error(e); }
  $('dBusy').hidden = true;
  requestAnimationFrame(() => DV.fit());
}
function pickDetail(t) {
  const el = hitEl(t); const cur = findByKey(S.dstack[S.dstack.length - 1]);
  if (el) {
    setFocus(el); markFocus($('dVp'));
    if (isOpenable(el) && el !== cur) { openDetail(el, true); return; }
    const s = $('dSel'); s.innerHTML = '';
    const k = document.createElement('span'); k.className = 'kd'; k.textContent = kindLabel(el) || el.kind; s.appendChild(k);
    const q = document.createElement('span'); q.className = 'qn'; q.textContent = ' ' + (el.qn || el.name) + ' '; s.appendChild(q);
    const b = document.createElement('button'); b.className = 'linkbtn'; b.type = 'button'; b.textContent = fileLine(el); b.onclick = () => gotoLine(el.file, el.line); s.appendChild(b);
    return;
  }
  const l = hitLine(t); if (l) gotoLine(l.file, l.line);
}
$('dBack').onclick = () => { if (S.dstack.length > 1) { S.dstack.pop(); refreshDetail(); } };
$('dClose').onclick = closeDetail;

/* ---------- Quelltext & Dateien ---------- */
function curFile() { return S.files[S.active] || S.files[0]; }
function renderFileSel() {
  const sel = $('fileSel');
  const wc = {}; for (const w of parseRes.warns) wc[w.file] = (wc[w.file] || 0) + 1;
  sel.innerHTML = S.files.map((f, i) => `<option value="${i}">${esc(f.name)}${wc[f.name] ? ' · ' + wc[f.name] + ' Hinweis' + (wc[f.name] > 1 ? 'e' : '') : ''}</option>`).join('');
  sel.value = String(S.active); sel.disabled = S.files.length < 2;
  $('project').textContent = projName() + (S.files.length > 1 ? ' · ' + Ln('ui.stat.files', S.files.length) : '');
  $('reloadBtn').hidden = !S.dirHandle;
}
$('fileSel').onchange = e => { showFile(+e.target.value); };
function showFile(i) { S.active = i; ta.value = curFile().text; syncGutter(); ta.scrollTop = 0; $('fileSel').value = String(i); }
function syncGutter() { const n = ta.value.split('\n').length; if (gutter.dataset.n !== String(n)) { let s = ''; for (let k = 1; k <= n; k++) s += k + '\n'; gutter.textContent = s; gutter.dataset.n = n; } gutter.scrollTop = ta.scrollTop; }
ta.addEventListener('scroll', () => { gutter.scrollTop = ta.scrollTop; });
let tmr = null;
ta.addEventListener('input', () => { syncGutter(); curFile().text = ta.value; clearTimeout(tmr); tmr = setTimeout(() => { persist(); reparse(); }, 350); });
ta.addEventListener('keydown', e => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('    ', s, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); } });
function persist() { store.set('files', JSON.stringify(S.files)); store.set('project', S.project); }
function setFiles(files, project, dirHandle) {
  files.sort((a, b) => (a.name.split('/').length - b.name.split('/').length) || a.name.localeCompare(b.name, 'de'));
  S.files = files; S.project = project; S.active = 0; S.dirHandle = dirHandle || null; S.sel = null; S.lastKey = ''; closeDetail();
  if (files.length > 1 && !S.view) S.view = 'struct';
  NAV.hist = []; NAV.idx = -1; NAV.tab = 'start'; saveHist();
  persist(); showFile(0); reparse();
}
function gotoLine(file, line) {
  if (VSC) { VSC.postMessage({ type: 'goto', file: file || (curFile() && curFile().name), line }); return; }
  showSrcTab('code');
  if (file) { const i = S.files.findIndex(f => f.name === file); if (i >= 0 && i !== S.active) showFile(i); }
  const lines = ta.value.split('\n'); let a = 0; for (let k = 0; k < line - 1 && k < lines.length; k++) a += lines[k].length + 1;
  const b = a + (lines[line - 1] || '').length;
  ta.focus({ preventScroll: true }); ta.setSelectionRange(a, b);
  const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20; ta.scrollTop = Math.max(0, (line - 6) * lh);
  if (window.innerWidth <= 860) ta.scrollIntoView({ block: 'center' });
}
function setSrc(show) { document.body.classList.toggle('nosrc', !show); $('srcToggle').dataset.i18n = show ? 'ui.src.hide' : 'ui.src.show'; $('srcToggle').textContent = L($('srcToggle').dataset.i18n); $('srcToggle').setAttribute('aria-pressed', String(!show)); store.set('nosrc', show ? '' : '1'); requestAnimationFrame(() => { if (S.mode === 'nav') drawLines(linePairs); else MV.fit(); }); }
$('srcToggle').onclick = () => setSrc(document.body.classList.contains('nosrc'));
function showSrcTab(which) {
  if (document.body.classList.contains('nosrc')) setSrc(true); const code = which === 'code'; $('tabCode').setAttribute('aria-selected', String(code)); $('tabTree').setAttribute('aria-selected', String(!code)); $('codeWrap').hidden = !code; $('tree').hidden = code; }
$('tabCode').onclick = () => showSrcTab('code'); $('tabTree').onclick = () => showSrcTab('tree');

function renderTree() {
  const tree = $('tree'); tree.innerHTML = '';
  const build = (children, depth) => {
    const ul = document.createElement('ul');
    for (const c of children) {
      if (!c.name || c.anon) continue;
      const li = document.createElement('li'); const b = document.createElement('button'); b.type = 'button';
      const amb = c.isDef && (IDX.defs.get(c.name) || []).length > 1;
      b.innerHTML = `<span class="k">${esc(kindLabel(c) || (c.dir || 'feature'))}</span><span${amb ? ' class="ambn"' : ''}>${esc(c.name)}</span>${c.types.length ? `<span class="t">: ${esc(c.types.map(shortT).join(', '))}</span>` : ''}`;
      b.onclick = () => navigateTo(c); li.appendChild(b);
      const kids = c.children.filter(x => x.name && !x.anon);
      if (kids.length && depth < 8) li.appendChild(build(kids, depth + 1));
      ul.appendChild(li);
    }
    return ul;
  };
  if (S.files.length > 1) {
    const ul = document.createElement('ul');
    for (const f of S.files) {
      const li = document.createElement('li'); const b = document.createElement('button'); b.type = 'button';
      b.innerHTML = `<span class="k">${esc(L('struct.fileStereo'))}</span><span>${esc(f.name)}</span>`;
      b.onclick = () => { S.view = 'struct'; S.ctx.struct = 'file:' + f.name; renderTabs(); update(true); showFile(S.files.indexOf(f)); };
      li.appendChild(b); li.appendChild(build(IDX.root.children.filter(c => c.file === f.name), 1)); ul.appendChild(li);
    }
    tree.appendChild(ul);
  } else tree.appendChild(build(IDX.root.children, 0));
}
function navigateTo(el) {
  setFocus(el);
  const up = pred => { for (let e = el; e; e = e.parent) if (pred(e)) return e; return null; };
  const st = stateCandidates(), ac = actionCandidates();
  if (S.mode === 'nav' && stageOf(el)) { navGo(el, 'trace'); return; }
  if (isOpenable(el)) { showInfo(el); openDetail(el, true); return; }
  let view = 'struct', ctx = '';
  if (el.kind === 'package') ctx = keyOf(el);
  else if (el.kind === 'state' && up(e => st.includes(e))) { view = 'states'; ctx = keyOf(up(e => st.includes(e))); }
  else if (el.kind === 'action' && up(e => ac.includes(e))) { view = 'actions'; ctx = keyOf(up(e => ac.includes(e))); }
  else if (el.kind === 'requirement' || el.kind === 'concern') { view = 'reqs'; const p = nearestPkg(el); ctx = p ? keyOf(p) : ''; }
  closeDetail(); S.view = view; S.ctx[view] = ctx; S.sel = el; store.set('view', view);
  if (S.mode !== 'diag') setMode('diag'); renderTabs(); update(true); showInfo(el);
}

/* ---------- Dateien & Ordner einlesen ---------- */
const isModelFile = n => /\.(sysml|kerml)$/i.test(n);
const SKIP_DIR = /(^|\/)(\.git|node_modules|\.venv|__pycache__|build|dist)(\/|$)/;
async function filesFromList(list) {
  const out = [];
  for (const f of list) {
    const path = (f.webkitRelativePath || f.relPath || f.name);
    if (!isModelFile(path) || SKIP_DIR.test(path) || f.size > 5e6) continue;
    out.push({ name: path, text: await f.text() });
  }
  return out;
}
function stripRoot(files) {
  const parts = files.map(f => f.name.split('/'));
  if (files.length && parts.every(p => p.length > 1 && p[0] === parts[0][0])) { const root = parts[0][0]; files.forEach(f => { f.name = f.name.slice(root.length + 1); }); return root; }
  return null;
}
async function loadList(list, label) {
  const files = await filesFromList(list);
  if (!files.length) { toast(L('ui.noModelFiles')); return; }
  const root = stripRoot(files);
  setFiles(files, root || label || (files.length === 1 ? files[0].name : L('diff.selection')));
  toast(Ln('ui.filesRead', files.length));
}
$('file').onchange = e => { loadList([...e.target.files], null); e.target.value = ''; };
$('dirInput').onchange = e => { loadList([...e.target.files], null); e.target.value = ''; };
$('fileBtn').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file').click(); } };
const canPickDir = (() => { try { return 'showDirectoryPicker' in window && window.self === window.top; } catch (e) { return false; } })();
async function readDirHandle(h, prefix, out) {
  for await (const [name, child] of h.entries()) {
    const p = prefix ? prefix + '/' + name : name;
    if (child.kind === 'directory') { if (!SKIP_DIR.test(p + '/')) await readDirHandle(child, p, out); }
    else if (isModelFile(name)) { const f = await child.getFile(); f.relPath = p; out.push(f); }
  }
  return out;
}
$('dirBtn').onclick = async () => {
  if (canPickDir) {
    try { const h = await window.showDirectoryPicker({ mode: 'read' }); const list = await readDirHandle(h, '', []); const files = await filesFromList(list);
      if (!files.length) { toast(L('ui.noModelFiles')); return; }
      setFiles(files, h.name, h); toast(Ln('ui.filesReadFrom', files.length, { dir: h.name })); return;
    } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  $('dirInput').click();
};
$('reloadBtn').onclick = async () => {
  if (!S.dirHandle) return;
  try { const list = await readDirHandle(S.dirHandle, '', []); const files = await filesFromList(list); const keepView = S.view;
    const act = curFile() && curFile().name; setFiles(files, S.dirHandle.name, S.dirHandle); S.view = keepView;
    const i = files.findIndex(f => f.name === act); if (i > 0) showFile(i); toast(L('ui.reloaded'));
  } catch (e) { toast(L('ui.reloadFailed', { msg: e.message })); }
};
$('sampleBtn').onclick = () => { const f = sampleFiles(); setFiles(f, SAMPLE); toast(Ln('ui.sampleLoaded', f.length)); };

// Drag & Drop: Dateien und ganze Ordner
async function entryFiles(entry, prefix, out) {
  if (entry.isFile) { await new Promise(r => entry.file(f => { f.relPath = prefix + entry.name; out.push(f); r(); }, () => r())); }
  else if (entry.isDirectory) {
    if (SKIP_DIR.test(prefix + entry.name + '/')) return;
    const reader = entry.createReader(); let batch;
    do { batch = await new Promise(r => reader.readEntries(r, () => r([]))); for (const e of batch) await entryFiles(e, prefix + entry.name + '/', out); } while (batch.length);
  }
}
let dragDepth = 0;
window.addEventListener('dragenter', e => { if ([...(e.dataTransfer && e.dataTransfer.types || [])].includes('Files')) { dragDepth++; $('drop').hidden = false; e.preventDefault(); } });
window.addEventListener('dragover', e => { e.preventDefault(); });
window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('drop').hidden = true; });
window.addEventListener('drop', async e => {
  e.preventDefault(); dragDepth = 0; $('drop').hidden = true;
  const items = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (items.length) { const out = []; for (const it of items) await entryFiles(it, '', out); const dirName = items.length === 1 && items[0].isDirectory ? items[0].name : null; await loadList(out, dirName); }
  else if (e.dataTransfer.files.length) loadList([...e.dataTransfer.files], null);
});

/* ---------- Export ---------- */
function standaloneSVG(cur) {
  const cs = getComputedStyle(document.documentElement); const vars = TOKENS.map(t => `${t}:${cs.getPropertyValue(t).trim()}`).join(';');
  const { W, H, defs, body } = cur;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="dg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>.dg{${vars};font-family:"IBM Plex Sans",Arial,sans-serif}${DIAG_CSS}</style><defs>${defs}</defs><rect width="${W}" height="${H}" style="fill:var(--canvas)"/>${body}</svg>`;
}
let lastFocus = null;
function modal(title, hint, node) { lastFocus = document.activeElement; $('mTitle').textContent = title; $('mHint').textContent = hint; const b = $('mBody'); b.innerHTML = ''; b.appendChild(node); $('modal').hidden = false; $('mClose').focus(); }
function closeModal() { $('modal').hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
$('mClose').onclick = closeModal;
$('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });
document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!$('modal').hidden) closeModal(); else if (!$('detail').hidden) closeDetail(); });
function copySvg(V) {
  if (!V.cur) return; const svg = standaloneSVG(V.cur);
  const fallback = () => { const t = document.createElement('textarea'); t.value = svg; t.readOnly = true; modal(L('ui.svgCode'), L('ui.svgCopyHint'), t); t.select(); };
  try { navigator.clipboard.writeText(svg).then(() => toast(L('ui.svgCopied')), fallback); } catch (e) { fallback(); }
}
function showPng(V) {
  if (!V.cur) return; const { W, H } = V.cur; const sc = Math.min(2, 8000 / Math.max(W, H));
  const img = new Image(); const url = URL.createObjectURL(new Blob([standaloneSVG(V.cur)], { type: 'image/svg+xml' }));
  img.onload = () => { const c = document.createElement('canvas'); c.width = Math.round(W * sc); c.height = Math.round(H * sc); const x = c.getContext('2d'); x.scale(sc, sc); x.drawImage(img, 0, 0, W, H); URL.revokeObjectURL(url);
    const out = new Image(); out.alt = L('ui.pngAlt'); out.src = c.toDataURL('image/png'); modal(L('ui.pngTitle'), L('ui.pngHint'), out); };
  img.onerror = () => { URL.revokeObjectURL(url); toast(L('ui.pngFailed')); };
  img.src = url;
}
$('copySvg').onclick = () => copySvg(MV); $('pngBtn').onclick = () => showPng(MV);
$('dSvg').onclick = () => copySvg(DV); $('dPng').onclick = () => showPng(DV);
let tt = null; function toast(m) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, 2400); }

/*NAV*/
/* ---------- VS Code ---------- */
const emptyWs = () => [{ name: L('vsc.noFilesName'), text: '// ' + L('vsc.noFilesText') + '\n' }];
function syncFiles(files, project) {
  if (!files || !files.length) files = emptyWs();
  files.sort((a, b) => (a.name.split('/').length - b.name.split('/').length) || a.name.localeCompare(b.name, 'de'));
  const first = !S.vscReady || S.project !== project;
  const act = !first && curFile() ? curFile().name : null;
  S.files = files; S.project = project || 'Workspace';
  if (first) { S.vscReady = true; S.active = 0; showFile(0); reparse(); setMode(S.mode); return; }
  const i = files.findIndex(f => f.name === act); S.active = i >= 0 ? i : 0;
  ta.value = curFile().text; syncGutter(); reparse();
}
function revealAt(file, line) {
  if (!IDXok) return;
  const inFile = IDX.all.filter(e => e.file === file && e.line <= line);
  if (!inFile.length) { toast(L('vsc.noElementHere')); return; }
  let el = inFile.reduce((a, b) => (b.line >= a.line ? b : a));
  while (el && !stageOf(el)) el = el.parent;
  if (!el || el.kind === 'root') { toast(L('vsc.noChainElement')); return; }
  S.revealing = true; navGo(el, NAV.tab === 'impact' ? 'impact' : 'trace'); S.revealing = false;
}
function initVSCode() {
  // Farbschema von VS Code übernehmen (body-Klassen vscode-light / vscode-dark / vscode-high-contrast)
  const theme = () => { const c = document.body.classList; document.documentElement.setAttribute('data-theme', c.contains('vscode-light') || c.contains('vscode-high-contrast-light') ? 'light' : (c.contains('vscode-dark') || c.contains('vscode-high-contrast')) ? 'dark' : ''); if (S.mode === 'nav') drawLines(linePairs); };
  theme(); new MutationObserver(theme).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  for (const id of ['fileBtn', 'dirBtn', 'reloadBtn', 'sampleBtn']) $(id).hidden = true;
  S.brand = () => L('vsc.reading'); applyStatic();
  ta.readOnly = true; ta.dataset.i18nTitle = 'vsc.readOnly'; ta.title = L('vsc.readOnly');
  if (store.get('nosrc') === null) setSrc(false);
  window.addEventListener('message', e => {
    const m = e.data || {};
    if (m.type === 'baseline') { if (m.error) toast(L('diff.gitError', { msg: m.error })); else if (!m.files.length) toast(L('diff.gitEmpty')); else setBaseline(m.files, m.name); }
    if (m.type === 'files') { syncFiles(m.files, m.project); S.brand = () => L('vsc.status', { project: m.project, files: Ln('vsc.modelFiles', m.files.length) }); applyStatic(); }
    if (m.type === 'config') { S.follow = !!m.follow; if (m.lang && !store.get('lang')) { const c = String(m.lang).toLowerCase().split('-')[0]; if (I18N[c] && c !== LANG) changeLang(c, true); } }
    if (m.type === 'reveal') revealAt(m.file, m.line);
  });
  VSC.postMessage({ type: 'ready' });
}

/* ---------- Start ---------- */
(async function start() {
  setLang(pickLang()); applyStatic(); $('info').textContent = L('ui.info.diag');
  if (VSC) {
    try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 800))]); } catch (e) {}
    initVSCode(); return;
  }
  let files = null, project = null;
  try { files = JSON.parse(store.get('files') || 'null'); project = store.get('project'); } catch (e) {}
  if (!files || !files.length) { const old = store.get('src'); if (old && old.trim()) { files = [{ name: store.get('fname') || 'Entwurf.sysml', text: old }]; project = files[0].name; } }
  if (project === SAMPLE && files && files.length && isPristineSample(files)) files = null; // unverändertes Beispiel: in aktueller Sprache neu laden
  if (!files || !files.length) { files = sampleFiles(); project = SAMPLE; }
  S.files = files; S.project = project || SAMPLE;
  try { await Promise.race([Promise.all(['12.5px "IBM Plex Sans"', '600 12.5px "IBM Plex Sans"', 'italic 10.5px "IBM Plex Sans"', '11px "IBM Plex Mono"'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  if (store.get('nosrc') === '1') setSrc(false);
  showFile(0); reparse(); setMode(S.mode);
})();
