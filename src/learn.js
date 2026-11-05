
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
  return `<p class="blead">${segHTML(d.lead)}</p><dl class="brows">${d.rows.map(r => `<div class="${r.gap ? 'bgap' : ''}"><dt>${esc(r.k)}</dt><dd>${segHTML(r.v)}</dd></div>`).join('')}</dl>`;
}
function renderFocusBar() {
  const bar = $('focusBar'), brief = $('brief');
  const F = IDXok ? navFocus() : null;
  if (!F) {
    bar.innerHTML = `<span class="fb-empty">Kein Element im Fokus. Wähle eines in der Abdeckung, über die Suche, im Modellbaum oder durch Klick ins Diagramm.</span>`;
    brief.hidden = true; return;
  }
  const st = stageOf(F);
  bar.innerHTML = `<span class="fb-lab">Fokus</span>
    <span class="fb-el s-${st || 'x'}"><span class="fb-k" data-tip-kind="${esc(kindLabel(F))}">${esc(kindLabel(F) || F.kind)}</span><b>${esc(dispName(F))}</b></span>
    <span class="fb-acts">
      <button type="button" class="fbb" data-fb="brief" aria-expanded="${briefOpen}">${briefOpen ? 'Steckbrief ausblenden' : 'Steckbrief'}</button>
      ${st ? `<button type="button" class="fbb${S.mode === 'nav' && NAV.tab === 'trace' ? ' on' : ''}" data-fb="trace">Rückverfolgung</button><button type="button" class="fbb${S.mode === 'nav' && NAV.tab === 'impact' ? ' on' : ''}" data-fb="impact">Auswirkung</button>` : ''}
      <button type="button" class="fbb${S.mode === 'diag' ? ' on' : ''}" data-fb="diag">Im Diagramm</button>
      ${isOpenable(F) ? '<button type="button" class="fbb" data-fb="detail">Detaildiagramm</button>' : ''}
      <button type="button" class="fbb" data-fb="src">Quelltext</button>
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
$('brief').addEventListener('click', e => briefClick(e, el => { if (S.mode === 'nav') navGo(el, NAV.tab === 'cover' || NAV.tab === 'check' ? 'trace' : NAV.tab); else setFocus(el); }));

/* ---------- Modell-Check ---------- */
const SEV = { error: ['Fehler', 'Das Modell ist an dieser Stelle falsch oder unvollständig verstanden.'], gap: ['Lücke', 'Etwas fehlt in der Kette Anforderung → Umsetzung → Nachweis.'], hint: ['Hinweis', 'Kein Fehler, aber eine Stelle, die einen zweiten Blick wert ist.'] };
let checkCache = null;
function currentChecks() { if (!checkCache) checkCache = modelChecks(parseRes ? parseRes.warns : []); return checkCache; }
function renderCheck(body) {
  const items = currentChecks();
  const cnt = s => items.filter(i => i.sev === s).length;
  if (!items.length) { body.innerHTML = `<div class="nempty"><h3>Keine Auffälligkeiten</h3><p>Der Modell-Check hat nichts gefunden: Jede Anforderung ist umgesetzt und geprüft, alle Verweise lösen sich auf, die Port-Richtungen passen.</p></div>`; return; }
  const groups = Object.keys(RULES).map(r => ({ r, list: items.filter(i => i.rule === r) })).filter(g => g.list.length);
  body.innerHTML = `<div class="cov-sum">
      ${['error', 'gap', 'hint'].map(s => `<div class="tile sev-${s}" data-tip-sev="${s}"><b>${cnt(s)}</b><span>${SEV[s][0]}${cnt(s) === 1 ? '' : s === 'error' ? '' : s === 'gap' ? 'n' : 'e'}</span></div>`).join('')}
    </div>
    <p class="muted chk-intro">Der Check prüft, was ein Werkzeug ohne vollständigen SysML-Compiler sicher erkennen kann. Element anklicken: Rückverfolgung ab dort. Zeile anklicken: Quelltext.</p>
    ${groups.map(g => `<details class="chk" open>
      <summary><span class="pill sv-${RULES[g.r].sev}">${SEV[RULES[g.r].sev][0]}</span><b>${esc(RULES[g.r].title)}</b><span class="muted">${g.list.length}</span></summary>
      <p class="why">${esc(RULES[g.r].why)}</p>
      <ul>${g.list.map(i => `<li>
        <div class="chk-l">${i.el && stageOf(i.el) ? `<button type="button" class="blink s-${stageOf(i.el)}" data-eid="${i.el.eid}">${esc(dispName(i.el))}</button>` : ''}<span>${esc(i.msg)}</span>${i.line ? `<button type="button" class="bact" data-file="${esc(i.file || '')}" data-line="${i.line}">${esc((S.files.length > 1 && i.file ? i.file + ', ' : '') + 'Zeile ' + i.line)}</button>` : ''}${i.ambig ? `<button type="button" class="bact" data-ambig="${esc(i.ambig)}">Auswahl treffen</button>` : ''}</div>
        <div class="chk-fix"><code>${esc(i.fix)}</code><button type="button" class="cp-btn" data-copy="${esc(i.fix)}" title="Vorschlag kopieren">Kopieren</button></div>
      </li>`).join('')}</ul>
    </details>`).join('')}`;
}
$('nbody').addEventListener('click', e => {
  const c = e.target.closest('[data-copy]');
  if (c) { e.stopPropagation(); const t = c.dataset.copy; try { navigator.clipboard.writeText(t).then(() => toast('Vorschlag kopiert'), () => toast(t)); } catch (x) { toast(t); } return; }
  const l = e.target.closest('.bact[data-line]'); if (l) { e.stopPropagation(); gotoLine(l.dataset.file || null, +l.dataset.line); return; }
  const a = e.target.closest('[data-ambig]'); if (a) { e.stopPropagation(); openAmbig(a.dataset.ambig); return; }
}, true);

/* ---------- Notation erklären ---------- */
const NOTE = {
  'e-comp': ['Komposition', 'Das Ganze (Seite mit der gefüllten Raute) besteht aus dem Teil an der Pfeilspitze. Die Beschriftung nennt den Namen des Teils und ggf. die Anzahl.', 'part def Roboter { part akku : Akku; }'],
  'e-spec': ['Spezialisierung :>', 'Das hohle Dreieck zeigt auf die allgemeinere Definition. Die andere erbt alle ihre Merkmale und kann eigene ergänzen.', 'part def Akku :> Komponente;'],
  'e-typed': ['Typisierung / Verweis', 'Gestrichelt: Das Element ist vom Typ der Definition an der Pfeilspitze, oder es verweist darauf (z. B. exhibit, perform, subject).', 'port ausgang : EnergiePort;'],
  'e-defby': ['Usage und Definition', 'Verbindet eine konkrete Verwendung (abgerundet) mit ihrem Bauplan (eckig, am Dreieck).', 'part roboter : Roboter;'],
  'e-conn': ['Verbindung (connect)', 'Zwei Ports oder Teile sind verbunden. Eine Linie ohne Pfeil sagt nichts über eine Flussrichtung.', 'connect lidar.scanAus to rechner.scanEin;'],
  'e-iface': ['Schnittstelle (interface)', 'Dicke Linie: eine Verbindung, deren Art eine interface def festlegt. Die Beschriftung nennt diesen Typ.', 'interface : Versorgung connect akku.ausgang to rechner.energie;'],
  'e-flow': ['Fluss (flow)', 'Etwas fließt in Pfeilrichtung von einem Ausgang zu einem Eingang: Daten, Energie oder Material. Die Beschriftung nennt, was fließt.', 'flow of Fahrbefehl from rechner.fahrAus to antrieb.fahrEin;'],
  'e-bind': ['Bindung (bind)', 'Beide Seiten haben immer denselben Wert.', 'bind a.x = b.y;'],
  'e-trans': ['Transition', 'Wechsel von einem Zustand in den nächsten. Beschriftung: Auslöser [Bedingung] / Wirkung.', 'accept StartBefehl then Navigation;'],
  'e-succ': ['Nachfolge (then)', 'Der Schritt an der Pfeilspitze beginnt, wenn der vorige fertig ist. [ … ] ist die Bedingung einer Verzweigung.', 'first lokalisieren then pfadPlanen;'],
  'e-satisfy': ['satisfy – erfüllt', 'Die Komponente erfüllt die Anforderung an der Pfeilspitze. Diese Beziehung ist der Kern der Rückverfolgung.', 'satisfy laufzeit by roboter.akku;'],
  'e-contain': ['enthält', 'Die Anforderung mit dem Kreis-Plus fasst die andere als Unteranforderung zusammen.', 'requirement r { requirement a : A; }'],
  'e-inner': ['besteht aus', 'Führt zur inneren Struktur: welche Teile darin stecken und wie sie verbunden sind.', ''],
  'def': ['Definition (eckige Ecken)', 'Ein Bauplan, z. B. part def. Eine Definition beschreibt, wie etwas aufgebaut ist – im System steckt sie erst, wenn sie verwendet wird.', 'part def Akku { … }'],
  'usage': ['Usage (abgerundete Ecken)', 'Eine konkrete Verwendung einer Definition in einem bestimmten Zusammenhang, z. B. der Akku im Roboter.', 'part akku : Akku;'],
  'frame': ['Rahmen: innere Struktur', 'Alles im Rahmen gehört zu diesem Element. Ports auf dem Rand sind seine Anschlüsse nach außen.', ''],
  'file': ['Datei', 'Rahmen um alle Definitionen aus einer .sysml-Datei.', ''],
  'collapsed': ['Gestrichelter Rand', 'Dieses Teil enthält weitere Teile, die bei der gewählten Tiefe ausgeblendet sind. Tiefe oben erhöhen oder das Teil anklicken.', ''],
  'inherited': ['^ geerbt', 'Das Merkmal ist nicht hier festgelegt, sondern in einer allgemeineren Definition – es wird geerbt.', 'part def Akku :> Komponente;  // erbt masse'],
  'redef': [':>> Redefinition', 'Ein geerbtes Merkmal wird hier neu festgelegt, z. B. mit einem eigenen Wert.', ':>> masse = 0.35;'],
  'feature': ['Merkmal', 'Schreibweise: Name : Typ [Anzahl] = Wert. Der Typ verweist auf eine Definition.', 'attribute kapazitaet : Real = 5.2;'],
  'init': ['Startpunkt', 'Hier beginnt der Ablauf bzw. die Zustandsmaschine.', 'entry; then Bereit;   bzw.   first start;'],
  'final': ['Ende', 'Der Ablauf ist abgeschlossen.', 'then done;'],
  'decide': ['Entscheidung / Zusammenführung', 'Raute: Der Ablauf verzweigt nach Bedingungen [ … ] oder läuft wieder zusammen.', 'decide; if ok then done; else lokalisieren;'],
  'fork': ['Gabelung / Vereinigung', 'Balken: Mehrere Schritte laufen parallel bzw. warten aufeinander.', 'fork; then a; then b;'],
  'amb': ['Name mehrfach definiert', 'Es gibt mehrere Definitionen mit diesem Namen. Unqualifizierte Verweise sind dann mehrdeutig – im Modell besser Paket::Name schreiben.', 'part m : Struktur::Motor;'],
  'port-generic': ['Port (Anschluss)', 'Das Quadrat auf dem Rand ist ein Anschluss. Das Dreieck darin zeigt die Richtung: in das Teil hinein (in) oder heraus (out). Ohne Dreieck ist die Richtung offen.', 'port ausgang : ~EnergiePort;'],
  'c-attributes': ['attributes', 'Eigenschaften mit Typ und ggf. Wert, z. B. Masse oder Kapazität.', 'attribute masse : Masse;'],
  'c-ports': ['ports', 'Die Anschlüsse dieses Elements.', 'port energie : EnergiePort;'],
  'c-parts': ['parts', 'Die Teile, aus denen dieses Element besteht.', 'part motor : Motor[2];'],
  'c-directed features': ['directed features', 'Merkmale mit Richtung: in = kommt herein, out = geht hinaus. Typisch in port def und Aktionen.', 'out item cmd : Fahrbefehl;'],
  'c-ends': ['ends', 'Die beiden Enden einer Verbindungsart – welche Port-Typen sie verbindet.', 'end quelle : ~EnergiePort;'],
  'c-actions': ['actions', 'Abläufe, die dieses Element ausführt.', 'perform action navigation : NavigiereZumZiel;'],
  'c-states': ['states', 'Zustandsverhalten, das dieses Element zeigt.', 'exhibit state betrieb : Betriebszustaende;'],
  'c-constraints': ['constraints', 'Bedingungen, die gelten müssen.', 'require constraint { laufzeit >= 2 }'],
  'c-literals': ['literals', 'Die festen Werte einer Aufzählung.', 'enum def Farbe { rot; gruen; }'],
  'r-satisfy': ['erfüllt', 'satisfy: Eine Komponente setzt eine Anforderung um.', 'satisfy laufzeit by roboter.akku;'],
  'r-verify': ['verifiziert / prüft', 'verify: Ein Test weist nach, dass eine Anforderung erfüllt ist.', 'objective { verify laufzeit; }'],
  'r-derive': ['abgeleitet', 'derivation: Eine Anforderung folgt aus einer anderen.', '#derivation connection { end #original ::> a; end #derive ::> b; }'],
  'r-refine': ['verfeinert', 'refinement: Ein Element beschreibt ein anderes genauer.', '#refinement dependency from a to b;'],
  'r-allocate': ['alloziert', 'allocate: Etwas Logisches (z. B. ein Ablauf) wird etwas Physischem (z. B. einem Rechner) zugeordnet.', 'allocate NavigiereZumZiel to roboter.rechner;'],
  'r-owns': ['Teil von / enthält', 'Komposition: Das Element gehört zu einem größeren Ganzen bzw. enthält kleinere Teile.', 'part def Roboter { part akku : Akku; }'],
  'r-typed': ['Definition / Usage', 'Typisierung: die Verbindung zwischen Bauplan (Definition) und konkreter Verwendung (Usage).', 'part akku : Akku;'],
  'r-spec': ['spezialisiert', 'Spezialisierung :> – erbt alle Merkmale der allgemeineren Definition.', 'part def Akku :> Komponente;'],
  'r-connect': ['verbunden / Gegenstelle', 'Zwei Teile sind über Ports verbunden; die Klammer nennt Schnittstelle und Ports.', 'interface : Versorgung connect akku.ausgang to rechner.energie;'],
  'r-port': ['Port', 'Ein Anschluss der Komponente.', 'port ausgang : ~EnergiePort;'],
  'r-perform': ['führt aus / zeigt', 'perform bzw. exhibit: Die Komponente führt einen Ablauf aus bzw. zeigt ein Zustandsverhalten.', 'perform action navigation : NavigiereZumZiel;'],
  'r-subject': ['Gegenstand / Prüfling', 'subject: Worauf sich eine Anforderung oder ein Test bezieht.', 'subject pruefling : Roboter;'],
  'r-flow': ['liefert / erhält', 'flow: Etwas fließt von einem Ausgang zu einem Eingang.', 'flow of Scan from lidar.scanAus to rechner.scanEin;'],
};
const REL_TIP = [[/erfüllt|setzt .* um|Umsetzung/, 'r-satisfy'], [/verifiziert|prüft|Test/, 'r-verify'], [/abgeleitet/, 'r-derive'], [/verfeinert/, 'r-refine'], [/alloziert|Darauf läuft/, 'r-allocate'], [/Teil von|enthält|gehört zu/, 'r-owns'], [/Definition|Usage|vom Typ/, 'r-typed'], [/spezialisiert/, 'r-spec'], [/Gegenstelle|verbunden|Partner|Verbindung an|Ende von/, 'r-connect'], [/Port/, 'r-port'], [/führt aus|ausgeführt|zeigt|gezeigt/, 'r-perform'], [/Gegenstand|testet|Prüfling|betrifft/, 'r-subject'], [/liefert|erhält/, 'r-flow']];
const kindTip = k => { const t = KIND_PLAIN[k]; return t ? ['«' + k + '»', t.charAt(0).toUpperCase() + t.slice(1) + '.', ''] : null; };
function tipFor(t) {
  if (!t || !t.closest) return null;
  const d = t.closest('[data-tip]'); if (d) return NOTE[d.dataset.tip] || null;
  const k = t.closest('[data-tip-kind]'); if (k) return kindTip(k.dataset.tipKind);
  const sv = t.closest('[data-tip-sev]'); if (sv) return [SEV[sv.dataset.tipSev][0], SEV[sv.dataset.tipSev][1], ''];
  const pill = t.closest('.pill'); if (pill) { const m = pill.className.match(/p-(\w+)/); if (m && STATUS[m[1]]) return ['Status: ' + STATUS[m[1]][0], STATUS[m[1]][1] + '.', '']; const s2 = pill.className.match(/sv-(\w+)/); if (s2) return [SEV[s2[1]][0], SEV[s2[1]][1], '']; }
  const rl = t.closest('.rl, dt'); if (rl) { for (const [re, key] of REL_TIP) if (re.test(rl.textContent)) return NOTE[key]; }
  const ck = t.closest('.card .ck > span:first-child'); if (ck) return kindTip(ck.textContent.trim());
  if (!t.closest('.dg')) return null;
  if (t.closest('.ambm')) return NOTE.amb;
  const port = t.closest('g.port');
  if (port) { const el = elByEid(port.dataset.eid); if (!el) return NOTE['port-generic']; const dir = portDir(el); return ['Port ' + el.name + (el.types[0] ? ' : ' + el.types[0] : ''), (dir ? 'Richtung: ' + DIR_PLAIN[dir] + '. ' : 'Richtung offen. ') + (el.types[0] && el.types[0].startsWith('~') ? 'Das ~ heißt konjugiert: Die Richtungen des Port-Typs sind umgedreht. ' : '') + 'Das Dreieck im Quadrat zeigt die Richtung.', 'port ' + el.name + (el.types[0] ? ' : ' + el.types[0] : '') + ';']; }
  const cls = (t.getAttribute && t.getAttribute('class')) || '';
  let m = cls.match(/\be-(\w+)/) || cls.match(/\bel-(\w+)/); if (m && NOTE['e-' + m[1]]) return NOTE['e-' + m[1]];
  if (/\bst\b/.test(cls)) { const kw = t.textContent.replace(/[«»]/g, '').trim(); return kindTip(kw) || (kw === 'Datei' ? NOTE.file : null); }
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
  tip.innerHTML = `<b>${esc(n[0])}</b><span>${esc(n[1])}</span>${n[2] ? `<code>${esc(n[2])}</code>` : ''}`;
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
