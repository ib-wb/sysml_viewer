
/* ================= Navigator: Abdeckung, Rückverfolgung, Auswirkung ================= */
const NAV = { tab: store.get('ntab') || 'cover', hist: [], idx: -1, depth: +(store.get('ndepth') || 2), gaps: false };
try { const h = JSON.parse(store.get('nhist') || 'null'); if (h && Array.isArray(h.hist)) { NAV.hist = h.hist.slice(-30); NAV.idx = Math.min(h.idx, NAV.hist.length - 1); } } catch (e) {}
const NTABS = [['check', 'Modell-Check', 'Fehler, Lücken und Hinweise im Modell'], ['cover', 'Abdeckung', 'Welche Anforderung ist umgesetzt und geprüft?'], ['trace', 'Rückverfolgung', 'Vom Fokus-Element zu allem, was daran hängt'], ['impact', 'Auswirkung', 'Was ist betroffen, wenn sich das Fokus-Element ändert?']];
const STATUS = { ok: ['vollständig', 'umgesetzt und verifiziert'], untested: ['ungeprüft', 'umgesetzt, aber kein Test'], unimpl: ['nicht umgesetzt', 'Test vorhanden, aber kein satisfy'], open: ['offen', 'weder umgesetzt noch geprüft'], group: ['Gruppe', 'fasst Unteranforderungen zusammen'] };
const stIdx = id => STAGES.findIndex(s => s.id === id);

function setMode(m) {
  S.mode = m; store.set('mode', m);
  $('mNav').setAttribute('aria-selected', String(m === 'nav')); $('mDiag').setAttribute('aria-selected', String(m === 'diag'));
  $('navMode').hidden = m !== 'nav'; $('diagMode').hidden = m !== 'diag';
  renderFocusBar();
  if (m === 'diag') { closeDetail(); requestAnimationFrame(() => update(true)); } else renderNav();
}
$('mNav').onclick = () => setMode('nav'); $('mDiag').onclick = () => setMode('diag');

const navFocus = () => NAV.idx >= 0 ? findByKey(NAV.hist[NAV.idx]) : null;
function saveHist() { store.set('nhist', JSON.stringify({ hist: NAV.hist, idx: NAV.idx })); store.set('ntab', NAV.tab); }
function navGo(el, tab) {
  if (!el) return;
  const k = keyOf(el);
  if (NAV.hist[NAV.idx] !== k) { NAV.hist = NAV.hist.slice(0, NAV.idx + 1); NAV.hist.push(k); if (NAV.hist.length > 40) NAV.hist.shift(); NAV.idx = NAV.hist.length - 1; }
  NAV.tab = tab || (NAV.tab === 'cover' || NAV.tab === 'check' ? 'trace' : NAV.tab);
  saveHist(); closeDetail();
  if (S.mode !== 'nav') setMode('nav'); else renderNav();
  $('nbody').scrollTop = 0;
  if (VSC && S.follow && !S.revealing && el.file) VSC.postMessage({ type: 'goto', file: el.file, line: el.line, preserveFocus: true });
}
$('nBack').onclick = () => { if (NAV.idx > 0) { NAV.idx--; if (NAV.tab === 'cover') NAV.tab = 'trace'; saveHist(); renderNav(); } };
$('nFwd').onclick = () => { if (NAV.idx < NAV.hist.length - 1) { NAV.idx++; if (NAV.tab === 'cover') NAV.tab = 'trace'; saveHist(); renderNav(); } };

let qMap = new Map();
function renderSearch() {
  qMap = new Map(); const opts = [];
  for (const el of IDX.all) {
    if (!stageOf(el)) continue;
    const v = `${dispName(el)} — ${kindLabel(el)}${el.short ? ' ' + el.short : ''} · ${el.qn || ''}`;
    if (qMap.has(v)) continue; qMap.set(v, el); opts.push(`<option value="${esc(v)}"></option>`);
  }
  $('nqList').innerHTML = opts.join('');
}
$('nq').addEventListener('input', e => { const el = qMap.get(e.target.value); if (el) { e.target.value = ''; e.target.blur(); navGo(el); } });
$('nq').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return; const v = e.target.value.trim().toLowerCase(); if (!v) return;
  const hit = [...qMap.entries()].find(([k]) => k.toLowerCase().includes(v));
  if (hit) { e.target.value = ''; navGo(hit[1]); } else toast('Kein passendes Element gefunden');
});

function renderNav() {
  if (!IDXok) return;
  renderFocusBar();
  if (S.mode !== 'nav') return;
  const t = $('ntabs'); t.innerHTML = '';
  for (const [k, l, hint] of NTABS) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'vtab'; b.setAttribute('role', 'tab'); b.title = hint;
    b.setAttribute('aria-selected', String(NAV.tab === k)); b.textContent = l;
    if (k === 'check') { const n = currentChecks().filter(i => i.sev !== 'hint').length; if (n) { const sp = document.createElement('span'); sp.className = 'n bad'; sp.textContent = n; b.appendChild(sp); } }
    b.onclick = () => { NAV.tab = k; saveHist(); renderNav(); }; t.appendChild(b);
  }
  $('nBack').disabled = NAV.idx <= 0; $('nFwd').disabled = NAV.idx >= NAV.hist.length - 1;
  renderTrail(); renderSearch();
  const body = $('nbody');
  if (NAV.tab === 'check') renderCheck(body);
  else if (NAV.tab === 'cover') renderCover(body);
  else if (NAV.tab === 'trace') renderTraceTab(body);
  else renderImpactTab(body);
}
function renderTrail() {
  const tr = $('trail'); tr.innerHTML = '';
  const lab = document.createElement('span'); lab.className = 'tl'; lab.textContent = 'Dein Weg:'; tr.appendChild(lab);
  if (!NAV.hist.length) { const s = document.createElement('span'); s.className = 'tn'; s.textContent = 'noch leer – klicke in der Abdeckung eine Anforderung an'; tr.appendChild(s); return; }
  const start = Math.max(0, NAV.hist.length - 9);
  if (start > 0) { const s = document.createElement('span'); s.className = 'tn'; s.textContent = '…'; tr.appendChild(s); }
  NAV.hist.slice(start).forEach((k, j) => {
    const i = start + j; const el = findByKey(k);
    if (j) { const s = document.createElement('span'); s.className = 'sep'; s.textContent = '›'; tr.appendChild(s); }
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tc s-' + (el ? stageOf(el) : 'x') + (i === NAV.idx ? ' cur' : '');
    b.textContent = el ? (el.name && !el.anon ? el.name : dispName(el)) : '(entfernt)'; b.disabled = !el;
    b.title = el ? kindLabel(el) + ' ' + (el.qn || '') : '';
    b.onclick = () => { NAV.idx = i; if (NAV.tab === 'cover') NAV.tab = 'trace'; saveHist(); renderNav(); };
    tr.appendChild(b);
  });
}

/* ---------- Abdeckung ---------- */
function renderCover(body) {
  const rows = coverage();
  if (!rows.length) {
    body.innerHTML = `<div class="nempty"><h3>Noch keine Anforderungen im Modell</h3><p>Die Abdeckung zeigt, welche Anforderung von welcher Komponente erfüllt und von welchem Test verifiziert wird. Dafür braucht das Modell drei Dinge:</p>
<pre>requirement def &lt;'A1'&gt; Laufzeit { doc /* mindestens 2 h */ }
satisfy laufzeit by roboter.akku;
verification def LaufzeitTest { objective { verify laufzeit; } }</pre></div>`;
    return;
  }
  const real = rows.filter(r => r.status !== 'group');
  const n = real.length, nSat = real.filter(r => r.sat.length).length, nVer = real.filter(r => r.ver.length).length, nOk = real.filter(r => r.status === 'ok').length;
  const shown = NAV.gaps ? rows.filter(r => r.status !== 'ok') : rows;
  const chips = (list, gapTxt) => list.length ? list.map(e => `<button type="button" class="chip s-${stageOf(e)}" data-eid="${e.eid}">${esc(dispName(e))}</button>`).join('') : `<span class="gap">${gapTxt}</span>`;
  body.innerHTML = `
  <div class="cov-sum">
    <div class="tile"><b>${n}</b><span>Anforderungen</span></div>
    <div class="tile"><b>${nSat}<small>/${n}</small></b><span>umgesetzt (satisfy)</span><i style="--p:${n ? nSat / n * 100 : 0}%"></i></div>
    <div class="tile"><b>${nVer}<small>/${n}</small></b><span>verifiziert (verify)</span><i style="--p:${n ? nVer / n * 100 : 0}%"></i></div>
    <div class="tile ${nOk < n ? 'warn' : 'good'}"><b>${n - nOk}</b><span>mit Lücke</span></div>
  </div>
  <div class="cov-ctl"><label><input type="checkbox" id="gapsOnly"${NAV.gaps ? ' checked' : ''}> nur Lücken zeigen</label><span class="muted">Zeile anklicken: Rückverfolgung ab dieser Anforderung</span></div>
  <div class="tblwrap"><table class="cov">
    <thead><tr><th>ID</th><th>Anforderung</th><th>umgesetzt durch</th><th>verifiziert durch</th><th>Status</th></tr></thead>
    <tbody>${shown.map(r => `<tr class="st-${r.status}">
      <td class="mono">${esc(r.id)}</td>
      <td><button type="button" class="rq" data-eid="${r.el.eid}" style="padding-left:${r.depth * 14}px"><b>${esc(r.el.name)}</b>${r.def ? `<span class="muted"> : ${esc(r.def.name)}</span>` : ''}</button>${r.text ? `<div class="rt">${esc(r.text)}</div>` : ''}</td>
      <td>${r.status === 'group' ? `<span class="muted">${r.kids} Unteranforderungen</span>` : chips(r.sat, 'fehlt')}</td>
      <td>${r.status === 'group' ? '' : chips(r.ver, 'fehlt')}</td>
      <td><span class="pill p-${r.status}" title="${esc(STATUS[r.status][1])}">${STATUS[r.status][0]}</span></td>
    </tr>`).join('')}</tbody></table></div>`;
  $('gapsOnly').onchange = e => { NAV.gaps = e.target.checked; renderNav(); };
}

/* ---------- Karten & Linien ---------- */
function idOf(el) { if (el.short) return el.short; const d = !el.isDef && el.types[0] ? resolveDef(el.types[0], el) : null; return d && d.short || ''; }
function card(el, o) {
  o = o || {}; const st = stageOf(el); const id = idOf(el);
  const ctx = el.parent && el.parent.qn ? 'in ' + el.parent.qn : '';
  const doc = el.doc || (!el.isDef && el.types[0] && (resolveDef(el.types[0], el) || {}).doc) || '';
  const short = doc.length > 90 && !o.focus ? doc.slice(0, 88) + '…' : doc;
  let status = '';
  if (st === 'req' && !el.isDef || (st === 'req' && o.focus)) { const row = coverage().find(r => r.el === el); if (row) status = `<span class="pill p-${row.status}" title="${esc(STATUS[row.status][1])}">${STATUS[row.status][0]}</span>`; }
  return `<div class="card s-${st}${o.focus ? ' focus' : ''}${o.indirect ? ' ind' : ''}${o.trace ? ' tr' : ''}" data-eid="${el.eid}" tabindex="0" role="button" aria-label="${esc(kindLabel(el) + ' ' + dispName(el))}">
    <div class="ck"><span>${esc(kindLabel(el) || el.kind)}</span>${id ? `<span class="cid">${esc(id)}</span>` : ''}${o.depth ? `<span class="dep" title="Schritte vom Ausgangspunkt">${o.depth}</span>` : ''}${status}</div>
    <div class="cn">${esc(dispName(el))}</div>
    ${o.labels && o.labels.length ? `<div class="cr">${o.labels.map(l => `<span class="rl">${esc(l)}</span>`).join('')}</div>` : ''}
    ${o.reason ? `<div class="why">${esc(o.reason)}</div>` : ''}
    ${short ? `<div class="cd">${esc(short)}</div>` : ''}
    ${o.path && o.path.length > 2 ? `<div class="cp">Weg: ${o.path.map(p => esc(p.name && !p.anon ? p.name : p.kind)).join(' › ')}</div>` : ''}
    ${ctx && !o.focus ? `<div class="cx">${esc(ctx)}</div>` : ''}
  </div>`;
}
function focusActions(el) {
  const b = [];
  b.push(`<button type="button" class="fa" data-act="src">${esc(fileLine(el))}</button>`);
  if (isOpenable(el)) b.push(`<button type="button" class="fa" data-act="detail">Detaildiagramm</button>`);
  if (el.kind === 'state' || el.kind === 'action') b.push(`<button type="button" class="fa" data-act="diag">Ablauf zeichnen</button>`);
  if (NAV.tab !== 'impact') b.push(`<button type="button" class="fa strong" data-act="impact">Was ist bei Änderung betroffen?</button>`);
  else b.push(`<button type="button" class="fa" data-act="trace">Rückverfolgung</button>`);
  return `<div class="fas">${b.join('')}</div>`;
}
function gapCard(title, hint) { return `<div class="gapcard"><b>${esc(title)}</b><code>${esc(hint)}</code></div>`; }
function stageGrid(cols) {
  return `<div class="sgrid" id="sgrid"><svg class="lines" id="lines"></svg>${STAGES.map(s => `<section class="scol s-${s.id}"><header><b>${s.label}</b><span>${s.q}</span></header><div class="scards">${cols[s.id].join('') || '<div class="none">–</div>'}</div></section>`).join('')}</div>`;
}
function drawLines(pairs) {
  const grid = $('sgrid'), svg = $('lines'); if (!grid || !svg) return;
  if (window.innerWidth <= 860) { svg.innerHTML = ''; return; }
  const gb = grid.getBoundingClientRect(); svg.setAttribute('width', grid.scrollWidth); svg.setAttribute('height', grid.scrollHeight);
  const box = eid => { const c = grid.querySelector(`.card[data-eid="${eid}"]`); if (!c) return null; const r = c.getBoundingClientRect(); return { l: r.left - gb.left, r: r.right - gb.left, t: r.top - gb.top, b: r.bottom - gb.top, m: (r.top + r.bottom) / 2 - gb.top, col: stIdx(c.closest('.scol').className.match(/s-(\w+)/)[1]) }; };
  let out = '';
  for (const p of pairs) {
    const A = box(p.from), B = box(p.to); if (!A || !B) continue;
    let d;
    if (A.col === B.col) continue;
    else if (A.col < B.col) { const x1 = A.r, x2 = B.l, k = Math.max(30, (x2 - x1) / 2); d = `M${x1},${A.m} C${x1 + k},${A.m} ${x2 - k},${B.m} ${x2},${B.m}`; }
    else { const x1 = A.l, x2 = B.r, k = Math.max(30, (x1 - x2) / 2); d = `M${x1},${A.m} C${x1 - k},${A.m} ${x2 + k},${B.m} ${x2},${B.m}`; }
    out += `<path d="${d}" class="ln${p.ind ? ' ind' : ''}${p.trace ? ' trc' : ''}"/>`;
  }
  svg.innerHTML = out;
}
let linePairs = [];
const ro = new ResizeObserver(() => drawLines(linePairs));
function afterGrid(pairs) { linePairs = pairs; const g = $('sgrid'); if (g) { ro.disconnect(); ro.observe(g); } requestAnimationFrame(() => drawLines(pairs)); }

function noFocus(body, what) {
  const reqs = IDX.all.filter(e => e.kind === 'requirement' && e.name && !e.isDef).slice(0, 12);
  const parts = IDX.all.filter(e => e.kind === 'part' && e.isDef && e.name).slice(0, 12);
  body.innerHTML = `<div class="nempty"><h3>${what}</h3><p>Wähle einen Startpunkt: über die Suche oben, in der Abdeckung, im Modellbaum oder hier.</p>
  ${reqs.length ? `<div class="quick"><span>Anforderungen</span>${reqs.map(e => `<button type="button" class="chip s-req" data-eid="${e.eid}">${esc(e.name)}</button>`).join('')}</div>` : ''}
  ${parts.length ? `<div class="quick"><span>Komponenten</span>${parts.map(e => `<button type="button" class="chip s-struct" data-eid="${e.eid}">${esc(e.name)}</button>`).join('')}</div>` : ''}</div>`;
}

/* ---------- Rückverfolgung ---------- */
function renderTraceTab(body) {
  const F = navFocus(); if (!F) { noFocus(body, 'Rückverfolgung'); return; }
  const st = stageOf(F); const nb = traceNeighbors(F);
  const cols = {}; STAGES.forEach(s => { cols[s.id] = []; });
  if (st) cols[st].push(card(F, { focus: true }));
  else { body.innerHTML = ''; noFocus(body, `„${dispName(F)}“ ist kein Element der Entwicklungskette`); return; }
  const sorted = nb.sort((a, b) => (a.indirect - b.indirect) || (b.trace - a.trace) || dispName(a.el).localeCompare(dispName(b.el), 'de'));
  for (const r of sorted) cols[stageOf(r.el)].push(card(r.el, { labels: r.labels, indirect: r.indirect, trace: r.trace }));
  const has = (stage, pred) => nb.some(r => stageOf(r.el) === stage && (!pred || pred(r)));
  const lab = r => r.labels.join(' ');
  if (st === 'req' && !F.isDef) {
    const kids = trOut(F, 'owns').filter(c => c.kind === 'requirement').length;
    if (!kids && !has('struct', r => /erfüllt/.test(lab(r)))) cols.struct.unshift(gapCard('Lücke: keine Komponente erfüllt diese Anforderung', `satisfy ${F.name} by <part>;`));
    if (!kids && !has('test', r => /verifiziert|prüft/.test(lab(r)))) cols.test.unshift(gapCard('Lücke: kein Test verifiziert diese Anforderung', `verify ${F.name};  // im objective einer verification`));
  }
  if (st === 'struct' && !has('req', r => /erfüllt/.test(lab(r)))) cols.req.unshift(gapCard('Keine Anforderung zugeordnet', `satisfy <requirement> by ${F.name};`));
  if (st === 'test' && !has('req', r => /verifiziert/.test(lab(r)))) cols.req.unshift(gapCard('Dieser Test verifiziert keine Anforderung', 'objective { verify <requirement>; }'));
  body.innerHTML = `<div class="nlead"><b>${esc(dispName(F))}</b> hängt mit ${nb.length} Element${nb.length === 1 ? '' : 'en'} zusammen. <span class="muted">Durchgezogen: direkt modelliert · gestrichelt: über einen Zwischenschritt · farbig: satisfy, verify, derive, allocate.</span></div>` + stageGrid(cols);
  afterGrid(nb.map(r => ({ from: F.eid, to: r.el.eid, ind: r.indirect, trace: r.trace })));
}

/* ---------- Auswirkung ---------- */
function renderImpactTab(body) {
  const F = navFocus(); if (!F) { noFocus(body, 'Auswirkungsanalyse'); return; }
  const st = stageOf(F); if (!st) { noFocus(body, `„${dispName(F)}“ ist kein Element der Entwicklungskette`); return; }
  const res = impactOf(F, NAV.depth).sort((a, b) => a.depth - b.depth || dispName(a.el).localeCompare(dispName(b.el), 'de'));
  const cols = {}; STAGES.forEach(s => { cols[s.id] = []; });
  cols[st].push(card(F, { focus: true }));
  for (const r of res) cols[stageOf(r.el)].push(card(r.el, { depth: r.depth, reason: r.reason, path: r.path, indirect: r.depth > 1 }));
  const cnt = id => res.filter(r => stageOf(r.el) === id).length;
  const nTest = cnt('test'), nReq = cnt('req');
  body.innerHTML = `<div class="nlead">
    <div>Eine Änderung an <b>${esc(dispName(F))}</b> betrifft <b>${res.length}</b> Element${res.length === 1 ? '' : 'e'}${res.length ? ': ' + STAGES.filter(s => cnt(s.id)).map(s => cnt(s.id) + ' ' + s.label).join(', ') : ''}.
    ${nReq ? `<span class="hl">${nReq} Anforderung${nReq > 1 ? 'en' : ''} neu nachweisen</span>` : ''} ${nTest ? `<span class="hl">${nTest} Test${nTest > 1 ? 's' : ''} wiederholen oder anpassen</span>` : ''}</div>
    <label class="depth">Reichweite <select id="nDepth">${[1, 2, 3, 4, 5].map(d => `<option value="${d}"${d === NAV.depth ? ' selected' : ''}>${d} Schritt${d > 1 ? 'e' : ''}</option>`).join('')}</select></label>
    <span class="muted">Die Ausbreitung folgt festen Regeln: Definition → Usages → Besitzer und verbundene Partner → erfüllte Anforderungen → deren Tests. Jede Karte nennt den Grund.</span>
  </div>` + stageGrid(cols);
  $('nDepth').onchange = e => { NAV.depth = +e.target.value; store.set('ndepth', NAV.depth); renderNav(); };
  afterGrid(res.map(r => ({ from: r.path[r.path.length - 2].eid, to: r.el.eid, ind: r.depth > 1 })));
}

/* ---------- Klicks im Navigator ---------- */
$('nbody').addEventListener('click', e => {
  const fa = e.target.closest('.fa');
  if (fa) {
    const F = navFocus(); if (!F) return; const a = fa.dataset.act;
    if (a === 'src') gotoLine(F.file, F.line);
    if (a === 'detail') { openDetail(F, true); }
    if (a === 'impact') { NAV.tab = 'impact'; saveHist(); renderNav(); }
    if (a === 'trace') { NAV.tab = 'trace'; saveHist(); renderNav(); }
    if (a === 'diag') { const v = F.kind === 'state' ? 'states' : 'actions'; const list = v === 'states' ? stateCandidates() : actionCandidates(); let c = F; while (c && !list.includes(c)) c = c.parent; if (!c && F.types[0]) c = resolveDef(F.types[0], F); S.view = v; if (c) S.ctx[v] = keyOf(c); setMode('diag'); renderTabs(); }
    return;
  }
  const t = e.target.closest('[data-eid]'); if (!t) return;
  const el = elByEid(t.dataset.eid); if (!el) return;
  if (t.classList.contains('focus')) return;
  navGo(el, 'trace');
});
$('nbody').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('card')) { e.preventDefault(); e.target.click(); } });
window.addEventListener('resize', () => drawLines(linePairs));
