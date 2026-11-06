
/* ================= Lernhilfen: gemeinsamer Fokus, Steckbrief, Modell-Check, Notation ================= */

/* ---------- Gemeinsamer Fokus ---------- */
// Der Fokus ist der aktuelle Eintrag im Weg (NAV.hist). Navigator, Diagramme, Detail und Modellbaum teilen ihn.
function setFocus(el, o) {
  if (!el) return; o = o || {};
  const k = keyOf(el);
  if (NAV.hist[NAV.idx] !== k) { NAV.hist = NAV.hist.slice(0, NAV.idx + 1); NAV.hist.push(k); if (NAV.hist.length > 40) NAV.hist.shift(); NAV.idx = NAV.hist.length - 1; }
  if (o.here) S.ctxFocus[S.view] = k; // Element ist im aktuellen Diagramm schon sichtbar: Kontext nicht wechseln
  saveHist(); renderFocusBar();
  if (S.mode === 'nav') renderNav(); else markFocus($('vp'));
  if (VSC && S.follow && !S.revealing && el.file) VSC.postMessage({ type: 'goto', file: el.file, line: el.line, preserveFocus: true });
}
S.ctxFocus = {};
function focusFamily(F) {
  if (!F) return { self: [], rel: [] };
  const rel = new Set([...trOut(F, 'typed'), ...trIn(F, 'typed')]);
  if (F.kind === 'port' && F.parent) rel.add(F.parent);
  return { self: [F], rel: [...rel].filter(x => x !== F) };
}
function markFocus(vp) {
  if (!vp) return;
  vp.querySelectorAll('.sel, .rel').forEach(n => n.classList.remove('sel', 'rel'));
  markExtras(vp);
  const F = navFocus(); if (!F) return;
  const fam = focusFamily(F);
  for (const e of fam.rel) vp.querySelectorAll(`[data-eid="${e.eid}"]`).forEach(n => n.classList.add('rel'));
  for (const e of fam.self) vp.querySelectorAll(`[data-eid="${e.eid}"]`).forEach(n => n.classList.add('sel'));
}
function inIBD(c, F, d) {
  d = d || 0; if (d > 3 || !c) return false;
  const ps = partsOf(c);
  if (ps.includes(F) || portsOf(c).includes(F) || c.children.includes(F)) return true;
  if (F.isDef && ps.some(p => p.types[0] && resolveDef(p.types[0], p) === F)) return true;
  return ps.some(p => inIBD(p, F, d + 1));
}
function ctxFor(view, F, cands) {
  const has = el => el && cands.find(c => c.el === el);
  const def = !F.isDef && F.types[0] ? resolveDef(F.types[0], F) : null;
  const up = list => { for (let e = F; e; e = e.parent) { const c = has(e); if (c) return c; } return null; };
  let c = null;
  if (view === 'ibd') c = cands.find(x => x.el && x.el !== F && inIBD(x.el, F)) || has(F) || has(def);
  if (view === 'states' || view === 'actions') c = up() || has(def) || cands.find(x => x.el && F.isDef && trIn(F, 'typed').some(u => u.parent === x.el));
  if (view === 'reqs') { const p = nearestPkg(F); c = (p && has(p)) || cands[0]; }
  if (view === 'struct') {
    const cur = cands.find(x => x.key === S.ctx.struct);
    const inside = cur && (cur.key === '' || (cur.file ? cur.file === F.file : cur.el && within(cur.el).includes(F)));
    c = inside ? cur : cands[0];
  }
  return c ? c.key : null;
}
function bestView(F) {
  const st = stageOf(F);
  if (F.kind === 'state') return 'states';
  if (F.kind === 'action') return 'actions';
  if (st === 'req') return 'reqs';
  if (st === 'iface' && !F.isDef) return ibdCandidates().some(c => inIBD(c, F) || c === F.parent) ? 'ibd' : 'struct';
  if (st === 'struct') { const ib = ibdCandidates(); if (ib.some(c => c !== F && inIBD(c, F)) || ib.includes(F)) return 'ibd'; }
  return 'struct';
}
function showInDiagram(F) {
  const v = bestView(F);
  if (v === 'struct' && ['port', 'item', 'interface', 'connection', 'flow'].includes(F.kind)) { S.opts.ports = true; store.set('opts', JSON.stringify(S.opts)); }
  S.view = v; store.set('view', v); delete S.ctxFocus[v];
  closeDetail(); if (S.mode !== 'diag') setMode('diag'); else { renderTabs(); update(true); }
  renderTabs();
}

/* ---------- Fokusleiste & Steckbrief ---------- */
let briefOpen = store.get('brief') !== '0';
const ROW_TIP = { inherits: 'r-spec', specializedBy: 'r-spec', consistsOf: 'r-owns', partOf: 'r-owns', contains: 'r-owns', usedIn: 'r-typed', usedBy: 'r-typed', ports: 'r-port', connected: 'r-connect', connects: 'r-connect', ends: 'r-connect', behaviour: 'r-perform', performedBy: 'r-perform', exhibitedBy: 'r-perform', runsHere: 'r-allocate', allocatedTo: 'r-allocate', satisfies: 'r-satisfy', implementedBy: 'r-satisfy', affectsImpl: 'r-satisfy', testedBy: 'r-verify', verifiedBy: 'r-verify', verifies: 'r-verify', subject: 'r-subject', unitUnderTest: 'r-subject', derivedFrom: 'r-derive', derivedTo: 'r-derive', refinement: 'r-refine' };
function segHTML(v) {
  return v.map(x => {
    if (typeof x === 'string') return esc(x);
    if (x.el) return `<button type="button" class="blink s-${stageOf(x.el) || 'x'}" data-eid="${x.el.eid}" data-tip-el="1">${esc(dispName(x.el))}</button>`;
    if (x.go) return ` <button type="button" class="bact" data-go="${x.go}">${esc(x.label)}</button>`;
    if (x.src) return `<button type="button" class="bact" data-src="1">${esc(x.label)}</button>`;
    return '';
  }).join('');
}
function briefHTML(el) {
  let d; try { d = describe(el, NAV.depth); } catch (e) { console.error(e); return ''; }
  return `<p class="blead">${segHTML(d.lead)}</p><dl class="brows">${d.rows.map(r => `<div class="${r.gap ? 'bgap' : ''}"><dt${ROW_TIP[r.id] ? ` data-tip="${ROW_TIP[r.id]}"` : ''}>${esc(r.k)}</dt><dd>${segHTML(r.v)}</dd></div>`).join('')}</dl>`;
}
function renderFocusBar() {
  const bar = $('focusBar'), brief = $('brief');
  const F = IDXok ? navFocus() : null;
  if (!F) {
    bar.innerHTML = `<span class="fb-empty">${esc(L('focus.none'))}</span>`;
    brief.hidden = true; return;
  }
  const st = stageOf(F);
  bar.innerHTML = `<span class="fb-lab">${esc(L('focus.label'))}</span>
    <span class="fb-el s-${st || 'x'}"><span class="fb-k" data-tip-kind="${esc(kindLabel(F))}">${esc(kindLabel(F) || F.kind)}</span><b>${esc(dispName(F))}</b></span>
    <span class="fb-acts">
      <button type="button" class="fbb" data-fb="brief" aria-expanded="${briefOpen}">${esc(L(briefOpen ? 'focus.briefHide' : 'focus.brief'))}</button>
      ${st ? `<button type="button" class="fbb${S.mode === 'nav' && NAV.tab === 'trace' ? ' on' : ''}" data-fb="trace">${esc(L('nav.tab.trace'))}</button><button type="button" class="fbb${S.mode === 'nav' && NAV.tab === 'impact' ? ' on' : ''}" data-fb="impact">${esc(L('nav.tab.impact'))}</button>` : ''}
      <button type="button" class="fbb${S.mode === 'diag' ? ' on' : ''}" data-fb="diag">${esc(L('focus.inDiagram'))}</button>
      ${isOpenable(F) ? `<button type="button" class="fbb" data-fb="detail">${esc(L('focus.detail'))}</button>` : ''}
      <button type="button" class="fbb" data-fb="src">${esc(L('ui.tab.code'))}</button>
    </span>`;
  brief.hidden = !briefOpen;
  if (briefOpen) brief.innerHTML = briefHTML(F);
}
$('focusBar').addEventListener('click', e => {
  const b = e.target.closest('[data-fb]'); if (!b) return; const F = navFocus(); if (!F) return;
  const a = b.dataset.fb;
  if (a === 'brief') { briefOpen = !briefOpen; store.set('brief', briefOpen ? '1' : '0'); renderFocusBar(); requestAnimationFrame(() => { if (S.mode === 'nav') drawLines(linePairs); else MV.fit(); }); }
  if (a === 'trace' || a === 'impact') navGo(F, a);
  if (a === 'diag') showInDiagram(F);
  if (a === 'detail') openDetail(F, true);
  if (a === 'src') gotoLine(F.file, F.line);
});
function briefClick(e, onEl) {
  const t = e.target.closest('.blink, .bact'); if (!t) return false;
  const F = navFocus();
  if (t.dataset.eid) { const el = elByEid(t.dataset.eid); if (el) onEl(el); }
  else if (t.dataset.go === 'impact' && F) navGo(F, 'impact');
  else if (t.dataset.src && F) gotoLine(F.file, F.line);
  return true;
}
$('brief').addEventListener('click', e => briefClick(e, el => { if (S.mode === 'nav') navGo(el); else setFocus(el); }));

/* ---------- Modell-Check ---------- */
const SEV = Object.fromEntries(['error', 'gap', 'hint'].map(k => [k, { get 0() { return L('sev.' + k); }, get 1() { return L('sev.' + k + '.hint'); } }]));
let checkCache = null;
function currentChecks() { if (!checkCache) checkCache = modelChecks(parseRes ? parseRes.warns : []); return checkCache; }
function renderCheck(body) {
  const items = currentChecks();
  const cnt = s => items.filter(i => i.sev === s).length;
  if (!items.length) { body.innerHTML = `<div class="nempty"><h3>${esc(L('check.cleanTitle'))}</h3><p>${esc(L('check.cleanText'))}</p></div>`; return; }
  const groups = Object.keys(RULES).map(r => ({ r, list: items.filter(i => i.rule === r) })).filter(g => g.list.length);
  body.innerHTML = `<div class="cov-sum">
      ${['error', 'gap', 'hint'].map(s => `<div class="tile sev-${s}" data-tip-sev="${s}"><b>${cnt(s)}</b><span>${esc(Ln('sev.count.' + s, cnt(s)))}</span></div>`).join('')}
    </div>
    <p class="muted chk-intro">${esc(L('check.intro'))}</p>
    ${groups.map(g => `<details class="chk" open>
      <summary><span class="pill sv-${RULES[g.r].sev}">${SEV[RULES[g.r].sev][0]}</span><b>${esc(RULES[g.r].title)}</b><span class="muted">${g.list.length}</span></summary>
      <p class="why">${esc(RULES[g.r].why)}</p>
      <ul>${g.list.map(i => `<li>
        <div class="chk-l">${i.el && stageOf(i.el) ? `<button type="button" class="blink s-${stageOf(i.el)}" data-eid="${i.el.eid}">${esc(dispName(i.el))}</button>` : ''}<span>${esc(i.msg)}</span>${i.line ? `<button type="button" class="bact" data-file="${esc(i.file || '')}" data-line="${i.line}">${esc(locText({ file: S.files.length > 1 ? i.file : null, line: i.line }))}</button>` : ''}${i.ambig ? `<button type="button" class="bact" data-ambig="${esc(i.ambig)}">${esc(L('check.pick'))}</button>` : ''}</div>
        <div class="chk-fix"><code>${esc(i.fix)}</code><button type="button" class="cp-btn" data-copy="${esc(i.fix)}" title="${esc(L('check.copyTitle'))}">${esc(L('check.copy'))}</button></div>
      </li>`).join('')}</ul>
    </details>`).join('')}`;
}
$('nbody').addEventListener('click', e => {
  const c = e.target.closest('[data-copy]');
  if (c) { e.stopPropagation(); const t = c.dataset.copy; try { navigator.clipboard.writeText(t).then(() => toast(L('check.copied')), () => toast(t)); } catch (x) { toast(t); } return; }
  const l = e.target.closest('.bact[data-line]'); if (l) { e.stopPropagation(); gotoLine(l.dataset.file || null, +l.dataset.line); return; }
  const a = e.target.closest('[data-ambig]'); if (a) { e.stopPropagation(); openAmbig(a.dataset.ambig); return; }
}, true);

/* ---------- Notation erklären ---------- */
// Code-Beispiele je Notation stehen in den Sprachdateien (note.<schlüssel>.c), passend zum Beispielprojekt der Sprache
const NOTE_KEYS = new Set(['e-comp', 'e-spec', 'e-typed', 'e-defby', 'e-conn', 'e-iface', 'e-flow', 'e-bind', 'e-trans', 'e-succ', 'e-satisfy', 'e-contain', 'e-inner', 'def', 'usage', 'frame', 'file', 'collapsed', 'inherited', 'redef', 'feature', 'init', 'final', 'decide', 'fork', 'amb', 'port-generic', 'c-attributes', 'c-ports', 'c-parts', 'c-directed features', 'c-ends', 'c-actions', 'c-states', 'c-constraints', 'c-literals', 'r-satisfy', 'r-verify', 'r-derive', 'r-refine', 'r-allocate', 'r-owns', 'r-typed', 'r-spec', 'r-connect', 'r-port', 'r-perform', 'r-subject', 'r-flow']);
const bookRef = k => (BOOK && BOOK.refs && BOOK.refs[k]) || '';
const NOTE = new Proxy({}, { get: (o, k) => typeof k === 'string' && NOTE_KEYS.has(k) ? [L('note.' + k + '.t'), L('note.' + k + '.x'), L('note.' + k + '.c'), bookRef(k)] : undefined });
const kindTip = k => { const t = kindPlain(k); return t ? ['«' + k + '»', t.charAt(0).toUpperCase() + t.slice(1) + '.', '', bookRef(k)] : null; };
function tipFor(t) {
  if (!t || !t.closest) return null;
  const d = t.closest('[data-tip]'); if (d) return NOTE[d.dataset.tip] || null;
  const k = t.closest('[data-tip-kind]'); if (k) return kindTip(k.dataset.tipKind);
  const sv = t.closest('[data-tip-sev]'); if (sv) return [SEV[sv.dataset.tipSev][0], SEV[sv.dataset.tipSev][1], ''];
  const pill = t.closest('.pill'); if (pill) { const m = pill.className.match(/p-(\w+)/); if (m && STATUS[m[1]]) return [L('tip.status', { x: STATUS[m[1]][0] }), STATUS[m[1]][1] + '.', '']; const s2 = pill.className.match(/sv-(\w+)/); if (s2) return [SEV[s2[1]][0], SEV[s2[1]][1], '']; }
  const ck = t.closest('.card .ck > span:first-child'); if (ck) return kindTip(ck.textContent.trim());
  if (!t.closest('.dg')) return null;
  if (t.closest('.ambm')) return NOTE.amb;
  const port = t.closest('g.port');
  if (port) { const el = elByEid(port.dataset.eid); if (!el) return NOTE['port-generic']; const dir = portDir(el); return ['Port ' + el.name + (el.types[0] ? ' : ' + el.types[0] : ''), (dir ? L('tip.portDir', { d: DIR_PLAIN[dir] }) : L('tip.portDirOpen')) + ' ' + (el.types[0] && el.types[0].startsWith('~') ? L('tip.portConj') + ' ' : '') + L('tip.portTriangle'), 'port ' + el.name + (el.types[0] ? ' : ' + el.types[0] : '') + ';', bookRef('port-generic')]; }
  const cls = (t.getAttribute && t.getAttribute('class')) || '';
  let m = cls.match(/\be-(\w+)/) || cls.match(/\bel-(\w+)/); if (m && NOTE['e-' + m[1]]) return NOTE['e-' + m[1]];
  if (/\bst\b/.test(cls)) { const kw = t.textContent.replace(/[«»]/g, '').trim(); return kindTip(kw) || (kw === L('struct.fileStereo') ? NOTE.file : null); }
  if (/\bct\b/.test(cls) && !/\bdc\b/.test(cls)) return NOTE['c-' + t.textContent.trim()] || null;
  if (/\bln\b/.test(cls)) { const s = t.textContent.trim(); return s.startsWith('^') ? NOTE.inherited : s.includes(':>>') ? NOTE.redef : NOTE.feature; }
  const nd = t.closest('g.nd'); if (!nd) return null;
  if (nd.dataset.pseudo === 'init') return NOTE.init;
  if (nd.dataset.pseudo === 'final') return NOTE.final;
  if (nd.dataset.shape === 'diamond') return NOTE.decide;
  if (nd.dataset.shape === 'bar') return NOTE.fork;
  if (nd.classList.contains('k-file')) return NOTE.file;
  if (nd.classList.contains('collapsed')) return NOTE.collapsed;
  if (/\bnm\b/.test(cls) || /\bnb\b/.test(cls)) { if (/\bframe\b/.test(cls)) return NOTE.frame; return nd.dataset.usage ? NOTE.usage : NOTE.def; }
  return null;
}
let tipsOn = store.get('tips') !== '0', tipTimer = null, tipTarget = null;
$('tipsOn').checked = tipsOn;
$('tipsOn').onchange = e => { tipsOn = e.target.checked; store.set('tips', tipsOn ? '1' : '0'); hideTip(); };
function hideTip() { clearTimeout(tipTimer); tipTarget = null; $('tip').hidden = true; }
function showTip(x, y, n) {
  const tip = $('tip');
  tip.innerHTML = `<b>${esc(n[0])}</b><span>${esc(n[1])}</span>${n[2] ? `<code>${esc(n[2])}</code>` : ''}${n[3] ? `<em class="tref">${esc(L('tip.book', { ref: n[3] }))}</em>` : ''}`;
  tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight, W = window.innerWidth, H = window.innerHeight;
  tip.style.left = Math.max(8, Math.min(x + 14, W - w - 8)) + 'px';
  tip.style.top = (y + 18 + h > H - 8 ? Math.max(8, y - h - 10) : y + 18) + 'px';
}
document.addEventListener('pointerover', e => {
  if (!tipsOn || e.pointerType === 'touch') return;
  const n = tipFor(e.target);
  if (!n) { hideTip(); return; }
  if (tipTarget === e.target) return;
  hideTip(); tipTarget = e.target;
  const x = e.clientX, y = e.clientY;
  tipTimer = setTimeout(() => showTip(x, y, n), 380);
});
document.addEventListener('pointerdown', hideTip, true);
document.addEventListener('wheel', hideTip, { passive: true, capture: true });
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideTip(); });
