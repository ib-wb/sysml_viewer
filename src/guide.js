
/* ================= Einstieg: Startseite, geführte Tour, Disziplinen, Baseline-Vergleich ================= */
const srcLine = (file, line) => { const f = S.files.find(x => x.name === file) || (S.files.length === 1 ? S.files[0] : null); return f && line ? (f.text.split('\n')[line - 1] || '').trim() : ''; };
const elBtn = e => `<button type="button" class="blink s-${stageOf(e) || 'x'}" data-eid="${e.eid}">${esc(dispName(e))}</button>`;
const locBtn = (file, line) => line ? `<button type="button" class="bact" data-file="${esc(file || '')}" data-line="${line}">${esc(locText({ file: S.files.length > 1 ? file : null, line }))}</button>` : '';
const nmOf = e => e ? (e.name && !e.anon ? e.name : dispName(e)) : '';

/* ---------- Startseite: Fragen statt Menüs ---------- */
function renderStart(body) {
  const cov = coverage().filter(r => r.status !== 'group');
  const gaps = cov.filter(r => r.status !== 'ok').length;
  const chk = currentChecks(), nErr = chk.filter(c => c.sev === 'error').length, nGap = chk.filter(c => c.sev === 'gap').length;
  const comps = IDX.all.filter(e => e.kind === 'part' && e.isDef && e.name && !e.mods.includes('abstract'));
  const tests = IDX.all.filter(e => stageOf(e) === 'test' && e.name && !e.anon && !trIn(e, 'typed').length);
  const dv = disciplines(), dview = dv.length ? disciplineView() : null;
  const D = S.base ? getDiff() : null, nDiff = D ? D.d.added.length + D.d.removed.length + D.d.changed.length : 0;
  const steps = buildTour().length;
  const opt = list => list.map(e => `<option value="${e.eid}">${esc(dispName(e))}</option>`).join('');
  const Q = [
    { id: 'tour', a: L('start.a.tour', { n: steps }), btn: L('start.b.tour'), lead: true },
    { id: 'struct', a: L('start.a.struct', { parts: Ln('start.n.parts', comps.length), links: Ln('start.n.links', TR.links.length) }), btn: L('start.b.struct') },
    { id: 'gaps', a: cov.length ? Ln('start.a.gaps', gaps, { total: cov.length }) : L('start.a.noReqs'), btn: L('start.b.gaps') },
    { id: 'how', a: L('start.a.how'), sel: cov.map(r => r.el), btn: L('start.b.how') },
    { id: 'change', a: L('start.a.change'), sel: comps, btn: L('start.b.change') },
    { id: 'check', a: nErr || nGap ? L('start.a.check', { err: Ln('sev.n.error', nErr), gap: Ln('sev.n.gap', nGap) }) : L('start.a.checkClean'), btn: L('start.b.check') },
    { id: 'disc', a: dview ? L('start.a.disc', { list: Lj(dv.map(d => d.name)), n: Ln('start.n.cross', dview.cross.length) }) : L('start.a.discNone'), btn: L('start.b.disc') },
    { id: 'diff', a: S.base ? Ln('start.a.diff', nDiff, { name: S.base.name }) : L('start.a.diffNone'), btn: L('start.b.diff') }
  ];
  body.innerHTML = `
  <div class="cov-sum">
    <div class="tile"><b>${S.files.length}</b><span>${esc(Ln('start.t.files', S.files.length))}</span></div>
    <div class="tile"><b>${cov.length}</b><span>${esc(L('cov.reqs'))}</span></div>
    <div class="tile"><b>${comps.length}</b><span>${esc(L('nav.components'))}</span></div>
    <div class="tile"><b>${TR.links.length}</b><span>${esc(L('start.t.links'))}</span></div>
    <div class="tile"><b>${tests.length}</b><span>${esc(L('start.t.tests'))}</span></div>
    <div class="tile ${gaps ? 'warn' : 'good'}"><b>${gaps}</b><span>${esc(L('cov.withGap'))}</span></div>
  </div>
  <h3 class="sh">${esc(L('start.title'))}</h3>
  <div class="qgrid">${Q.map(q => `<div class="qcard${q.lead ? ' lead' : ''}" data-qcard="${q.id}">
      <b>${esc(L('start.q.' + q.id))}</b><span>${esc(q.a)}</span>
      <div class="qact">${q.sel ? (q.sel.length ? `<select data-qsel="${q.id}" aria-label="${esc(L('start.q.' + q.id))}">${opt(q.sel)}</select>` : '') : ''}
      ${!q.sel || q.sel.length ? `<button type="button" class="btn${q.lead ? ' primary' : ''}" data-q="${q.id}">${esc(q.btn)}</button>` : ''}</div>
    </div>`).join('')}</div>`;
}
function startAction(id, sel) {
  const el = sel ? elByEid(sel.value) : null;
  if (id === 'tour') return startTour();
  if (id === 'struct') { S.view = ibdCandidates().length ? 'ibd' : 'struct'; store.set('view', S.view); delete S.ctxFocus[S.view]; setMode('diag'); renderTabs(); return; }
  if (id === 'gaps') { NAV.gaps = true; NAV.tab = 'cover'; }
  if (id === 'how' && el) return navGo(el, 'trace');
  if (id === 'change' && el) return navGo(el, 'impact');
  if (['check', 'disc', 'diff'].includes(id)) NAV.tab = id;
  saveHist(); renderNav(); $('nbody').scrollTop = 0;
}
$('nbody').addEventListener('click', e => {
  const q = e.target.closest('[data-q]'); if (!q) return;
  const card = q.closest('.qcard'); startAction(q.dataset.q, card && card.querySelector('select'));
});

/* ---------- Disziplinen ---------- */
S.discColor = store.get('disccolor') === '1';
const discIdx = d => d ? disciplines().indexOf(d) % 6 : -1;
const discDot = d => `<i class="ddot dc-${discIdx(d)}"></i>`;
function renderDisc(body) {
  const v = disciplineView();
  if (!v.list.length) {
    body.innerHTML = `<div class="nempty"><h3>${esc(L('disc.emptyTitle'))}</h3><p>${esc(L('disc.emptyText'))}</p><pre>${esc(L('disc.emptyCode'))}</pre><p>${esc(L('disc.emptyHint'))}</p></div>`;
    return;
  }
  const grp = g => `<div class="dcol"><header>${g.d ? discDot(g.d) : '<i class="ddot"></i>'}<b>${esc(g.d ? g.d.name : L('disc.none'))}</b><span class="muted">${g.els.length}</span></header>
    <div class="dlist">${g.els.map(elBtn).join('') || `<span class="muted">–</span>`}</div>
    ${g.reqs.length ? `<div class="dreq"><span class="muted">${esc(L('disc.satisfies'))}</span>${g.reqs.map(elBtn).join('')}</div>` : ''}</div>`;
  const side = (u, d, p) => `<span class="dside">${discDot(d)}${elBtn(u)}${p && p !== u ? `<span class="muted mono">.${esc(p.name || '')}</span>` : ''}</span>`;
  body.innerHTML = `<p class="muted chk-intro">${esc(L('disc.lead'))}</p>
    <div class="cov-ctl"><label><input type="checkbox" id="discColor"${S.discColor ? ' checked' : ''}> ${esc(L('disc.color'))}</label>
      <span class="dleg">${v.list.map(d => `<span>${discDot(d)}${esc(d.name)}</span>`).join('')}</span></div>
    <div class="dgrid">${v.groups.filter(g => g.d || g.els.length).map(grp).join('')}</div>
    <h3 class="sh">${esc(L('disc.crossTitle'))}</h3>
    <p class="muted chk-intro">${esc(L('disc.crossLead'))}</p>
    ${v.cross.length ? `<ul class="dx">${v.cross.map(c => `<li>${side(c.ua, c.da, c.pa)}<span class="dvia">${esc(c.type)}${c.label ? ' · ' + esc(c.label) : ''} ${c.type === 'flow' ? '→' : '↔'}</span>${side(c.ub, c.db, c.pb)}${locBtn(c.file, c.line)}</li>`).join('')}</ul>` : `<p class="muted">${esc(L('disc.noCross'))}</p>`}
    <h3 class="sh">${esc(L('disc.allocTitle'))}</h3>
    ${v.alloc.length ? `<ul class="dx">${v.alloc.map(a => `<li>${side(a.a, a.da)}<span class="dvia">${esc(L('disc.runsOn.' + a.type))}</span>${side(a.b, a.db)}${locBtn(a.file, a.line)}</li>`).join('')}</ul>` : `<p class="muted">${esc(L('disc.noAlloc'))}</p>`}`;
  $('discColor').onchange = e => { S.discColor = e.target.checked; store.set('disccolor', S.discColor ? '1' : '0'); toast(L(S.discColor ? 'disc.colorOn' : 'disc.colorOff')); };
}

/* ---------- Baseline-Vergleich ---------- */
S.base = null; S.diffMark = store.get('diffmark') !== '0';
if (!VSC) try { const b = JSON.parse(store.get('base') || 'null'); if (b && Array.isArray(b.files)) S.base = b; } catch (e) {}
let baseCache = null, diffCache = null;
function setBaseline(files, name) {
  S.base = { name, files: files.map(f => ({ name: f.name, text: f.text })), at: new Date().toISOString() }; baseCache = diffCache = null;
  if (!VSC) store.set('base', JSON.stringify(S.base));
  NAV.tab = 'diff'; saveHist(); if (S.mode !== 'nav') setMode('nav'); else renderNav();
  toast(Ln('diff.loaded', files.length, { name }));
}
function clearBaseline() { S.base = null; baseCache = diffCache = null; if (!VSC) store.set('base', ''); renderNav(); }
// Baseline einlesen, Momentaufnahme ziehen, danach den aktuellen Stand wiederherstellen
function baseSnap() {
  if (baseCache && baseCache.lang === LANG && baseCache.base === S.base) return baseCache.snap;
  const r = parseFiles(S.base.files); buildIndex(r.root, S.pick); buildTrace();
  const snap = snapshot(r.warns);
  buildIndex(parseRes.root, S.pick); buildTrace();
  baseCache = { lang: LANG, base: S.base, snap }; return snap;
}
function getDiff() {
  if (!S.base || !IDXok) return null;
  if (diffCache && diffCache.res === parseRes && diffCache.lang === LANG && diffCache.base === S.base) return diffCache;
  const bs = baseSnap(); const d = diffSnapshots(bs, snapshot(parseRes.warns));
  diffCache = { res: parseRes, lang: LANG, base: S.base, d, imp: diffImpact(d, 3) };
  return diffCache;
}
const byKeyNow = k => IDX.all.find(e => elKey(e) === k);
const statusPill = s => s ? `<span class="pill p-${s}">${STATUS[s][0]}</span>` : `<span class="muted">–</span>`;
function renderDiff(body) {
  if (!S.base) {
    body.innerHTML = `<div class="nempty"><h3>${esc(L('diff.emptyTitle'))}</h3><p>${esc(L('diff.emptyText'))}</p>
      <div class="dbtns">
        <button type="button" class="btn primary" data-base="now">${esc(L('diff.b.now'))}</button>
        ${VSC ? `<button type="button" class="btn" data-base="git">${esc(L('diff.b.git'))}</button>` : `<button type="button" class="btn" data-base="dir">${esc(L('diff.b.dir'))}</button><button type="button" class="btn" data-base="files">${esc(L('diff.b.files'))}</button>`}
      </div><p>${esc(L(VSC ? 'diff.tipVsc' : 'diff.tip'))}</p></div>`;
    return;
  }
  const D = getDiff(); const { d, imp } = D;
  const n = d.added.length + d.removed.length + d.changed.length;
  const when = (() => { try { return new Date(S.base.at).toLocaleString(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return ''; } })();
  const fld = c => c.fields.map(f => `<li><span class="muted">${esc(L('diff.f.' + f.f))}:</span> <del>${esc(f.old || '–')}</del> → <ins>${esc(f.now || '–')}</ins></li>`).join('')
    + c.edAdd.map(x => `<li><ins>+ ${esc(edgeText(x))}</ins></li>`).join('') + c.edDel.map(x => `<li><del>− ${esc(edgeText(x))}</del></li>`).join('');
  const item = (c, kind) => { const el = kind === 'del' ? null : byKeyNow(c.key);
    return `<li class="dfi df-${kind}"><span class="pill dp-${kind}">${esc(L('diff.k.' + kind))}</span>${el ? elBtn(el) : `<b>${esc(c.name)}</b> <span class="muted">${esc(c.isDef ? c.kind + ' def' : c.kind)}</span>`}<span class="muted mono">${esc(c.qn || '')}</span>${kind !== 'del' ? locBtn(c.file, c.line) : ''}${kind === 'chg' ? `<ul class="dff">${fld(c)}</ul>` : ''}</li>`; };
  const reason = r => `<li>${elBtn(r.el)}<span class="muted">${esc(r.reason)}</span></li>`;
  body.innerHTML = `
    <div class="dhead"><span>${esc(L('diff.against', { name: S.base.name }))}<span class="muted"> · ${esc(Ln('ui.stat.files', S.base.files.length))}${when ? ' · ' + esc(when) : ''}</span></span>
      <span class="dbtns"><button type="button" class="btn" data-base="now">${esc(L('diff.b.renew'))}</button>${VSC ? `<button type="button" class="btn" data-base="git">${esc(L('diff.b.git'))}</button>` : ''}<button type="button" class="btn" data-base="clear">${esc(L('diff.b.clear'))}</button></span></div>
    <div class="cov-sum">
      <div class="tile"><b class="c-add">${d.added.length}</b><span>${esc(L('diff.t.added'))}</span></div>
      <div class="tile"><b class="c-del">${d.removed.length}</b><span>${esc(L('diff.t.removed'))}</span></div>
      <div class="tile"><b class="c-chg">${d.changed.length}</b><span>${esc(L('diff.t.changed'))}</span></div>
      <div class="tile ${imp.reqs.length ? 'warn' : ''}"><b>${imp.reqs.length}</b><span>${esc(L('diff.t.reprove'))}</span></div>
      <div class="tile ${imp.tests.length ? 'warn' : ''}"><b>${imp.tests.length}</b><span>${esc(L('diff.t.retest'))}</span></div>
    </div>
    ${!n ? `<div class="nempty"><h3>${esc(L('diff.sameTitle'))}</h3><p>${esc(L(VSC ? 'diff.sameTextVsc' : 'diff.sameText'))}</p></div>` : `
    <div class="cov-ctl"><label><input type="checkbox" id="diffMark"${S.diffMark ? ' checked' : ''}> ${esc(L('diff.mark'))}</label></div>
    <h3 class="sh">${esc(L('diff.s.changes'))}</h3>
    <ul class="dfl">${d.changed.map(c => item(c, 'chg')).join('')}${d.added.map(c => item(c, 'add')).join('')}${d.removed.map(c => item(c, 'del')).join('')}</ul>
    <h3 class="sh">${esc(L('diff.s.effects'))}</h3>
    <p class="muted chk-intro">${esc(L('diff.effectsLead'))}</p>
    <div class="dgrid two"><div class="dcol"><header><b>${esc(L('diff.t.reprove'))}</b><span class="muted">${imp.reqs.length}</span></header><ul class="dfr">${imp.reqs.map(reason).join('') || `<li class="muted">${esc(L('diff.none'))}</li>`}</ul></div>
      <div class="dcol"><header><b>${esc(L('diff.t.retest'))}</b><span class="muted">${imp.tests.length}</span></header><ul class="dfr">${imp.tests.map(reason).join('') || `<li class="muted">${esc(L('diff.none'))}</li>`}</ul></div></div>
    ${d.covChg.length ? `<h3 class="sh">${esc(L('diff.s.cov'))}</h3><div class="tblwrap"><table class="cov"><thead><tr><th>ID</th><th>${esc(L('cov.col.req'))}</th><th>${esc(L('diff.before'))}</th><th>${esc(L('diff.after'))}</th></tr></thead><tbody>
      ${d.covChg.map(c => { const el = byKeyNow(c.key); return `<tr><td class="mono">${esc(c.id || '')}</td><td>${el ? elBtn(el) : esc(c.name)}</td><td>${statusPill(c.old)}</td><td>${statusPill(c.now)}</td></tr>`; }).join('')}</tbody></table></div>` : ''}
    ${d.newChecks.length || d.fixedChecks.length ? `<h3 class="sh">${esc(L('nav.tab.check'))}</h3><ul class="dfl">
      ${d.newChecks.map(c => `<li class="dfi"><span class="pill sv-${c.sev}">${esc(L('diff.k.newIssue'))}</span><b>${esc(RULES[c.rule].title)}</b><span>${esc(c.msg)}</span></li>`).join('')}
      ${d.fixedChecks.map(c => `<li class="dfi"><span class="pill dp-add">${esc(L('diff.k.fixed'))}</span><b>${esc(RULES[c.rule].title)}</b><span>${esc(c.msg)}</span></li>`).join('')}</ul>` : ''}`}`;
  const m = $('diffMark'); if (m) m.onchange = e => { S.diffMark = e.target.checked; store.set('diffmark', S.diffMark ? '1' : '0'); };
}
function edgeText(x) { const i = x.indexOf(' '); const t = x.slice(0, i), k = x.slice(i + 1); return L('rel.' + t + '.out') + ' ' + keyName(k); }
function getLocale() { return (I18N[LANG] && I18N[LANG]._locale) || LANG; }
function pickBaseFiles(dir) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.hidden = true;
  if (dir) { inp.webkitdirectory = true; inp.setAttribute('directory', ''); } else inp.accept = '.sysml,.kerml';
  inp.onchange = async () => { const files = await filesFromList([...inp.files]); inp.remove(); if (!files.length) { toast(L('ui.noModelFiles')); return; } const root = stripRoot(files); setBaseline(files, root || (files.length === 1 ? files[0].name : L('diff.selection'))); };
  document.body.appendChild(inp); inp.click();
}
async function pickBaseDir() {
  if (!canPickDir) return pickBaseFiles(true);
  try { const h = await window.showDirectoryPicker({ mode: 'read' }); const files = await filesFromList(await readDirHandle(h, '', [])); if (!files.length) { toast(L('ui.noModelFiles')); return; } setBaseline(files, h.name); }
  catch (e) { if (!e || e.name !== 'AbortError') pickBaseFiles(true); }
}
$('nbody').addEventListener('click', e => {
  const b = e.target.closest('[data-base]'); if (!b) return;
  const a = b.dataset.base;
  if (a === 'now') setBaseline(S.files, L('diff.savedState'));
  if (a === 'dir') pickBaseDir();
  if (a === 'files') pickBaseFiles(false);
  if (a === 'git' && VSC) { VSC.postMessage({ type: 'baseline', ref: 'HEAD' }); toast(L('diff.gitLoading')); }
  if (a === 'clear') clearBaseline();
});

/* ---------- Markierungen in Diagrammen: Disziplin und Änderungen ---------- */
function markExtras(vp) {
  if (!vp || !IDXok) return;
  vp.querySelectorAll('.dc, .df-add, .df-chg').forEach(n => n.classList.remove('dc', 'dc-0', 'dc-1', 'dc-2', 'dc-3', 'dc-4', 'dc-5', 'df-add', 'df-chg'));
  if (S.discColor) vp.querySelectorAll('g.nd[data-eid]').forEach(n => { const el = elByEid(n.dataset.eid); const d = el && disciplineOf(el); if (d) n.classList.add('dc', 'dc-' + discIdx(d)); });
  const D = S.diffMark && S.base ? getDiff() : null;
  if (D) {
    const add = new Set(D.d.added.map(c => c.key)), chg = new Set(D.d.changed.map(c => c.key));
    // Änderungen an Zeilen im Kasten (Attribute, Ports …) markieren den Kasten, der sie enthält
    for (const c of [...D.d.added, ...D.d.changed]) { const el = byKeyNow(c.key); for (let q = el && el.parent; q && q.kind !== 'root' && q.kind !== 'package'; q = q.parent) { const k = elKey(q); if (!add.has(k)) chg.add(k); if (stageOf(q)) break; } }
    vp.querySelectorAll('g.nd[data-eid], g.port[data-eid]').forEach(n => { const el = elByEid(n.dataset.eid); if (!el) return; const k = elKey(el); if (add.has(k)) n.classList.add('df-add'); else if (chg.has(k)) n.classList.add('df-chg'); });
  }
}

/* ---------- Geführte Tour ---------- */
const TOUR = { on: false, i: 0, steps: [], hl: null };
function buildTour() {
  if (!IDXok) return [];
  const P = tourPlan(); const st = [];
  const edgeLine = (t, a, b) => TR.edges.find(e => e.type === t && e.a === a && e.b === b);
  const code = (el) => el ? srcLine(el.file, el.line) : '';
  const nav = (tab) => () => { if (S.mode !== 'nav') setMode('nav'); NAV.tab = tab; saveHist(); renderNav(); $('nbody').scrollTop = 0; };
  st.push({ k: 'welcome', p: { stages: STAGES.map(s => s.label).join(' → ') }, run: nav('start'), target: '.modebar .seg' });
  if (P.req) {
    const d = defOf(P.req); const txt = P.req.doc || (d && d.doc) || '';
    st.push({ k: 'req', p: { req: nmOf(P.req), text: txt }, code: code(P.req), run: () => navGo(P.req, 'trace'), target: '#focusBar' });
  }
  if (P.impl) { const e = edgeLine('satisfy', P.impl, P.req); st.push({ k: 'impl', p: { impl: nmOf(P.impl), req: nmOf(P.req) }, code: e ? srcLine(e.file, e.line) : '', run: () => navGo(P.impl, 'trace'), target: '#brief' }); }
  if (P.impl && ibdCandidates().length) st.push({ k: 'iface', p: { impl: nmOf(P.impl), port: P.port ? P.port.name : '' }, code: code(P.port), run: () => { setFocus(P.impl); showInDiagram(P.impl); }, target: '#stage' });
  if (P.behav) st.push({ k: P.behav.kind === 'state' ? 'state' : 'action', p: { behav: nmOf(P.behav), impl: nmOf(P.impl) }, code: code(P.behav), run: () => { setFocus(P.behav); showInDiagram(P.behav); }, target: '#stage' });
  if (P.test) { const e = edgeLine('verify', P.test, P.req); st.push({ k: 'test', p: { test: nmOf(P.test), req: nmOf(P.req) }, code: e ? srcLine(e.file, e.line) : '', run: () => navGo(P.test, 'trace'), target: '#brief' }); }
  if (P.req) st.push({ k: 'cover', p: { gap: P.gap ? nmOf(P.gap) : '' }, k2: P.gap ? 'cover' : 'coverOk', run: () => { NAV.gaps = false; nav('cover')(); }, target: '#nbody .tblwrap' });
  if (P.impl) st.push({ k: 'impact', p: { impl: nmOf(P.impl) }, run: () => navGo(P.impl, 'impact'), target: '#nbody' });
  st.push({ k: 'check', p: {}, run: nav('check'), target: '#ntabs' });
  if (disciplines().length) st.push({ k: 'disc', p: { list: Lj(disciplines().map(d => d.name)) }, run: nav('disc'), target: '#nbody' });
  st.push({ k: 'diff', p: {}, run: nav('diff'), target: '#nbody' });
  st.push({ k: 'end', p: {}, run: nav('start'), target: '#nbody' });
  return st;
}
function tourPanel() {
  let t = $('tour'); if (t) return t;
  t = document.createElement('div'); t.id = 'tour'; t.className = 'tour'; t.hidden = true; t.setAttribute('role', 'dialog'); t.setAttribute('aria-live', 'polite');
  document.body.appendChild(t);
  t.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; const a = b.dataset.t; if (a === 'next') tourGo(TOUR.i + 1); if (a === 'prev') tourGo(TOUR.i - 1); if (a === 'end') endTour(); });
  return t;
}
function startTour() { TOUR.steps = buildTour(); TOUR.on = true; tourGo(0); }
function endTour() { TOUR.on = false; const t = $('tour'); if (t) t.hidden = true; if (TOUR.hl) TOUR.hl.classList.remove('tour-hl'); TOUR.hl = null; }
function tourGo(i) {
  if (i < 0) return; if (i >= TOUR.steps.length) { endTour(); toast(L('tour.done')); return; }
  TOUR.i = i; const s = TOUR.steps[i];
  try { s.run(); } catch (e) { console.error(e); }
  const t = tourPanel(); const key = 'tour.' + (s.k2 || s.k);
  t.innerHTML = `<div class="th"><span class="muted">${esc(L('tour.step', { i: i + 1, n: TOUR.steps.length }))}</span><button type="button" class="tx" data-t="end" aria-label="${esc(L('tour.end'))}" title="${esc(L('tour.end'))}">×</button></div>
    <b>${esc(L(key + '.t', s.p))}</b><p>${esc(L(key + '.x', s.p))}</p>${s.code ? `<code>${esc(s.code)}</code>` : ''}
    <div class="tb"><button type="button" class="btn" data-t="prev"${i ? '' : ' disabled'}>${esc(L('tour.prev'))}</button><span class="tdots">${TOUR.steps.map((x, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</span><button type="button" class="btn primary" data-t="next">${esc(L(i === TOUR.steps.length - 1 ? 'tour.finish' : 'tour.next'))}</button></div>`;
  t.hidden = false;
  if (TOUR.hl) TOUR.hl.classList.remove('tour-hl'); TOUR.hl = null;
  const mark = () => { if (!TOUR.on || TOUR.i !== i) return; let n = document.querySelector(s.target); if (!n || !n.getClientRects().length) n = $('focusBar'); if (!n) return; if (TOUR.hl && TOUR.hl !== n) TOUR.hl.classList.remove('tour-hl'); n.classList.add('tour-hl'); TOUR.hl = n; n.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
  requestAnimationFrame(mark); setTimeout(mark, 600);
  t.querySelector('[data-t="next"]').focus({ preventScroll: true });
}
document.addEventListener('keydown', e => {
  if (!TOUR.on || e.target.closest('textarea, input, select')) return;
  if (e.key === 'ArrowRight') tourGo(TOUR.i + 1); else if (e.key === 'ArrowLeft') tourGo(TOUR.i - 1); else if (e.key === 'Escape') endTour();
});
