'use strict';
/* ================= Sprache (i18n) =================
   Texte stehen in src/lang/<code>.json. L(key, {platzhalter}) liefert den Text der aktiven Sprache,
   fällt auf Deutsch und zuletzt auf den Schlüssel zurück. Ln(key, n) wählt die Pluralform
   (key.one, key.other, … nach Intl.PluralRules). Lj(liste) verbindet „a, b und c“ sprachgerecht. */
const BASE_LANG = 'de';
let LANG = BASE_LANG, DICTS = {};
function setDicts(d) { DICTS = d || {}; }
function setLang(code) { LANG = DICTS[code] ? code : BASE_LANG; return LANG; }
function lookup(key) { const a = DICTS[LANG], b = DICTS[BASE_LANG]; return a && a[key] !== undefined ? a[key] : b && b[key] !== undefined ? b[key] : undefined; }
function fill(s, p) { return p ? String(s).replace(/\{(\w+)\}/g, (m, k) => p[k] !== undefined && p[k] !== null ? p[k] : m) : String(s); }
function L(key, p) { const s = lookup(key); return fill(s === undefined ? key : s, p); }
function Ln(key, n, p) {
  let cat = 'other'; try { cat = new Intl.PluralRules(LANG).select(n); } catch (e) {}
  const s = lookup(key + '.' + cat) ?? lookup(key + '.other') ?? key;
  return fill(s, Object.assign({ n }, p || {}));
}
function Lj(list) { try { return new Intl.ListFormat(LANG, { style: 'long', type: 'conjunction' }).format(list); } catch (e) { return list.join(', '); } }
/* ================= Tokenizer ================= */
const SYMS = [':>>', '::>', ':>', '::', ':=', '==', '!=', '<=', '>=', '->', '..', '=>', '**'];
function countNL(s, a, b) { let c = 0; for (let k = a; k < b; k++) if (s.charCodeAt(k) === 10) c++; return c; }
function tokenize(src) {
  const T = []; let i = 0, line = 1; const n = src.length;
  const idStart = c => /[A-Za-z_À-ɏ]/.test(c);
  const idPart = c => /[A-Za-z0-9_À-ɏ]/.test(c);
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') {
      if (src[i + 2] === '*') { const e = src.indexOf('*/', i + 3); const end = e < 0 ? n : e + 2; line += countNL(src, i, end); i = end; continue; }
      while (i < n && src[i] !== '\n') i++; continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2); const end = e < 0 ? n : e + 2;
      T.push({ t: 'block', v: src.slice(i + 2, e < 0 ? n : e), line }); line += countNL(src, i, end); i = end; continue;
    }
    if (c === "'") {
      let j = i + 1, s = ''; const l0 = line;
      while (j < n && src[j] !== "'") { if (src[j] === '\\' && j + 1 < n) { s += src[j + 1]; j += 2; continue; } if (src[j] === '\n') line++; s += src[j++]; }
      T.push({ t: 'id', v: s, q: true, line: l0 }); i = j + 1; continue;
    }
    if (c === '"') {
      let j = i + 1; while (j < n && src[j] !== '"') { if (src[j] === '\\') j++; j++; }
      T.push({ t: 'str', v: src.slice(i, j + 1), line }); line += countNL(src, i, j); i = j + 1; continue;
    }
    if (idStart(c)) { let j = i + 1; while (j < n && idPart(src[j])) j++; T.push({ t: 'id', v: src.slice(i, j), line }); i = j; continue; }
    if (/[0-9]/.test(c)) {
      let j = i + 1;
      while (j < n && /[0-9.eE]/.test(src[j])) { if (src[j] === '.' && (src[j + 1] === '.' || !/[0-9]/.test(src[j + 1] || ''))) break; j++; }
      T.push({ t: 'num', v: src.slice(i, j), line }); i = j; continue;
    }
    const m = SYMS.find(s => src.startsWith(s, i));
    if (m) { T.push({ t: 'sym', v: m, line }); i += m.length; continue; }
    T.push({ t: 'sym', v: c, line }); i++;
  }
  T.push({ t: 'eof', v: '', line });
  return T;
}
function joinToks(ts) {
  let s = '', prev = null;
  for (const t of ts) {
    if (t.t === 'block') continue;
    const v = t.t === 'id' && t.q ? "'" + t.v + "'" : t.v;
    const noBefore = t.t === 'sym' && ['.', '::', ')', ']', ',', '..', ';'].includes(t.v);
    const noAfter = prev && prev.t === 'sym' && ['.', '::', '(', '[', '..', '~', '#'].includes(prev.v);
    if (s && !noBefore && !noAfter) s += ' ';
    s += v; prev = t;
  }
  return s;
}

/* ================= Parser ================= */
const VIS = new Set(['public', 'private', 'protected']);
const MODS = new Set(['abstract', 'variation', 'variant', 'ref', 'readonly', 'derived', 'constant', 'in', 'out', 'inout', 'individual', 'snapshot', 'timeslice', 'ordered', 'nonunique', 'composite', 'portion', 'var', 'const']);
const ELEM = new Set(['part', 'port', 'attribute', 'item', 'interface', 'connection', 'action', 'state', 'requirement', 'constraint', 'calc', 'case', 'view', 'viewpoint', 'rendering', 'enum', 'occurrence', 'allocation', 'metadata', 'concern', 'decide', 'merge', 'fork', 'join', 'accept', 'send', 'assign', 'event', 'flow', 'message', 'binding', 'succession', 'analysis', 'verification']);
const ROLE = new Set(['subject', 'actor', 'stakeholder', 'end', 'return', 'objective']);
const CONT = new Set(['connect', 'first', 'then', 'accept', 'from', 'to', 'of', 'by', 'defined', 'specializes', 'subsets', 'redefines', 'references', 'ordered', 'nonunique', 'default', 'via', 'if', 'do', 'about', 'crosses', 'chains', 'def']);
const EXPRK = new Set(['constraint', 'calc', 'analysis', 'verification']);
const BEHAV = new Set(['state', 'action', 'decide', 'merge', 'fork', 'join', 'accept', 'send', 'assign']);
const lastSeg = s => (s || '').replace(/^~/, '').split('::').pop().split('.').pop();

function parse(src) {
  const T = tokenize(src); let i = 0, eid = 0, anon = 0; const warns = []; let pendingMeta = [];
  const root = mk('root', false, null, 0, []);
  function mk(kind, isDef, parent, line, mods) {
    const el = { eid: ++eid, kind, isDef, name: null, short: null, types: [], specs: [], redefs: [], refs: [], mult: null, value: null, mods: mods || [], dir: null, children: [], rels: [], parent, line, doc: null, ends: null };
    for (const m of el.mods) if (m === 'in' || m === 'out' || m === 'inout') el.dir = m;
    if (pendingMeta.length && kind !== 'root') { el.meta = pendingMeta.map(x => x.toLowerCase()); pendingMeta = []; }
    if (parent) parent.children.push(el);
    return el;
  }
  const pk = (k = 0) => T[Math.min(i + k, T.length - 1)];
  const kw = (k = 0) => { const t = pk(k); return t.t === 'id' && !t.q ? t.v : null; };
  const isKw = (v, k = 0) => kw(k) === v;
  const isSym = (v, k = 0) => { const t = pk(k); return t.t === 'sym' && t.v === v; };
  const eof = () => pk().t === 'eof';
  const warn = (line, msg) => warns.push({ line, msg });
  const isName = (k = 0) => { const t = pk(k); return t.t === 'id' && (t.q || !CONT.has(t.v)); };
  function qname() { const t = pk(); if (t.t !== 'id') return null; let s = t.v; i++; while (isSym('::') && pk(1).t === 'id') { i++; s += '::' + pk().v; i++; } if (isSym('::') && isSym('*', 1)) i += 2; return s; }
  function chain() { let pre = ''; if (isSym('~')) { i++; pre = '~'; } const s0 = qname(); if (s0 == null) return null; let s = s0; while (isSym('.') && pk(1).t === 'id') { i++; s += '.' + pk().v; i++; } return pre + s; }
  function qlist() { const r = []; for (;;) { const c = chain(); if (c == null) break; r.push(c); if (isSym(',')) { i++; continue; } break; } return r; }
  function textUntil(stopKw, stopSym) {
    const ts = []; let d = 0;
    while (!eof()) {
      const t = pk();
      if (d === 0) {
        if (t.t === 'sym' && stopSym.includes(t.v)) break;
        if (t.t === 'id' && !t.q && stopKw.includes(t.v)) break;
      }
      if (t.t === 'sym' && '([{'.includes(t.v)) d++;
      if (t.t === 'sym' && ')]}'.includes(t.v)) { if (d === 0) break; d--; }
      ts.push(t); i++;
    }
    return joinToks(ts);
  }
  function skipStmt() {
    let d = 0;
    while (!eof()) {
      const t = pk();
      if (t.t === 'sym') {
        if (t.v === '{') d++;
        else if (t.v === '}') { if (d === 0) return; d--; i++; if (d === 0) { if (isSym(';')) i++; return; } continue; }
        else if (t.v === ';' && d === 0) { i++; return; }
      }
      i++;
    }
  }
  function endSimple() { if (isSym(';')) { i++; return; } if (isSym('{')) { skipStmt(); } }
  function endDecl(el) {
    if (isSym(';')) { i++; return; }
    if (isSym('{')) { i++; body(el); if (isSym('}')) i++; else warn(el.line, L('parse.missingBrace', { name: el.name || el.kind })); return; }
    warn(pk().line, L('parse.unexpected', { tok: pk().v || L('parse.eof'), name: el.name || el.kind }));
    skipStmt();
  }
  function rel(p, type, src, tgt, line, extra) { p.rels.push(Object.assign({ type, src, tgt, line, owner: p }, extra || {})); }
  function body(p) { while (!eof() && !isSym('}')) { const b = i; statement(p); if (i === b) i++; } }
  function connectEnds() {
    if (isSym('(')) {
      i++; const r = [];
      while (!eof() && !isSym(')')) { if (isSym(',')) { i++; continue; } if (pk(1).t === 'sym' && pk(1).v === '::>') { i += 2; } const c = chain(); if (c == null) { i++; continue; } r.push(c); }
      if (isSym(')')) i++; return r;
    }
    const a = chain(); if (isKw('to')) i++; const b = chain(); return [a, b].filter(Boolean);
  }
  function transTail() {
    const r = {};
    if (isKw('accept')) { i++; r.trigger = textUntil(['if', 'do', 'then', 'via'], [';', '{']); if (isKw('via')) { i++; r.via = chain(); } }
    if (isKw('if')) { i++; r.guard = textUntil(['do', 'then'], [';', '{']); }
    if (isKw('do')) { i++; if (isKw('action')) i++; r.effect = textUntil(['then'], [';', '{']); }
    if (isKw('then')) { i++; r.tgt = chain(); }
    return r;
  }
  function declTail(el) {
    if (isSym('<') && pk(1).t === 'id' && isSym('>', 2)) { el.short = pk(1).v; i += 3; }
    if (isName()) { el.name = pk().v; i++; }
    if (!el.short && isSym('<') && pk(1).t === 'id' && isSym('>', 2)) { el.short = pk(1).v; i += 3; }
    for (let g = 0; g < 60; g++) {
      if (isSym(':') || (isKw('defined') && isKw('by', 1))) { i += isSym(':') ? 1 : 2; el.types.push(...qlist()); continue; }
      if (isSym(':>') || isKw('specializes') || isKw('subsets')) { i++; el.specs.push(...qlist()); continue; }
      if (isSym(':>>') || isKw('redefines')) { i++; el.redefs.push(...qlist()); continue; }
      if (isSym('::>') || isKw('references')) { i++; el.refs.push(...qlist()); continue; }
      if (isSym('[')) { i++; el.mult = textUntil([], [']']); if (isSym(']')) i++; continue; }
      if (isKw('ordered') || isKw('nonunique')) { i++; continue; }
      if (isSym('=') || isSym(':=') || isKw('default')) { i++; if (isSym('=') || isSym(':=')) i++; el.value = textUntil([], [';', '{']); continue; }
      if (isKw('connect')) { i++; el.ends = connectEnds(); continue; }
      if (isKw('via')) { i++; el.via = chain(); continue; }
      break;
    }
    if (!el.name && el.redefs.length) { el.name = lastSeg(el.redefs[0]); el.redefOnly = true; }
    if (!el.name && BEHAV.has(el.kind) && !el.isDef) { el.name = el.kind + '#' + (++anon); el.anon = true; }
  }
  function declaration(p) {
    const line = pk().line; const mods = [];
    while (kw() && MODS.has(kw()) && !(pk(1).t === 'sym' && [':', ';', '=', ':>'].includes(pk(1).v))) { mods.push(kw()); i++; }
    let role = null;
    if (kw() && ROLE.has(kw())) { role = kw(); i++; while (kw() && MODS.has(kw())) { mods.push(kw()); i++; } }
    while (isSym('#') && pk(1).t === 'id') { i++; pendingMeta.push(lastSeg(qname())); }
    let kind = null, isDef = false; const v = kw();
    if (v === 'use' && isKw('case', 1)) { i += 2; kind = 'usecase'; }
    else if ((v === 'analysis' || v === 'verification') && isKw('case', 1)) { i += 2; kind = v; }
    else if (v && ELEM.has(v)) { i++; kind = v; }
    if (kind && isKw('def')) { i++; isDef = true; }
    if (!kind) {
      const t = pk();
      if (t.t === 'id' || isSym(':>>') || isSym(':>') || isSym(':') || role || mods.length) kind = role || 'feature';
      else { warn(line, L('parse.unknown', { tok: t.v })); skipStmt(); return null; }
    }
    const el = mk(kind, isDef, p, line, mods); el.role = role;
    declTail(el);
    if (el.ends && el.ends.length >= 2) rel(p, kind === 'interface' ? 'interface' : 'connect', el.ends[0], el.ends[1], line, { label: el.name || (el.types[0] ? lastSeg(el.types[0]) : ''), el });
    endDecl(el);
    if (BEHAV.has(kind) && !isDef) p._last = el.name;
    return el;
  }
  function parseFlow(p, line) {
    let name = null, type = null, src = null, tgt = null;
    if (isKw('of')) { i++; type = qname(); }
    else if (isName()) { const c = chain(); if (isKw('to')) src = c; else name = c; }
    if (!src) {
      if (isSym(':')) { i++; type = qname(); }
      if (isKw('of')) { i++; type = qname(); }
      if (isKw('from')) { i++; src = chain(); } else if (isName()) src = chain();
    }
    if (isKw('to')) { i++; tgt = chain(); }
    endSimple();
    if (src && tgt) rel(p, 'flow', src, tgt, line, { label: type ? lastSeg(type) : (name || '') });
    else warn(line, L('parse.flowNoEnds'));
  }
  function statement(p) {
    if (isSym(';')) { i++; return; }
    if (pk().t === 'block') { i++; return; }
    pendingMeta = [];
    while (isSym('#') && pk(1).t === 'id') { i++; pendingMeta.push(lastSeg(qname())); }
    if (isSym('@')) { i++; const n = qname(); if (n) (p.meta || (p.meta = [])).push(lastSeg(n).toLowerCase()); skipStmt(); return; }
    if (kw() && VIS.has(kw())) i++;
    const v = kw(), line = pk().line;
    if (EXPRK.has(p.kind) || p.role === 'objective') {
      const t0 = pk();
      const known = t0.t === 'id' && !t0.q && (MODS.has(t0.v) || ROLE.has(t0.v) || ELEM.has(t0.v) || ['doc', 'comment', 'import', 'require', 'assume', 'subject', 'verify', 'frame', 'private', 'public'].includes(t0.v));
      const isDecl = t0.t === 'id' && (pk(1).t === 'sym' && [':', ':>', ':>>', ';'].includes(pk(1).v)) && !known;
      if (!known && !isDecl) { const ex = textUntil([], [';']); if (ex) (p.exprs || (p.exprs = [])).push(ex); if (isSym(';')) i++; return; }
    }
    if ((v === 'assert' || v === 'not') && (isKw('satisfy', 1) || isKw('satisfy', 2))) { i++; if (isKw('not')) i++; return statement(p); }
    switch (v) {
      case 'import': case 'alias': case 'filter': case 'expose': case 'render': case 'language': case 'rep': case 'include': case 'assert': case 'frame': case 'terminate':
        skipStmt(); return;
      case 'doc': { i++; if (pk().t === 'id') i++; if (pk().t === 'block') { p.doc = (p.doc ? p.doc + '\n' : '') + cleanDoc(pk().v); i++; } return; }
      case 'comment': { i++; while (!eof() && pk().t !== 'block' && !isSym(';') && !isSym('}')) i++; if (pk().t === 'block') i++; else if (isSym(';')) i++; return; }
      case 'library': case 'standard': case 'package': {
        while (isKw('standard') || isKw('library')) i++;
        if (isKw('package')) { i++; const el = mk('package', false, p, line); declTail(el); endDecl(el); return; }
        skipStmt(); return;
      }
      case 'first': { i++; const a = chain(); if (isKw('then')) { i++; const b = chain(); if (a && b) rel(p, 'succession', a, b, line); p._last = b; } else p._last = a; endSimple(); return; }
      case 'then': {
        i++; const prev = p._last; let tgt = null; const k = kw();
        if (k && (ELEM.has(k) || MODS.has(k) || k === 'perform')) { if (k === 'perform') i++; const el = declaration(p); tgt = el && el.name; }
        else { tgt = chain(); endSimple(); }
        if (prev && tgt) rel(p, 'succession', prev, tgt, line);
        if (tgt) p._last = tgt; return;
      }
      case 'if': { i++; const g = textUntil(['then'], [';', '{']); let tgt = null; if (isKw('then')) { i++; tgt = chain(); } endSimple(); if (p._last && tgt) rel(p, 'succession', p._last, tgt, line, { guard: g }); return; }
      case 'else': { i++; const tgt = chain(); endSimple(); if (p._last && tgt) rel(p, 'succession', p._last, tgt, line, { guard: 'else' }); return; }
      case 'entry': case 'exit': case 'do': {
        if (v === 'do' && p.kind !== 'state') break;
        i++; let nm = null;
        if (isSym(';')) i++;
        else if (kw() && ELEM.has(kw())) { const el = declaration(p); if (el) { el.stateAct = v; nm = el.anon ? el.kind : el.name; } }
        else { nm = textUntil([], [';', '{']); endSimple(); }
        if (nm) p['act_' + v] = nm;
        if (v === 'entry') p._last = '__entry';
        return;
      }
      case 'transition': {
        i++; let name = null; if (isName()) { name = pk().v; i++; }
        let src = p._last; if (isKw('first')) { i++; src = chain(); }
        const r = transTail(); endSimple();
        if (src && r.tgt) rel(p, 'transition', src, r.tgt, line, Object.assign(r, { name })); else warn(line, L('parse.transitionNoEnds'));
        return;
      }
      case 'accept':
        if (p.kind === 'state') { const r = transTail(); endSimple(); if (p._last && r.tgt) rel(p, 'transition', p._last, r.tgt, line, r); return; }
        break;
      case 'succession': {
        if (isKw('flow', 1)) { i += 2; parseFlow(p, line); return; }
        if (isKw('def', 1)) break;
        i++; let src = null, tgt = null;
        if (isName()) { i++; if (isSym(':')) { i++; qlist(); } }
        if (isKw('first')) { i++; src = chain(); }
        if (isKw('then')) { i++; tgt = chain(); }
        endSimple(); if (src && tgt) rel(p, 'succession', src, tgt, line); return;
      }
      case 'flow': case 'message':
        if (isKw('def', 1)) break;
        i++; parseFlow(p, line); return;
      case 'connect': { i++; const e = connectEnds(); endSimple(); if (e.length >= 2) rel(p, 'connect', e[0], e[1], line); return; }
      case 'bind': { i++; const a = chain(); if (isSym('=')) i++; const b = chain() || textUntil([], [';', '{']); endSimple(); if (a && b) rel(p, 'bind', a, b, line); return; }
      case 'satisfy': {
        i++; if (isKw('requirement')) i++;
        let r = null; if (isName()) r = chain();
        if (isSym(':')) { i++; const ty = qlist(); if (!r) r = ty[0]; }
        let by = null; if (isKw('by')) { i++; by = chain(); }
        endSimple(); if (r) rel(p, 'satisfy', by, r, line, { srcEl: by ? null : p }); return;
      }
      case 'verify': {
        i++; if (isKw('requirement')) i++;
        let r = null; if (isName()) r = chain();
        if (isSym(':')) { i++; const ty = qlist(); if (!r) r = ty[0]; }
        endSimple(); if (r) rel(p, 'verify', null, r, line, { srcEl: p }); return;
      }
      case 'dependency': {
        const meta = pendingMeta; pendingMeta = []; i++;
        if (isName() && isKw('from', 1)) i++;
        if (isKw('from')) i++;
        const a = qlist(); if (isKw('to')) i++; const b = qlist(); endSimple();
        for (const x of a) for (const y of b) rel(p, 'dependency', x, y, line, { meta });
        return;
      }
      case 'allocate': { i++; const a = chain(); if (isKw('to')) i++; const b = chain(); endSimple(); if (a && b) rel(p, 'allocate', a, b, line); return; }
      case 'perform': case 'exhibit': {
        i++; const k = kw();
        if (k && (k === 'action' || k === 'state' || MODS.has(k))) { const el = declaration(p); if (el) el.performed = v; return; }
        const c = chain(); const el = mk(v === 'perform' ? 'action' : 'state', false, p, line, []);
        el.name = lastSeg(c); el.refTo = c; el.performed = v;
        if (isSym(':')) { i++; el.types.push(...qlist()); }
        endSimple(); return;
      }
      case 'require': case 'assume': {
        i++; if (isKw('constraint')) i++;
        while (!eof() && !isSym('{') && !isSym(';') && !isSym('}')) i++;
        if (isSym('{')) { i++; const txt = textUntil([], ['}']); if (isSym('}')) i++; (p.constraints || (p.constraints = [])).push(v + ' { ' + txt + ' }'); }
        else if (isSym(';')) i++;
        return;
      }
    }
    declaration(p);
  }
  body(root);
  while (!eof()) { if (isSym('}')) { warn(pk().line, L('parse.extraBrace')); i++; } body(root); }
  return { root, warns };
}
function cleanDoc(t) { return t.split('\n').map(l => l.replace(/^\s*\*\s?/, '').trim()).join(' ').replace(/\s+/g, ' ').trim(); }

/* ================= Model index & queries ================= */
let IDX = null;
function buildIndex(root, pick) {
  const all = [], defs = new Map(), byName = new Map();
  (function walk(e, q) {
    for (const c of e.children) {
      c.qn = c.name ? (q ? q + '::' : '') + c.name : q;
      all.push(c);
      if (c.name) {
        if (!byName.has(c.name)) byName.set(c.name, []); byName.get(c.name).push(c);
        if (c.isDef) { if (!defs.has(c.name)) defs.set(c.name, []); defs.get(c.name).push(c); }
      }
      walk(c, c.name ? c.qn : q);
    }
  })(root, '');
  const ambig = [...defs].filter(([n, l]) => l.length > 1).map(([n, l]) => ({ name: n, defs: l }));
  IDX = { all, defs, byName, root, ambig, pick: pick || {} };
  return IDX;
}
function resolveDef(name, from) {
  if (!name) return null; const s = lastSeg(name); const l = IDX.defs.get(s); if (!l) return null;
  if (l.length === 1) return l[0];
  const want = name.replace(/^~/, '');
  if (want.includes('::')) { const q = l.find(d => d.qn === want || d.qn.endsWith('::' + want)); if (q) return q; }
  const ov = IDX.pick && IDX.pick[s]; if (ov) { const d = l.find(x => x.qn === ov); if (d) return d; }
  if (from) {
    let best = l[0], bs = -1; const fq = (from.qn || '').split('::');
    for (const d of l) { const dq = d.qn.split('::'); let k = 0; while (k < dq.length - 1 && k < fq.length && dq[k] === fq[k]) k++; const sc = k * 2 + (d.file && d.file === from.file ? 1 : 0); if (sc > bs) { bs = sc; best = d; } }
    return best;
  }
  return l[0];
}
function superDefs(el) {
  const names = el.isDef ? [...el.types, ...el.specs] : [...el.types];
  if (!el.isDef) for (const s of el.specs) { const d = resolveDef(s, el); if (d) names.push(s); }
  return names.map(n => resolveDef(n, el)).filter(d => d && d !== el);
}
function features(el, seen) {
  seen = seen || new Set(); if (!el || seen.has(el)) return []; seen.add(el);
  const res = el.children.filter(c => !c.isDef && c.kind !== 'package');
  const names = new Set(res.map(f => f.name));
  for (const s of superDefs(el)) for (const f of features(s, seen)) if (!names.has(f.name)) { res.push(f); names.add(f.name); }
  return res;
}
function relsOf(el, seen) {
  seen = seen || new Set(); if (!el || seen.has(el)) return []; seen.add(el);
  let r = [...el.rels];
  for (const s of superDefs(el)) r = r.concat(relsOf(s, seen));
  return r;
}
const isPartLike = f => !f.isDef && !f.dir && !f.stateAct && (f.kind === 'part' || f.kind === 'item' || (f.kind === 'feature' && f.types.some(t => { const d = resolveDef(t, f); return d && d.kind === 'part'; })));
const partsOf = el => features(el).filter(isPartLike);
const portsOf = el => features(el).filter(f => f.kind === 'port');
function portDir(p) {
  let dir = p.dir;
  if (!dir) {
    const t = p.types[0]; const d = resolveDef(t, p);
    if (d) {
      const ds = new Set(features(d).map(f => f.dir).filter(Boolean));
      if (ds.size === 1) dir = [...ds][0]; else if (ds.size > 1) dir = 'inout';
    }
    if (t && t.startsWith('~') && dir) dir = dir === 'in' ? 'out' : dir === 'out' ? 'in' : dir;
  }
  return dir || null;
}
const shortT = t => { if (!t) return ''; const c = t.startsWith('~'); return (c ? '~' : '') + lastSeg(t); };
function kindLabel(el) { const k = { usecase: 'use case', feature: '' }[el.kind] ?? el.kind; return el.isDef ? k + ' def' : k; }
function featLine(f) {
  let s = '';
  if (f.dir) s += f.dir + ' ';
  if (f.kind && !['feature', 'attribute', 'port', 'part'].includes(f.kind) && !f.role) s += f.kind + ' ';
  if (f.redefOnly) s += ':>> ';
  s += f.name || '';
  if (f.types.length) s += ' : ' + f.types.map(shortT).join(', ');
  if (f.mult) s += ' [' + f.mult + ']';
  if (f.value) s += ' = ' + f.value;
  return s;
}
function wrapText(t, n) { const words = t.split(/\s+/); const out = []; let cur = ''; for (const w of words) { if ((cur + ' ' + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } if (cur) out.push(cur); return out; }

/* ================= Diagram nodes ================= */
let measureText = (t) => t.length * 6.6;
const F = {
  st: 'italic 10.5px "IBM Plex Sans", system-ui, sans-serif',
  nm: '600 12.5px "IBM Plex Sans", system-ui, sans-serif',
  ln: '11px "IBM Plex Mono", ui-monospace, monospace',
  ct: 'italic 10.5px "IBM Plex Sans", system-ui, sans-serif',
  pl: '10.5px "IBM Plex Sans", system-ui, sans-serif',
  el: '10.5px "IBM Plex Sans", system-ui, sans-serif',
};
let NID = 0;
const nid = p => (p || 'n') + (++NID);
function node(o) { return Object.assign({ id: nid(), shape: 'box', comps: [], ports: [], children: [], portMap: {}, childMap: {} }, o); }
function measure(n) {
  for (const c of n.children) measure(c);
  if (n.shape === 'circle') { n.w = n.h = 20; n.headH = 0; return; }
  if (n.shape === 'bullseye') { n.w = n.h = 24; n.headH = 0; return; }
  if (n.shape === 'diamond') { n.w = 34; n.h = 26; n.headH = 0; return; }
  if (n.shape === 'bar') { n.w = 8; n.h = 46; n.headH = 0; return; }
  const sw = n.stereo ? measureText('«' + n.stereo + '»', F.st) : 0;
  const nw = measureText(n.name || '', F.nm);
  n.headH = (n.stereo ? 15 : 0) + 30;
  let w = Math.max(sw, nw) + 28, h = n.headH;
  if (!n.children.length) for (const c of n.comps) {
    if (!c.lines.length) continue;
    h += 7 + (c.title ? 15 : 0) + c.lines.length * 15 + 3;
    for (const l of c.lines) w = Math.max(w, measureText(l, c.font === 'ct' ? F.ct : F.ln) + 24);
    if (c.title) w = Math.max(w, measureText(c.title, F.ct) + 24);
  }
  if (n.ports.length && !n.children.length) {
    let wl = 0, wr = 0, nl = 0, nr = 0;
    for (const p of n.ports) { const lw = measureText(p.label, F.pl); if (p.side === 'WEST') { wl = Math.max(wl, lw); nl++; } else if (p.side === 'EAST') { wr = Math.max(wr, lw); nr++; } }
    w = Math.max(w, wl + wr + 46);
    h = Math.max(h, n.headH + Math.max(nl, nr) * 22 + 8);
  }
  n.w = Math.ceil(Math.max(w, n.minW || 96));
  n.h = Math.ceil(Math.max(h, n.minH || 44));
}
const PS = 10;
function toElk(n) {
  const e = { id: n.id, layoutOptions: {} };
  if (n.children.length) {
    e.children = n.children.map(toElk);
    e.layoutOptions['elk.padding'] = `[top=${n.headH + 14},left=24,bottom=20,right=24]`;
  } else { e.width = n.w; e.height = n.h; }
  if (n.ports.length) {
    const outside = n.children.length > 0;
    if (outside) {
      e.ports = n.ports.map(p => ({ id: p.id, width: PS, height: PS, layoutOptions: { 'elk.port.side': p.side }, labels: [{ id: p.id + 'l', text: p.label, width: measureText(p.label, F.pl) + 4, height: 13 }] }));
      e.layoutOptions['elk.portConstraints'] = 'FIXED_SIDE';
      e.layoutOptions['elk.portLabels.placement'] = 'OUTSIDE';
    } else {
      const k = { WEST: 0, EAST: 0, NORTH: 0, SOUTH: 0 };
      e.ports = n.ports.map(p => { const idx = k[p.side]++; const horiz = p.side === 'WEST' || p.side === 'EAST';
        return { id: p.id, width: PS, height: PS, x: p.side === 'WEST' ? -PS / 2 : p.side === 'EAST' ? n.w - PS / 2 : 14 + idx * 40, y: horiz ? n.headH + 2 + idx * 22 : (p.side === 'NORTH' ? -PS / 2 : n.h - PS / 2), layoutOptions: { 'elk.port.side': p.side } }; });
      e.layoutOptions['elk.portConstraints'] = 'FIXED_POS';
    }
  }
  return e;
}

/* ================= Views ================= */
function within(pkg) { const r = []; (function w(e) { for (const c of e.children) { r.push(c); w(c); } })(pkg); return r; }
function nearestPkg(el) { let e = el; while (e && e.kind !== 'package' && e.kind !== 'root') e = e.parent; return e && e.kind === 'package' ? e : null; }
const STRUCT_KINDS = ['part', 'item', 'port', 'attribute', 'interface', 'connection', 'enum', 'occurrence', 'allocation', 'flow', 'metadata', 'constraint', 'calc'];

function compsFor(el, inDiagram) {
  const own = el.children.filter(c => !c.isDef && c.kind !== 'package');
  const groups = [
    ['attributes', c => c.kind === 'attribute' || (c.kind === 'feature' && !c.dir && !c.role && el.kind !== 'enum')],
    ['literals', c => el.kind === 'enum' && (c.kind === 'enum' || c.kind === 'feature')],
    ['ends', c => c.role === 'end'],
    ['ports', c => c.kind === 'port'],
    ['directed features', c => !!c.dir && c.kind !== 'port'],
    ['parts', c => (c.kind === 'part' || (c.kind === 'item' && !c.dir)) && !c.role && !(c.types[0] && inDiagram(resolveDef(c.types[0], c)))],
    ['actions', c => c.kind === 'action' && !c.stateAct],
    ['states', c => c.kind === 'state'],
    ['interfaces', c => (c.kind === 'interface' || c.kind === 'connection') && !c.ends],
  ];
  const comps = []; const used = new Set();
  for (const [title, f] of groups) {
    const ls = own.filter(c => !used.has(c) && f(c));
    ls.forEach(c => used.add(c));
    if (ls.length) comps.push({ title, lines: ls.map(c => title === 'literals' ? c.name : (c.performed ? c.performed + ' ' : '') + featLine(c)) });
  }
  if (el.constraints) comps.push({ title: 'constraints', lines: el.constraints });
  return comps;
}

function viewStruct(scope, opt) {
  NID = 0;
  const pool = scope ? within(scope) : IDX.all;
  let defs = pool.filter(e => e.isDef && e.name && STRUCT_KINDS.includes(e.kind));
  if (!opt.ports) defs = defs.filter(d => !['port', 'item', 'flow'].includes(d.kind));
  if (!opt.attrs) defs = defs.filter(d => !['attribute', 'enum', 'constraint', 'calc', 'metadata'].includes(d.kind));
  const behav = opt.behav ? pool.filter(e => e.isDef && e.name && ['state', 'action', 'requirement', 'usecase', 'concern', 'analysis', 'verification'].includes(e.kind)) : [];
  const usages = opt.usages ? pool.filter(e => !e.isDef && e.name && (e.kind === 'part' || e.kind === 'item') && e.parent && (e.parent.kind === 'package' || e.parent.kind === 'root')) : [];
  const map = new Map();
  const roots = [], edges = [];
  for (const d of defs) { const n = node({ el: d, stereo: kindLabel(d), name: d.name, italic: d.mods.includes('abstract'), cls: 'k-' + d.kind }); map.set(d, n); roots.push(n); }
  for (const b of behav) { const n = node({ el: b, stereo: kindLabel(b), name: (b.short ? '[' + b.short + '] ' : '') + b.name, cls: 'k-' + b.kind, compact: true }); map.set(b, n); roots.push(n); }
  for (const u of usages) { const n = node({ el: u, stereo: u.kind, name: u.name + (u.types.length ? ' : ' + u.types.map(shortT).join(', ') : ''), cls: 'k-usage', rounded: true }); map.set(u, n); roots.push(n); }
  const inDiagram = d => d && map.has(d);
  let groupRoots = roots;
  if (opt.byFile) {
    const frames = new Map(); groupRoots = [];
    for (const n of roots) {
      const f = n.el.file; if (!f) { groupRoots.push(n); continue; }
      if (!frames.has(f)) { const fr = node({ stereo: L('struct.fileStereo'), name: f, cls: 'k-file' }); frames.set(f, fr); groupRoots.push(fr); }
      frames.get(f).children.push(n);
    }
  }
  let k = 0;
  for (const [el, n] of map) {
    if (opt.feats && !n.compact) n.comps = compsFor(el, inDiagram);
    if (el.isDef) for (const s of el.specs) { const sd = resolveDef(s, el); if (sd && map.has(sd)) edges.push({ id: 'e' + (++k), src: map.get(sd).id, tgt: n.id, cls: 'spec', ms: 'tri' }); }
    for (const c of el.children) {
      if (c.isDef) continue;
      const t = c.types[0] && resolveDef(c.types[0], c);
      if (!t || !map.has(t) || t === el) continue;
      if ((c.kind === 'state' || c.kind === 'action') && c.performed) edges.push({ id: 'e' + (++k), src: n.id, tgt: map.get(t).id, cls: 'typed', me: 'open', label: c.performed + ' ' + c.name });
      else if (isPartLike(c) || c.kind === 'part') edges.push({ id: 'e' + (++k), src: n.id, tgt: map.get(t).id, cls: 'comp', ms: c.mods.includes('ref') ? 'none' : 'diam', me: 'open', label: c.name + (c.mult ? ' [' + c.mult + ']' : '') });
      else if (opt.ports && (c.kind === 'port' || c.dir || c.role === 'end')) edges.push({ id: 'e' + (++k), src: n.id, tgt: map.get(t).id, cls: 'typed', me: 'open', label: c.name });
    }
    if (!el.isDef) for (const t of el.types) { const d = resolveDef(t, el); if (d && map.has(d)) edges.push({ id: 'e' + (++k), src: map.get(d).id, tgt: n.id, cls: 'defby', ms: 'tri', label: 'defined by' }); }
  }
  return { dir: 'DOWN', roots: groupRoots, edges, legend: ['comp', 'spec', 'typed', 'defby'], empty: roots.length ? null : L('struct.empty') };
}

const defsFirst = l => l.filter(e => e.isDef).concat(l.filter(e => !e.isDef));
function ibdCandidates() {
  return defsFirst(IDX.all.filter(e => e.name && (e.kind === 'part' || e.kind === 'item' || e.kind === 'connection' || e.kind === 'interface') && (e.isDef || (e.parent && ['package', 'root'].includes(e.parent.kind))) && partsOf(e).length)).sort((a, b) => (b.isDef - a.isDef) || (partsOf(b).length + relsOf(b).length) - (partsOf(a).length + relsOf(a).length));
}
function viewIBD(ctx, depth) {
  NID = 0;
  function mkN(el, lvl) {
    const n = node({ el, stereo: el.isDef ? kindLabel(el) : el.kind, name: el.isDef ? el.name : `${el.name}${el.types.length ? ' : ' + shortT(el.types[0]) : ''}${el.mult ? ' [' + el.mult + ']' : ''}`, cls: el.isDef ? 'k-' + el.kind : 'k-usage', rounded: !el.isDef });
    for (const p of portsOf(el)) { const pp = { id: nid('p'), el: p, label: p.name, dir: portDir(p), nsrc: 0, ntgt: 0 }; n.ports.push(pp); n.portMap[p.name] = pp; }
    if (lvl < depth) for (const c of partsOf(el)) { const cn = mkN(c, lvl + 1); cn.parentN = n; n.children.push(cn); n.childMap[c.name] = cn; }
    if (lvl >= depth && partsOf(el).length) n.collapsed = true;
    return n;
  }
  const root = mkN(ctx, 0);
  function resolveIn(n, ch) {
    const segs = ch.replace(/^~/, '').split('::').pop().split('.'); let cur = n, res = null;
    for (let k = 0; k < segs.length; k++) {
      const s = segs[k];
      if (cur.childMap[s]) { cur = cur.childMap[s]; res = { node: cur }; continue; }
      if (cur.portMap[s]) return { port: cur.portMap[s], node: cur };
      if (k === 0) return null; break;
    }
    return res;
  }
  const edges = []; let k = 0; const missing = [];
  (function walk(n) {
    for (const r of relsOf(n.el)) {
      if (!['connect', 'interface', 'flow', 'bind'].includes(r.type)) continue;
      const a = resolveIn(n, r.src), b = resolveIn(n, r.tgt);
      if (!a || !b) { missing.push(r); continue; }
      const sid = a.port ? a.port.id : a.node.id, tid = b.port ? b.port.id : b.node.id;
      if (sid === tid) continue;
      if (a.port) a.port.nsrc++; if (b.port) b.port.ntgt++;
      const inner = (p, nd) => p && nd === n; // port on the frame of the scope
      if (a.port) a.port.frame = a.port.frame || inner(a.port, a.node);
      if (b.port) b.port.frame = b.port.frame || inner(b.port, b.node);
      edges.push({ id: 'e' + (++k), src: sid, tgt: tid, cls: r.type === 'interface' ? 'iface' : r.type === 'flow' ? 'flow' : r.type === 'bind' ? 'bind' : 'conn', me: r.type === 'flow' ? 'fill' : null, label: r.type === 'bind' ? '=' : (r.label || ''), line: r.line, file: r.file || (r.owner && r.owner.file) });
    }
    n.children.forEach(walk);
  })(root);
  (function sides(n) {
    for (const p of n.ports) {
      let d = p.dir;
      if (!d || d === 'inout') d = p.nsrc > p.ntgt ? 'out' : p.ntgt > p.nsrc ? 'in' : 'out';
      p.side = d === 'in' ? 'WEST' : 'EAST';
      if (p.frame) p.side = d === 'in' ? 'WEST' : 'EAST';
    }
    n.children.forEach(sides);
  })(root);
  return { dir: 'RIGHT', roots: [root], edges, legend: ['conn', 'iface', 'flow', 'port'], note: missing.length ? Ln('ibd.missing', missing.length) : null };
}

function stateCandidates() { return defsFirst(IDX.all.filter(e => e.kind === 'state' && e.name && !e.stateAct && (e.isDef || !e.parent || e.parent.kind !== 'state') && (features(e).some(c => c.kind === 'state') || e.isDef))); }
function viewStates(ctx) {
  NID = 0; const global = new Map();
  function mkS(el, lvl) {
    const acts = ['entry', 'do', 'exit'].filter(k => el['act_' + k]).map(k => k + ' / ' + el['act_' + k]);
    const kids = features(el).filter(c => c.kind === 'state' && !c.isDef);
    const n = node({ el, stereo: lvl === 0 ? kindLabel(el) : null, name: lvl === 0 || !el.types.length ? el.name : el.name + ' : ' + shortT(el.types[0]), cls: 'k-state', rounded: true, comps: acts.length ? [{ lines: acts }] : [], names: {} });
    for (const c of kids) { const cn = mkS(c, lvl + 1); cn.parentN = n; n.children.push(cn); n.names[c.name] = cn; if (!global.has(c.name)) global.set(c.name, cn); }
    return n;
  }
  const root = mkS(ctx, 0);
  function pseudo(n, kind) {
    const key = '_' + kind; if (n[key]) return n[key];
    const p = node({ shape: kind === 'init' ? 'circle' : 'bullseye', cls: 'k-pseudo', pseudo: kind });
    p.parentN = n; n.children.push(p); n[key] = p; return p;
  }
  function res(n, name) {
    if (name === '__entry' || name === 'start') return pseudo(n, 'init');
    if (name === 'done') return pseudo(n, 'final');
    const s = lastSeg(name);
    for (let c = n; c; c = c.parentN) if (c.names && c.names[s]) return c.names[s];
    return global.get(s) || null;
  }
  const edges = []; let k = 0;
  (function walk(n) {
    if (n.pseudo) return;
    for (const r of relsOf(n.el)) {
      if (r.type !== 'transition' && r.type !== 'succession') continue;
      const a = res(n, r.src), b = res(n, r.tgt); if (!a || !b) continue;
      const lab = [r.trigger || '', r.guard ? '[' + r.guard + ']' : '', r.effect ? '/ ' + r.effect : ''].filter(Boolean).join(' ');
      edges.push({ id: 'e' + (++k), src: a.id, tgt: b.id, cls: 'trans', me: 'open', label: lab, line: r.line, file: r.file || (r.owner && r.owner.file) });
    }
    n.children.slice().forEach(walk);
  })(root);
  return { dir: 'RIGHT', roots: [root], edges, legend: ['trans', 'init', 'final'] };
}

const CTRL = { decide: 'diamond', merge: 'diamond', fork: 'bar', join: 'bar' };
function actionCandidates() { return defsFirst(IDX.all.filter(e => e.kind === 'action' && e.name && !e.anon && !e.stateAct && (e.isDef || !e.parent || !['action'].includes(e.parent.kind)) && features(e).some(c => !c.isDef && (BEHAV.has(c.kind))))); }
function viewActions(ctx) {
  NID = 0; const global = new Map();
  function mkA(el, lvl) {
    const shape = CTRL[el.kind] || 'box';
    const n = node({ el, shape, stereo: lvl === 0 ? kindLabel(el) : (el.kind === 'action' ? null : el.kind), name: shape === 'box' ? (el.anon ? '' : el.name) + (lvl > 0 && el.types.length ? ' : ' + shortT(el.types[0]) : '') : '', cls: 'k-action', rounded: true, names: {} });
    if (shape === 'box') for (const p of features(el).filter(f => f.dir && !f.isDef && !BEHAV.has(f.kind))) { const pp = { id: nid('p'), el: p, label: p.name, dir: p.dir, side: p.dir === 'in' ? 'WEST' : 'EAST' }; n.ports.push(pp); n.portMap[p.name] = pp; }
    const kids = features(el).filter(c => !c.isDef && BEHAV.has(c.kind) && c.kind !== 'state' && !c.stateAct);
    if (lvl < 2) for (const c of kids) { const cn = mkA(c, lvl + 1); cn.parentN = n; n.children.push(cn); n.names[c.name] = cn; if (!global.has(c.name)) global.set(c.name, cn); }
    return n;
  }
  const root = mkA(ctx, 0);
  function pseudo(n, kind) { const key = '_' + kind; if (n[key]) return n[key]; const p = node({ shape: kind === 'init' ? 'circle' : 'bullseye', cls: 'k-pseudo', pseudo: kind }); p.parentN = n; n.children.push(p); n[key] = p; return p; }
  function res(n, name) {
    if (name === 'start' || name === '__entry') return { node: pseudo(n, 'init') };
    if (name === 'done') return { node: pseudo(n, 'final') };
    const segs = name.split('::').pop().split('.');
    let target = null;
    for (let c = n; c; c = c.parentN) if (c.names && c.names[segs[0]]) { target = c.names[segs[0]]; break; }
    if (!target && segs.length === 1) { for (let c = n; c; c = c.parentN) if (c.portMap && c.portMap[segs[0]]) return { node: c, port: c.portMap[segs[0]] }; }
    if (!target) target = global.get(segs[0]);
    if (!target) return null;
    if (segs[1] && target.portMap[segs[1]]) return { node: target, port: target.portMap[segs[1]] };
    return { node: target };
  }
  const edges = []; let k = 0;
  (function walk(n) {
    if (n.pseudo) return;
    for (const r of relsOf(n.el)) {
      if (!['succession', 'flow', 'transition'].includes(r.type)) continue;
      const a = res(n, r.src), b = res(n, r.tgt); if (!a || !b) continue;
      const s = a.port ? a.port.id : a.node.id, t = b.port ? b.port.id : b.node.id;
      if (r.type === 'flow') edges.push({ id: 'e' + (++k), src: s, tgt: t, cls: 'flow', me: 'fill', label: r.label || '', line: r.line, file: r.file || (r.owner && r.owner.file) });
      else edges.push({ id: 'e' + (++k), src: a.node.id, tgt: b.node.id, cls: 'succ', me: 'open', label: r.guard ? '[' + r.guard + ']' : '', line: r.line, file: r.file || (r.owner && r.owner.file) });
    }
    n.children.slice().forEach(walk);
  })(root);
  return { dir: 'RIGHT', roots: [root], edges, legend: ['succ', 'flow', 'init', 'final'] };
}

function viewReqs(scope) {
  NID = 0;
  const pool = scope ? within(scope) : IDX.all;
  const reqs = pool.filter(e => (e.kind === 'requirement' || e.kind === 'concern') && e.name);
  const map = new Map(); const roots = [], edges = []; let k = 0;
  for (const r of reqs) {
    const comps = [];
    if (r.doc) comps.push({ lines: wrapText(r.doc, 40), font: 'ct' });
    const subj = r.children.filter(c => c.role === 'subject' || c.role === 'actor' || c.role === 'stakeholder');
    const attrs = r.children.filter(c => c.kind === 'attribute');
    if (subj.length) comps.push({ lines: subj.map(c => c.role + ' ' + featLine(c)) });
    if (attrs.length) comps.push({ title: 'attributes', lines: attrs.map(featLine) });
    if (r.constraints) comps.push({ title: 'constraints', lines: r.constraints });
    const nm = (r.short ? '[' + r.short + '] ' : '') + r.name + (!r.isDef && r.types.length ? ' : ' + r.types.map(shortT).join(', ') : '');
    const n = node({ el: r, stereo: kindLabel(r), name: nm, cls: 'k-requirement', rounded: !r.isDef, comps });
    map.set(r, n); roots.push(n);
  }
  for (const [r, n] of map) {
    if (r.parent && map.has(r.parent)) edges.push({ id: 'e' + (++k), src: map.get(r.parent).id, tgt: n.id, cls: 'contain', ms: 'plus' });
    if (!r.isDef) for (const t of r.types) { const d = resolveDef(t); if (d && map.has(d)) edges.push({ id: 'e' + (++k), src: map.get(d).id, tgt: n.id, cls: 'defby', ms: 'tri' }); }
    if (r.isDef) for (const s of r.specs) { const d = resolveDef(s); if (d && map.has(d)) edges.push({ id: 'e' + (++k), src: map.get(d).id, tgt: n.id, cls: 'spec', ms: 'tri' }); }
  }
  const findReq = name => { const s = lastSeg(name); const c = [...map.keys()].filter(e => e.name === s); return c.find(e => !e.isDef) || c[0]; };
  const sats = new Map();
  for (const e of [IDX.root, ...IDX.all]) for (const r of e.rels) {
    if (r.type !== 'satisfy') continue;
    const req = findReq(r.tgt); if (!req) continue;
    const label = r.src || (r.srcEl && r.srcEl.name) || '?';
    if (!sats.has(label)) {
      const cand = IDX.byName.get(lastSeg(label)); const sel = cand && (cand.find(c => !c.isDef) || cand[0]);
      const n = node({ el: sel || null, stereo: sel ? kindLabel(sel) : 'element', name: label, cls: sel && sel.isDef ? 'k-' + sel.kind : 'k-usage', rounded: !(sel && sel.isDef) });
      sats.set(label, n); roots.push(n);
    }
    edges.push({ id: 'e' + (++k), src: map.get(req).id, tgt: sats.get(label).id, cls: 'satisfy', ms: 'open', label: '«satisfy»', line: r.line, file: r.file || (r.owner && r.owner.file) });
  }
  return { dir: 'DOWN', roots, edges, legend: ['satisfy', 'contain', 'defby'], empty: map.size ? null : L('reqs.empty') };
}


/* ================= Mehrere Dateien ================= */
function parseFiles(files) {
  const root = { eid: 0, kind: 'root', isDef: false, name: null, children: [], rels: [], types: [], specs: [], redefs: [], refs: [], mods: [], parent: null, line: 0 };
  const warns = []; let eid = 0;
  files.forEach(f => {
    if (/\.json$/i.test(f.name)) return; // z. B. tour.json
    let r; try { r = parse(f.text); } catch (e) { warns.push({ file: f.name, line: 1, msg: 'Parser abgebrochen: ' + e.message }); return; }
    (function w(e) { for (const c of e.children) { c.eid = ++eid; c.file = f.name; for (const rl of c.rels) rl.file = f.name; w(c); } })(r.root);
    for (const c of r.root.children) { c.parent = root; root.children.push(c); }
    for (const rl of r.root.rels) { rl.owner = root; rl.file = f.name; root.rels.push(rl); }
    for (const x of r.warns) warns.push(Object.assign({ file: f.name }, x));
  });
  return { root, warns };
}

/* ================= Detailansicht ================= */
const OPENABLE = ['part', 'item', 'port', 'interface', 'connection', 'occurrence'];
const isOpenable = el => !!el && OPENABLE.includes(el.kind) && !!el.name && !el.anon;
function detailComps(el, hasInner) {
  const own = new Set(el.children);
  const feats = features(el).filter(f => !f.isDef && f.kind !== 'package');
  const groups = [
    ['attributes', f => f.kind === 'attribute' || (f.kind === 'feature' && !f.dir && !f.role)],
    ['ports', f => f.kind === 'port'],
    ['parts', f => isPartLike(f)],
    ['directed features', f => !!f.dir],
    ['ends', f => f.role === 'end'],
    ['actions', f => f.kind === 'action' && !f.stateAct],
    ['states', f => f.kind === 'state'],
    ['connections', f => !hasInner && (f.kind === 'interface' || f.kind === 'connection')],
  ];
  const comps = [], used = new Set();
  for (const [t, fn] of groups) {
    const ls = feats.filter(f => !used.has(f) && fn(f)); ls.forEach(f => used.add(f));
    if (ls.length) comps.push({ title: t, lines: ls.map(f => (own.has(f) ? '' : '^') + (f.performed ? f.performed + ' ' : '') + featLine(f)) });
  }
  const cons = [...(el.constraints || [])]; for (const d of superDefs(el)) if (d.constraints) cons.push(...d.constraints.map(c => '^' + c));
  if (cons.length) comps.push({ title: 'constraints', lines: cons });
  return comps;
}
function viewDetail(el) {
  const ibd = partsOf(el).length ? viewIBD(el, 1) : null; if (!ibd) NID = 0;
  const roots = [], edges = []; let k = 0; const E = o => edges.push(Object.assign({ id: 'd' + (++k) }, o));
  const label = d => d.isDef ? d.name : d.name + (d.types.length ? ' : ' + d.types.map(shortT).join(', ') : '') + (d.mult ? ' [' + d.mult + ']' : '');
  const center = node({ el, stereo: kindLabel(el), name: label(el), italic: el.mods.includes('abstract'), cls: (el.isDef ? 'k-' + el.kind : 'k-usage') + ' center', rounded: !el.isDef, comps: detailComps(el, !!ibd), minW: 180 });
  roots.push(center);
  const seen = new Map([[el, center]]);
  const ref = d => { if (seen.has(d)) return seen.get(d); const n = node({ el: d, stereo: kindLabel(d), name: label(d), italic: d.mods.includes('abstract'), cls: d.isDef ? 'k-' + d.kind : 'k-usage', rounded: !d.isDef }); seen.set(d, n); roots.push(n); return n; };
  function climb(d, n, lvl) { if (lvl > 5) return; for (const s of d.specs) { const sd = resolveDef(s, d); if (sd && sd !== d) { const had = seen.has(sd); const sn = ref(sd); E({ src: sn.id, tgt: n.id, cls: 'spec', ms: 'tri' }); if (!had) climb(sd, sn, lvl + 1); } } }
  if (el.isDef) climb(el, center, 0);
  else for (const t of el.types) { const d = resolveDef(t, el); if (d) { const had = seen.has(d); const dn = ref(d); E({ src: dn.id, tgt: center.id, cls: 'defby', ms: 'tri' }); if (!had) climb(d, dn, 1); } }
  let usedIn = 0;
  if (el.isDef) {
    const users = IDX.all.filter(u => !u.isDef && u.types.some(t => resolveDef(t, u) === el) && u.parent && u.parent.name && u.parent !== el);
    usedIn = users.length;
    for (const u of users.slice(0, 12)) {
      if (u.parent.kind === 'package') { const un = ref(u); E({ src: center.id, tgt: un.id, cls: 'defby', ms: 'tri' }); continue; }
      const on = ref(u.parent); const comp = isPartLike(u) || u.kind === 'part';
      E({ src: on.id, tgt: center.id, cls: comp ? 'comp' : 'typed', ms: comp ? 'diam' : null, me: 'open', label: (u.role ? u.role + ' ' : u.kind === 'port' ? 'port ' : '') + u.name + (u.mult ? ' [' + u.mult + ']' : '') });
    }
  } else if (el.parent && el.parent.name && el.parent.kind !== 'package') {
    const on = ref(el.parent); E({ src: on.id, tgt: center.id, cls: 'comp', ms: 'diam', me: 'open', label: el.name });
  }
  // erfüllte Anforderungen
  const ownerChain = []; for (let e = el; e && e.kind !== 'package' && e.kind !== 'root'; e = e.parent) ownerChain.unshift(e.name);
  for (const holder of [IDX.root, ...IDX.all]) for (const r of holder.rels) {
    if (r.type !== 'satisfy') continue;
    const hit = r.srcEl ? r.srcEl === el : (r.src && lastSeg(r.src) === el.name && (r.src.split('.').length === 1 || ownerChain.length < 2 || r.src.split('.').slice(-2)[0] === ownerChain[ownerChain.length - 2] || IDX.all.some(u => u.name === r.src.split('.').slice(-2)[0] && u.types.some(t => resolveDef(t, u) === el.parent))));
    if (!hit) continue;
    const cand = (IDX.byName.get(lastSeg(r.tgt)) || []).filter(x => x.kind === 'requirement');
    const req = cand.find(x => !x.isDef) || cand[0]; if (!req) continue;
    const rn = ref(req); E({ src: rn.id, tgt: center.id, cls: 'satisfy', ms: 'open', label: '«satisfy»', line: r.line, file: r.file });
  }
  if (ibd) {
    const fr = ibd.roots[0]; fr.stereo = 'innere Struktur'; fr.name = label(el); fr.inner = true; roots.push(fr);
    for (const e of ibd.edges) edges.push(e);
    E({ src: center.id, tgt: fr.id, cls: 'inner', me: 'open', label: L('detail.consistsOf') });
  }
  return { dir: 'DOWN', roots, edges, usedIn, legend: ['comp', 'spec', 'defby', 'typed', 'satisfy', 'conn', 'iface', 'flow', 'port'], note: ibd && ibd.note };
}

/* ================= Layout & render ================= */
function elkGraph(model) {
  model.roots.forEach(measure);
  const owner = {}, nodes = {};
  (function w(ns, par) { for (const n of ns) { n.parentN = par; nodes[n.id] = n; owner[n.id] = n; for (const p of n.ports) owner[p.id] = n; w(n.children, n); } })(model.roots, null);
  const anc = n => { const r = []; for (let c = n; c; c = c.parentN) r.push(c); return r; };
  const isDesc = (a, b) => { for (let c = a; c; c = c.parentN) if (c === b) return true; return false; };
  const children = model.roots.map(toElk);
  const elkById = {}; (function w(es) { for (const e of es) { elkById[e.id] = e; if (e.children) w(e.children); } })(children);
  const rootEdges = [];
  for (const e of model.edges) {
    const na = owner[e.src], nb = owner[e.tgt]; if (!na || !nb) continue;
    const ca = isDesc(nb, na) && nb !== na ? na : na.parentN;
    const cb = isDesc(na, nb) && na !== nb ? nb : nb.parentN;
    const A = anc(ca); let cont = null; for (let c = cb; c; c = c.parentN) if (A.includes(c)) { cont = c; break; }
    e.container = cont ? cont.id : null;
    const ee = { id: e.id, sources: [e.src], targets: [e.tgt], labels: e.label ? [{ id: e.id + 'l', text: e.label, width: measureText(e.label, F.el) + 6, height: 14 }] : [] };
    if (cont) { const en = elkById[cont.id]; (en.edges || (en.edges = [])).push(ee); } else rootEdges.push(ee);
  }
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered', 'elk.direction': model.dir, 'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.edgeRouting': 'ORTHOGONAL', 'elk.spacing.nodeNode': '34', 'elk.layered.spacing.nodeNodeBetweenLayers': '56',
      'elk.spacing.edgeNode': '18', 'elk.spacing.edgeEdge': '12', 'elk.spacing.edgeLabel': '4', 'elk.spacing.labelNode': '6',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX', 'elk.padding': '[top=14,left=14,bottom=14,right=14]',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    },
    children, edges: rootEdges,
  };
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MARKERS = `<marker id="m-tri" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M1,1 L13,7 L1,13 Z" class="mk-hollow"/></marker>
<marker id="m-diam" viewBox="0 0 18 10" refX="17" refY="5" markerWidth="18" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M1,5 L9,1 L17,5 L9,9 Z" class="mk-solid"/></marker>
<marker id="m-open" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M1,1 L11,6 L1,11" class="mk-line"/></marker>
<marker id="m-fill" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M1,1 L11,6 L1,11 Z" class="mk-flow"/></marker>
<marker id="m-plus" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><circle cx="7" cy="7" r="5.5" class="mk-hollow"/><path d="M7,2.5 V11.5 M2.5,7 H11.5" class="mk-line"/></marker>`;

function renderSVG(model, g) {
  const byId = new Map(); const out = []; const top = [];
  (function idx(ns) { for (const n of ns) { byId.set(n.id, n); idx(n.children); } })(model.roots);
  const absPos = {};
  function drawNode(gn, ox, oy) {
    const n = byId.get(gn.id); if (!n) return;
    const x = ox + gn.x, y = oy + gn.y, w = gn.width, h = gn.height; absPos[gn.id] = [x, y];
    const amb = n.el && n.el.isDef && n.el.name && (IDX.defs.get(n.el.name) || []).length > 1;
    const attrs = `class="nd ${n.cls || ''}${n.collapsed ? ' collapsed' : ''}${amb ? ' amb' : ''}" data-id="${n.id}" data-shape="${n.shape}"${n.pseudo ? ` data-pseudo="${n.pseudo}"` : ''}${n.rounded ? ' data-usage="1"' : ''}${n.el ? ` data-eid="${n.el.eid}"` : ''}`;
    if (n.shape === 'circle') { out.push(`<g ${attrs}><circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w / 2 - 1}" class="ps-fill"/></g>`); }
    else if (n.shape === 'bullseye') { out.push(`<g ${attrs}><circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w / 2 - 1}" class="ps-ring"/><circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w / 2 - 6}" class="ps-fill"/></g>`); }
    else if (n.shape === 'diamond') { out.push(`<g ${attrs}><path d="M${x + w / 2},${y} L${x + w},${y + h / 2} L${x + w / 2},${y + h} L${x},${y + h / 2} Z" class="nb"/>${n.el && !n.el.anon ? `<text x="${x + w / 2}" y="${y - 5}" text-anchor="middle" class="st">${esc(n.el.name)}</text>` : ''}</g>`); }
    else if (n.shape === 'bar') { out.push(`<g ${attrs}><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" class="ps-fill"/></g>`); }
    else {
      const rx = n.rounded ? 10 : 1.5; const comp = gn.children && gn.children.length;
      out.push(`<g ${attrs}><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="nb${comp ? ' frame' : ''}"/>`);
      if (amb) out.push(`<g class="ambm"><title>Name mehrfach definiert</title><circle cx="${x + w - 10}" cy="${y + 10}" r="6.5"/><text x="${x + w - 10}" y="${y + 13.5}" text-anchor="middle">!</text></g>`);
      const cx = x + w / 2; let ty = y + 17;
      if (n.stereo) { out.push(`<text x="${cx}" y="${ty}" text-anchor="middle" class="st">«${esc(n.stereo)}»</text>`); ty += 15; }
      const solo = !n.stereo && !comp && !n.comps.some(c => c.lines.length) && !n.ports.length; if (solo) ty = y + h / 2 + 4.5;
      out.push(`<text x="${cx}" y="${ty + (n.stereo || solo ? 0 : 3)}" text-anchor="middle" class="nm${n.italic ? ' it' : ''}">${esc(n.name || '')}</text>`);
      if (n.collapsed) out.push(`<text x="${x + w - 8}" y="${y + h - 7}" text-anchor="end" class="ct">⋯</text>`);
      let cy = y + n.headH;
      if (!comp) for (const c of n.comps) {
        if (!c.lines.length) continue;
        out.push(`<line x1="${x}" x2="${x + w}" y1="${cy}" y2="${cy}" class="sep"/>`); cy += 7;
        if (c.title) { cy += 11; out.push(`<text x="${cx}" y="${cy}" text-anchor="middle" class="ct">${esc(c.title)}</text>`); cy += 4; }
        for (const l of c.lines) { cy += 13; out.push(`<text x="${x + 12}" y="${cy}" class="${c.font === 'ct' ? 'ct dc' : 'ln'}">${esc(l)}</text>`); cy += 2; }
        cy += 3;
      }
      out.push('</g>');
    }
    if (gn.children) for (const c of gn.children) drawNode(c, x, y);
    if (gn.ports) for (const gp of gn.ports) {
      const p = n.ports.find(q => q.id === gp.id); if (!p) continue;
      const px = x + gp.x, py = y + gp.y; const comp = gn.children && gn.children.length;
      const side = px <= x + 1 ? 'W' : px >= x + w - PS - 1 ? 'E' : py <= y + 1 ? 'N' : 'S';
      let arrow = '';
      const pointsRight = (side === 'W' && p.dir === 'in') || (side === 'E' && p.dir === 'out');
      const pointsLeft = (side === 'W' && p.dir === 'out') || (side === 'E' && p.dir === 'in');
      const mx = px + PS / 2, my = py + PS / 2;
      if (pointsRight) arrow = `<path d="M${mx - 2.5},${my - 3} L${mx + 2.5},${my} L${mx - 2.5},${my + 3} Z" class="pa"/>`;
      if (pointsLeft) arrow = `<path d="M${mx + 2.5},${my - 3} L${mx - 2.5},${my} L${mx + 2.5},${my + 3} Z" class="pa"/>`;
      let lx, ly = py + PS / 2 + 3.5, anchor;
      const inside = !comp;
      if (side === 'W') { anchor = inside ? 'start' : 'end'; lx = inside ? px + PS + 4 : px - 4; }
      else if (side === 'E') { anchor = inside ? 'end' : 'start'; lx = inside ? px - 4 : px + PS + 4; }
      else { anchor = 'middle'; lx = px + PS / 2; ly = side === 'N' ? (inside ? py + PS + 11 : py - 4) : (inside ? py - 4 : py + PS + 11); }
      top.push(`<g class="port" data-eid="${p.el ? p.el.eid : ''}"><rect x="${px}" y="${py}" width="${PS}" height="${PS}" class="pt"/>${arrow}<text x="${lx}" y="${ly}" text-anchor="${anchor}" class="pl">${esc(p.label)}</text></g>`);
    }
  }
  for (const c of g.children || []) drawNode(c, 0, 0);
  const edgeOut = [];
  const emap = new Map(model.edges.map(e => [e.id, e]));
  const allEdges = []; (function w(gn, ox, oy) { for (const e of gn.edges || []) allEdges.push([e, ox, oy]); for (const c of gn.children || []) w(c, ox + c.x, oy + c.y); })(g, 0, 0);
  for (const [ge, ox, oy] of allEdges) {
    const e = emap.get(ge.id); if (!e || !ge.sections) continue;
    let d = '';
    for (const s of ge.sections) { d += `M${ox + s.startPoint.x},${oy + s.startPoint.y} `; for (const b of s.bendPoints || []) d += `L${ox + b.x},${oy + b.y} `; d += `L${ox + s.endPoint.x},${oy + s.endPoint.y} `; }
    const ms = e.ms && e.ms !== 'none' ? ` marker-start="url(#m-${e.ms})"` : '';
    const me = e.me ? ` marker-end="url(#m-${e.me})"` : '';
    edgeOut.push(`<path d="${d.trim()}" class="e e-${e.cls}"${ms}${me}${e.line ? ` data-line="${e.line}"` : ''}${e.file ? ` data-file="${esc(e.file)}"` : ''}/>`);
    for (const l of ge.labels || []) edgeOut.push(`<text x="${ox + l.x + 3}" y="${oy + l.y + 10.5}" class="el el-${e.cls}">${esc(l.text)}</text>`);
  }
  const W = Math.ceil(g.width || 100), H = Math.ceil(g.height || 100);
  return { W, H, defs: MARKERS, body: out.join('') + edgeOut.join('') + top.join('') };
}


/* ================= Rückverfolgung: Trace-Graph ================= */
const STAGES = ['req', 'struct', 'iface', 'behav', 'test'].map(id => ({ id, get label() { return L('stage.' + id); }, get q() { return L('stage.' + id + '.q'); } }));
function stageOf(el) {
  if (!el || !el.kind) return null;
  const k = el.kind;
  if (el.stateAct || el.role) return null;
  if (['requirement', 'concern', 'usecase'].includes(k)) return 'req';
  if (['verification', 'analysis'].includes(k)) return 'test';
  if (['port', 'interface', 'connection', 'flow', 'message'].includes(k)) return 'iface';
  if (['action', 'state', 'calc', 'constraint'].includes(k) && !el.anon) return 'behav';
  if (['part', 'item', 'occurrence', 'allocation'].includes(k) && !el.dir) return 'struct';
  return null;
}
function dispName(el) {
  if (!el) return '?';
  if (el.name && !el.anon) {
    const pre = el.kind === 'port' && el.parent && el.parent.name && el.parent.kind !== 'package' ? el.parent.name + '.' : '';
    return pre + (el.isDef || !el.types.length ? el.name : el.name + ' : ' + el.types.map(shortT).join(', '));
  }
  const t = el.types.length ? ' : ' + shortT(el.types[0]) : '';
  return el.kind + t + (el.ends ? ' (' + el.ends.join(' ↔ ') + ')' : '');
}
function resolveChain(chain, ctx) {
  if (!chain) return null;
  chain = chain.replace(/^~/, '');
  const dot = chain.split('.'); const head = dot[0]; let start = null;
  if (head.includes('::')) {
    start = IDX.all.find(e => e.qn === head) || IDX.all.find(e => e.qn && e.qn.endsWith('::' + head)) || null;
    if (!start) { const l = IDX.byName.get(lastSeg(head)) || []; start = l[0] || null; }
  } else {
    for (let e = ctx; e && !start; e = e.parent) {
      const pool = e.kind === 'root' ? e.children : features(e).concat(e.children.filter(c => c.isDef || c.kind === 'package'));
      start = pool.find(x => x.name === head) || null;
    }
    if (!start) { const l = IDX.byName.get(head) || []; start = l.find(x => !x.isDef) || l[0] || null; }
  }
  if (!start) return null;
  const path = [start]; let cur = start;
  for (const s of dot.slice(1)) { const nx = features(cur).find(f => f.name === s); if (!nx) break; path.push(nx); cur = nx; }
  return { el: cur, path };
}
let TR = { edges: [], out: new Map(), inn: new Map(), broken: [], links: [] };
function buildTrace() {
  const edges = [], out = new Map(), inn = new Map(), broken = [], links = [];
  const miss = (r, holder, which, chain) => broken.push({ type: r.type, which, chain, line: r.line, file: r.file || holder.file, holder });
  const push = (m, k, e) => { if (!m.has(k)) m.set(k, []); m.get(k).push(e); };
  const add = (a, b, type, x) => {
    if (!a || !b || a === b) return;
    if ((out.get(a) || []).some(e => e.b === b && e.type === type)) return;
    const e = Object.assign({ a, b, type }, x || {}); edges.push(e); push(out, a, e); push(inn, b, e);
  };
  const testOwner = e => { for (let x = e; x; x = x.parent) if (['verification', 'analysis', 'usecase'].includes(x.kind) && x.name) return x; return e; };
  for (const el of IDX.all) {
    const info = { line: el.line, file: el.file };
    if (!el.isDef && el.kind !== 'package') for (const t of el.types) { const d = resolveDef(t, el); if (d) add(el, d, 'typed', info); }
    if (el.isDef) for (const s of el.specs) { const d = resolveDef(s, el); if (d) add(el, d, 'spec', info); }
    if (!el.isDef && el.specs.length && stageOf(el) === 'req') for (const s of el.specs) { const r = resolveChain(s, el.parent); if (r) add(el, r.el, 'spec', info); }
    if (el.parent && stageOf(el) && stageOf(el.parent) && !el.anon && !el.isDef) add(el.parent, el, el.performed ? 'perform' : 'owns', info);
    if (el.role === 'subject' && el.parent) { const owner = testOwner(el.parent); for (const t of el.types) { const d = resolveDef(t, el); if (d) add(owner, d, 'subject', info); } }
    if (el.meta && el.meta.includes('derivation')) {
      const ends = el.children.filter(c => c.role === 'end');
      const o = ends.find(c => c.meta && c.meta.includes('original'));
      const a = o && resolveChain(o.refs[0] || o.types[0] || o.name, el.parent);
      for (const d of ends.filter(c => c.meta && c.meta.includes('derive'))) { const b = resolveChain(d.refs[0] || d.types[0] || d.name, el.parent); if (a && b) add(a.el, b.el, 'derive', info); }
    }
  }
  for (const holder of [IDX.root, ...IDX.all]) for (const r of holder.rels) {
    const info = { line: r.line, file: r.file || holder.file };
    if (r.type === 'satisfy') { const a = r.srcEl ? { el: r.srcEl } : resolveChain(r.src, holder); const b = resolveChain(r.tgt, holder); if (!a) miss(r, holder, 'src', r.src); if (!b) miss(r, holder, 'tgt', r.tgt); if (a && b) add(a.el, b.el, 'satisfy', info); }
    else if (r.type === 'verify') { const b = resolveChain(r.tgt, holder); if (b) add(testOwner(r.srcEl || holder), b.el, 'verify', info); else miss(r, holder, 'tgt', r.tgt); }
    else if (r.type === 'allocate') { const a = resolveChain(r.src, holder), b = resolveChain(r.tgt, holder); if (!a) miss(r, holder, 'src', r.src); if (!b) miss(r, holder, 'tgt', r.tgt); if (a && b) add(a.el, b.el, 'allocate', info); }
    else if (r.type === 'dependency') {
      const a = resolveChain(r.src, holder), b = resolveChain(r.tgt, holder); if (!a || !b) continue;
      const m = r.meta || [];
      if (m.includes('derivation')) add(b.el, a.el, 'derive', info); else if (m.includes('refinement')) add(a.el, b.el, 'refine', info); else add(a.el, b.el, 'depend', info);
    }
    else if (['connect', 'interface', 'flow', 'bind'].includes(r.type)) {
      const a = resolveChain(r.src, holder), b = resolveChain(r.tgt, holder);
      if (!a) miss(r, holder, 'src', r.src); if (!b) miss(r, holder, 'tgt', r.tgt); if (!a || !b) continue;
      const portOf = p => { const ps = p.path.filter(x => x.kind === 'port'); return ps.length ? ps[ps.length - 1] : p.el; };
      const pa = portOf(a), pb = portOf(b), ua = a.path[0], ub = b.path[0];
      const t = r.type === 'flow' ? 'flow' : r.type === 'bind' ? 'bind' : 'connect';
      const lab = r.label || (r.el && r.el.types[0] ? shortT(r.el.types[0]) : '');
      add(pa, pb, t, Object.assign({ label: lab }, info));
      links.push({ type: t, pa, pb, ua, ub, deleg: (a.path.length === 1) !== (b.path.length === 1), label: lab, holder, line: r.line, file: info.file });
      if (ua !== pa || ub !== pb) if (ua !== ub) add(ua, ub, t, Object.assign({ label: lab, via: (pa.name || '') + ' → ' + (pb.name || '') }, info));
      if (r.el) { add(r.el, pa, 'end', info); add(r.el, pb, 'end', info); }
    }
  }
  TR = { edges, out, inn, broken, links }; DISC = null;
  return TR;
}
const trOut = (x, t) => (TR.out.get(x) || []).filter(e => !t || e.type === t).map(e => e.b);
const trIn = (x, t) => (TR.inn.get(x) || []).filter(e => !t || e.type === t).map(e => e.a);
const TRACE_TYPES = ['satisfy', 'verify', 'derive', 'refine', 'allocate'];
function traceNeighbors(F) {
  // Jede Beziehung trägt einen Schlüssel k (satisfy, verify, owns …) – die Oberfläche erkennt Lücken daran, nicht am Text.
  const res = new Map();
  const put = (el, k, text, indirect, edge) => {
    if (!el || el === F || !stageOf(el)) return;
    let r = res.get(el); if (!r) { r = { el, labels: [], indirect: true, edges: [], trace: false }; res.set(el, r); }
    if (!r.labels.some(x => x.text === text)) r.labels.push({ k, text });
    if (!indirect) r.indirect = false;
    if (edge) { r.edges.push(edge); if (TRACE_TYPES.includes(edge.type)) r.trace = true; }
  };
  const via = e => e.via ? ' (' + e.via + ')' : '';
  for (const e of TR.out.get(F) || []) put(e.b, e.type, L('rel.' + e.type + '.out') + via(e), false, e);
  for (const e of TR.inn.get(F) || []) put(e.a, e.type, L('rel.' + e.type + '.in') + via(e), false, e);
  const st = stageOf(F);
  const group = [F, ...trOut(F, 'typed'), ...trIn(F, 'typed')];
  if (st === 'req') {
    for (const g of group) if (g !== F) { for (const s of trIn(g, 'satisfy')) put(s, 'satisfy', L('nb.satisfies', { x: dispName(g) }), true, { type: 'satisfy' }); for (const v of trIn(g, 'verify')) put(v, 'verify', L('nb.verifies', { x: dispName(g) }), true, { type: 'verify' }); }
    for (const c of trOut(F, 'owns')) { for (const s of trIn(c, 'satisfy')) put(s, 'satisfy', L('nb.satisfiesSub', { x: dispName(c) }), true, { type: 'satisfy' }); for (const v of trIn(c, 'verify')) put(v, 'verify', L('nb.verifiesSub', { x: dispName(c) }), true, { type: 'verify' }); }
    for (const s of trIn(F, 'satisfy')) {
      for (const p of features(s).filter(f => f.kind === 'port')) put(p, 'port', L('nb.portOf', { x: dispName(s) }), true);
      for (const b of features(s).filter(f => (f.kind === 'action' || f.kind === 'state') && f.performed)) put(b, 'perform', L(b.performed === 'perform' ? 'nb.performedBy' : 'nb.exhibitedBy', { x: s.name }), true);
      for (const o of [...trOut(s, 'connect'), ...trIn(s, 'connect'), ...trOut(s, 'flow'), ...trIn(s, 'flow')]) if (stageOf(o) === 'struct') put(o, 'connect', L('nb.partnerOf', { x: s.name }), true);
      for (const v of trIn(s, 'subject')) put(v, 'subject', L('nb.tests', { x: s.name }), true, { type: 'subject' });
    }
  }
  if (st === 'struct') {
    const fs = features(F);
    for (const p of fs.filter(f => f.kind === 'port')) {
      put(p, 'port', L('nb.hasPort'), false);
      for (const e of [...(TR.out.get(p) || []), ...(TR.inn.get(p) || [])]) {
        if (e.type === 'connect' || e.type === 'flow' || e.type === 'bind') { const o = e.a === p ? e.b : e.a; put(o, 'connect', L('nb.counterpart', { p: p.name }) + (e.label ? ' (' + e.label + ')' : ''), true); }
        if (e.type === 'end') put(e.a, 'connect', L('nb.connectionAt', { p: p.name }), true);
      }
    }
    for (const b of fs.filter(f => (f.kind === 'action' || f.kind === 'state') && f.performed)) put(b, 'perform', L(b.performed === 'perform' ? 'nb.performs' : 'nb.exhibits'), false);
    for (const g of group) {
      for (const r of trOut(g, 'satisfy')) { put(r, 'satisfy', g === F ? L('rel.satisfy.out') : L('nb.satisfiesAs', { x: dispName(g) }), g !== F, { type: 'satisfy' }); for (const v of trIn(r, 'verify')) put(v, 'verify', L('nb.checks', { x: dispName(r) }), true, { type: 'verify' }); }
      for (const t of trIn(g, 'subject')) put(t, 'subject', L(stageOf(t) === 'test' ? 'nb.tests' : 'nb.concerns', { x: dispName(g) }), g !== F, { type: 'subject' });
    }
    for (let p = F.parent; p; p = p.parent) if (stageOf(p) === 'struct') { for (const r of trOut(p, 'satisfy')) put(r, 'satisfy', L('nb.satisfiesVia', { x: p.name }), true, { type: 'satisfy' }); break; }
  }
  if (st === 'test') {
    for (const r of trOut(F, 'verify')) for (const s of trIn(r, 'satisfy')) put(s, 'satisfy', L('nb.implements', { x: dispName(r) }), true, { type: 'satisfy' });
    for (const d of trOut(F, 'subject')) for (const u of trIn(d, 'typed')) if (stageOf(u) === 'struct') put(u, 'subject', L('nb.unitUnderTest', { x: d.name }), true);
  }
  if (st === 'iface') {
    if (!F.isDef) { const owners = IDX.all.filter(x => stageOf(x) === 'struct' && x.children.includes(F)); for (const o of owners) put(o, 'owns', L('nb.belongsTo'), false); }
    for (const u of trIn(F, 'typed')) for (const p of trOut(u, 'end')) put(p, 'connect', L('nb.endOf', { x: dispName(u) }), true);
    if (F.isDef) for (const u of trIn(F, 'typed')) if (u.kind === 'port' && u.parent && stageOf(u.parent) === 'struct') put(u.parent, 'port', L('nb.usesPort', { p: u.name }), true);
    for (const p of trOut(F, 'end')) { const owner = IDX.all.find(x => stageOf(x) === 'struct' && x.children.includes(p)); if (owner) put(owner, 'owns', L('nb.portBelongsTo', { p: p.name }), true); }
  }
  return [...res.values()];
}

/* Auswirkungsanalyse: gerichtete Ausbreitung mit Begründung */
function impactOf(F, maxDepth) {
  const seen = new Map([[F, { depth: 0, from: null, reason: L('imp.origin'), mode: 'full' }]]);
  const q = [F];
  function nexts(x, mode) {
    const r = []; const st = stageOf(x); const n = dispName(x);
    if (mode === 'check') { for (const v of trIn(x, 'verify')) r.push([v, L('imp.retest', { x: n }), 'stop']); return r; }
    if (mode === 'stop') return r;
    for (const u of trIn(x, 'typed')) r.push([u, L('imp.isOfType', { x: n }), 'full']);
    for (const u of trIn(x, 'spec')) r.push([u, L('imp.specializes', { x: n }), 'full']);
    if (!x.isDef) for (const o of trIn(x, 'owns')) r.push([o, L('imp.contains', { x: n }), 'owner']);
    if (st === 'iface' && !x.isDef) { for (const o of IDX.all.filter(y => stageOf(y) === 'struct' && y.children.includes(x))) r.push([o, L('imp.ownsPort', { x: n }), 'owner']); }
    if (mode === 'owner') { for (const rq of trOut(x, 'satisfy')) r.push([rq, L('imp.recheck', { x: n }), 'check']); return r; }
    for (const e of [...(TR.out.get(x) || []), ...(TR.inn.get(x) || [])]) if (['connect', 'flow', 'bind'].includes(e.type)) { const o = e.a === x ? e.b : e.a; r.push([o, e.label ? L('imp.connectedVia', { x: n, via: e.label }) : L('imp.connected', { x: n }), 'stop']); }
    for (const u of trIn(x, 'end')) r.push([u, L('imp.ifaceUses', { x: n }), 'stop']);
    for (const rq of trOut(x, 'satisfy')) r.push([rq, L('imp.recheck', { x: n }), 'check']);
    for (const v of trIn(x, 'verify')) r.push([v, L('imp.adaptTest', { x: n }), 'stop']);
    for (const v of trIn(x, 'subject')) r.push([v, L(stageOf(v) === 'test' ? 'imp.subjectTest' : 'imp.subjectOther', { x: n }), 'stop']);
    for (const a of trIn(x, 'allocate')) r.push([a, L('imp.allocated', { x: n }), 'stop']);
    for (const p of trIn(x, 'perform')) r.push([p, L('imp.performs', { x: n }), 'owner']);
    if (st === 'req') {
      for (const s of trIn(x, 'satisfy')) r.push([s, L('imp.mustSatisfy', { x: n }), 'stop']);
      for (const d of trOut(x, 'derive')) r.push([d, L('imp.derivedFrom', { x: n }), 'full']);
      for (const d of trIn(x, 'refine')) r.push([d, L('imp.refines', { x: n }), 'full']);
      for (const c of trOut(x, 'owns')) if (stageOf(c) === 'req') r.push([c, L('imp.subReq', { x: n }), 'full']);
    }
    return r;
  }
  while (q.length) {
    const x = q.shift(); const cur = seen.get(x); if (cur.depth >= maxDepth) continue;
    for (const [y, reason, mode] of nexts(x, cur.mode)) {
      if (!y || seen.has(y)) continue;
      seen.set(y, { depth: cur.depth + 1, from: x, reason, mode }); q.push(y);
    }
  }
  const pathOf = el => { const p = []; for (let e = el; e; e = seen.get(e).from) p.unshift(e); return p; };
  return [...seen.entries()].filter(([e]) => e !== F && stageOf(e)).map(([el, v]) => ({ el, depth: v.depth, reason: v.reason, path: pathOf(el) }));
}

/* Abdeckung: welche Anforderung ist umgesetzt, welche geprüft */
function coverage() {
  const reqUsages = IDX.all.filter(e => e.kind === 'requirement' && e.name && !e.isDef);
  const reqDefs = IDX.all.filter(e => e.kind === 'requirement' && e.name && e.isDef && !trIn(e, 'typed').some(u => u.kind === 'requirement'));
  const rows = [];
  const depthOf = e => { let d = 0; for (let p = e.parent; p; p = p.parent) if (p.kind === 'requirement') d++; return d; };
  for (const r of [...reqUsages, ...reqDefs]) {
    const group = [r, ...trOut(r, 'typed'), ...trIn(r, 'typed')];
    const sat = new Set(), ver = new Set();
    for (const g of group) { trIn(g, 'satisfy').forEach(x => sat.add(x)); trIn(g, 'verify').forEach(x => ver.add(x)); }
    const def = !r.isDef && r.types[0] ? resolveDef(r.types[0], r) : null;
    const kids = trOut(r, 'owns').filter(c => c.kind === 'requirement');
    let status = sat.size && ver.size ? 'ok' : sat.size ? 'untested' : ver.size ? 'unimpl' : 'open';
    if (kids.length && !sat.size && !ver.size) status = 'group';
    rows.push({ el: r, def, id: r.short || (def && def.short) || '', text: r.doc || (def && def.doc) || '', sat: [...sat], ver: [...ver], status, depth: depthOf(r), kids: kids.length });
  }
  return rows;
}


/* ================= Klartext: Steckbrief eines Elements ================= */
const KIND_KEYS = ['part def', 'part', 'item def', 'item', 'port def', 'port', 'interface def', 'interface', 'connection def', 'connection', 'attribute def', 'attribute', 'enum def', 'requirement def', 'requirement', 'concern def', 'concern', 'verification def', 'verification', 'analysis def', 'analysis', 'use case def', 'use case', 'action def', 'action', 'state def', 'state', 'calc def', 'calc', 'constraint def', 'constraint', 'occurrence def', 'allocation def', 'flow', 'package'];
const kindPlain = k => (KIND_KEYS.includes(k) ? L('kind.' + k) : null);
const plainKind = el => kindPlain(kindLabel(el)) || (kindLabel(el) ? L('kind.quoted', { k: kindLabel(el) }) : L('kind.feature'));
const DIR_PLAIN = { get in() { return L('dir.in'); }, get out() { return L('dir.out'); }, get inout() { return L('dir.inout'); } };
const uniq = l => [...new Set(l.filter(Boolean))];
function listSeg(els, fmt) { const out = []; els.forEach((e, i) => { if (i) out.push(', '); out.push({ el: e }); if (fmt) { const x = fmt(e); if (x) out.push(' ' + x); } }); return out; }
function partnersOf(el) {
  // Verbundene Komponenten: über Usages (akku ↔ rechner) und über Ports
  const group = el.isDef ? [el, ...trIn(el, 'typed')] : [el, ...trOut(el, 'typed')];
  const res = new Map();
  for (const g of group) for (const e of [...(TR.out.get(g) || []), ...(TR.inn.get(g) || [])]) {
    if (!['connect', 'flow', 'bind'].includes(e.type)) continue;
    const o = e.a === g ? e.b : e.a; if (stageOf(o) !== 'struct' || group.includes(o)) continue;
    if (!res.has(o)) res.set(o, uniq([e.label, e.via].filter(Boolean).map(String)));
  }
  return res;
}
function satisfiesOf(el) {
  const group = el.isDef ? [el, ...trIn(el, 'typed')] : [el, ...trOut(el, 'typed')];
  return uniq(group.flatMap(g => trOut(g, 'satisfy')));
}
// Satzvorlage → Segmente: {platzhalter} mit Element werden zu anklickbaren Verweisen
function segT(key, p) {
  const out = []; const str = L(key); let last = 0;
  str.replace(/\{(\w+)\}/g, (m, k, pos) => { out.push(str.slice(last, pos)); const v = p ? p[k] : undefined; out.push(v && typeof v === 'object' && v.kind ? { el: v } : (v === undefined ? m : String(v))); last = pos + m.length; return m; });
  out.push(str.slice(last)); return out.filter(x => x !== '');
}
function locText(el) { return el.file ? L('loc.fileLine', { file: el.file, line: el.line }) : L('loc.line', { line: el.line }); }
function describe(el, impactDepth) {
  const rows = []; const R = (id, v, gap) => { if (v && v.length) rows.push({ id, k: L('brief.row.' + id), v, gap: !!gap }); };
  const st = stageOf(el);
  const def = !el.isDef && el.types[0] ? resolveDef(el.types[0], el) : null;
  const owner = el.parent && el.parent.name && !['package', 'root'].includes(el.parent.kind) ? el.parent : null;
  const lead = segT('brief.lead', { name: el.name && !el.anon ? el.name : dispName(el), kind: plainKind(el) });
  if (def) lead.push(...segT('brief.leadType', { type: def }));
  if (owner) lead.push(...segT(el.kind === 'port' ? 'brief.leadAt' : 'brief.leadIn', { owner }));
  const id = el.short || (def && def.short); if (id) lead.push(...segT('brief.leadId', { id }));
  lead.push(L('brief.leadEnd'));
  const doc = el.doc || (def && def.doc); if (doc) R('text', [L('brief.quote', { x: doc })]);
  const supers = el.isDef ? superDefs(el) : [];
  if (supers.length) { const inh = supers.flatMap(d => features(d).map(f => f.name)).filter(Boolean); R('inherits', [...listSeg(supers), inh.length ? L('brief.takesOver', { list: uniq(inh).slice(0, 6).join(', ') }) : '']); }
  const subs = el.isDef ? trIn(el, 'spec') : []; if (subs.length) R('specializedBy', listSeg(subs));

  if (st === 'struct' || el.kind === 'item') {
    const parts = partsOf(el); if (parts.length) R('consistsOf', listSeg(parts, p => p.types[0] ? '(' + shortT(p.types[0]) + (p.mult ? ' ×' + p.mult : '') + ')' : ''));
    if (el.isDef) { const users = trIn(el, 'typed').filter(u => u.parent && u.parent.name); if (users.length) R('usedIn', listSeg(users.map(u => u.parent).filter((v, i, a) => a.indexOf(v) === i), o => { const u = users.find(x => x.parent === o); return L('brief.as', { name: u.name }); })); else R('usedIn', [L('brief.usedNowhere')], true); }
    const ports = portsOf(el); if (ports.length) R('ports', listSeg(ports, p => { const d = portDir(p); return '– ' + (d ? DIR_PLAIN[d] : L('brief.dirOpen')); }));
    const pt = partnersOf(el); if (pt.size) R('connected', listSeg([...pt.keys()], o => pt.get(o).length ? '(' + pt.get(o).join(', ') + ')' : ''));
    const beh = features(el).filter(f => (f.kind === 'action' || f.kind === 'state') && f.performed);
    if (beh.length) R('behaviour', listSeg(beh, b => L(b.performed === 'perform' ? 'brief.performsShort' : 'brief.exhibitsShort')));
    const allocIn = el.isDef ? [] : trIn(el, 'allocate'); if (allocIn.length) R('runsHere', listSeg(allocIn));
    const sat = satisfiesOf(el);
    if (sat.length) R('satisfies', listSeg(sat, r => idOf_(r) ? '[' + idOf_(r) + ']' : ''));
    else { let anc = null; for (let p = el.parent; p && !anc; p = p.parent) if (satisfiesOf(p).length) anc = p; R('satisfies', anc ? segT('brief.satisfiedViaOwner', { x: anc }) : [L('brief.noReq')], !anc); }
    const tests = uniq([...sat.flatMap(r => trIn(r, 'verify')), ...(el.isDef ? trIn(el, 'subject') : (def ? trIn(def, 'subject') : []))]);
    if (tests.length) R('testedBy', listSeg(tests)); else if (sat.length) R('testedBy', [L('brief.untested')], true);
  }
  if (st === 'iface') {
    if (el.kind === 'port') {
      const d = portDir(el); if (!el.isDef) R('direction', [d ? DIR_PLAIN[d] : L('brief.open'), el.types[0] && el.types[0].startsWith('~') ? L('brief.conjugated') : '']);
      const pd = el.isDef ? el : def; const carried = pd ? features(pd).filter(f => f.dir || f.kind === 'attribute' || f.kind === 'item') : [];
      if (carried.length) R('carries', [carried.map(featLine).join(', ')]);
      const conn = [...(TR.out.get(el) || []), ...(TR.inn.get(el) || [])].filter(e => ['connect', 'flow', 'bind'].includes(e.type));
      if (conn.length) R('connected', listSeg(conn.map(e => e.a === el ? e.b : e.a), o => { const e = conn.find(x => x.a === o || x.b === o); return e.label ? '(' + e.label + ')' : ''; }));
      else if (!el.isDef) R('connected', [L('brief.openPort')], true);
      if (el.isDef) { const users = trIn(el, 'typed'); if (users.length) R('usedBy', listSeg(users)); }
    } else {
      if (el.ends && el.ends.length) R('connects', [el.ends.join(' ↔ ')]);
      const ends = el.children.filter(c => c.role === 'end'); if (ends.length) R('ends', [ends.map(featLine).join(', ')]);
      if (el.isDef) { const users = trIn(el, 'typed'); if (users.length) R('usedIn', listSeg(users)); }
    }
  }
  if (st === 'req') {
    const subj = (el.isDef ? el : def || el).children.filter(c => c.role === 'subject'); if (subj.length) R('subject', [subj.map(featLine).join(', ')]);
    const cons = el.constraints || (def && def.constraints); if (cons) R('condition', [cons.join('; ')]);
    const up = el.parent && el.parent.kind === 'requirement' ? el.parent : null; if (up) R('partOf', [{ el: up }]);
    const kids = trOut(el, 'owns').filter(c => c.kind === 'requirement'); if (kids.length) R('contains', listSeg(kids));
    const from = trIn(el, 'derive'), to = trOut(el, 'derive'); if (from.length) R('derivedFrom', listSeg(from)); if (to.length) R('derivedTo', listSeg(to));
    const ref = [...trOut(el, 'refine'), ...trIn(el, 'refine')]; if (ref.length) R('refinement', listSeg(ref));
    if (!kids.length) {
      const row = coverage().find(r => r.el === el);
      const sat = row ? row.sat : uniq(trIn(el, 'satisfy')), ver = row ? row.ver : uniq(trIn(el, 'verify'));
      R('implementedBy', sat.length ? listSeg(sat) : [L('brief.noSatisfy')], !sat.length);
      R('verifiedBy', ver.length ? listSeg(ver) : [L('brief.noVerify')], !ver.length);
    }
  }
  if (st === 'test') {
    const ver = trOut(el, 'verify'); R('verifies', ver.length ? listSeg(ver) : [L('brief.noVerifyInTest')], !ver.length);
    const subj = trOut(el, 'subject'); if (subj.length) R('unitUnderTest', listSeg(subj));
    const impl = uniq(ver.flatMap(r => trIn(r, 'satisfy'))); if (impl.length) R('affectsImpl', listSeg(impl));
  }
  if (st === 'behav') {
    const kids = features(el).filter(c => !c.isDef && (BEHAV.has(c.kind)) && !c.anon && c.kind !== 'accept');
    if (kids.length) R(el.kind === 'state' ? 'states' : 'steps', listSeg(kids));
    const params = features(el).filter(f => f.dir && !BEHAV.has(f.kind)); if (params.length) R('io', [params.map(featLine).join(', ')]);
    if (el.kind === 'state' && el.parent) {
      const tr = relsOf(el.parent).filter(r => (r.type === 'transition' || r.type === 'succession') && lastSeg(r.src) === el.name);
      if (tr.length) R('transitions', [tr.map(r => (r.trigger ? L('brief.onTrigger', { x: r.trigger }) : L('brief.afterwards')) + (r.guard ? ' [' + r.guard + ']' : '') + ' → ' + (lastSeg(r.tgt) === 'done' ? L('brief.end') : lastSeg(r.tgt))).join('; ')]);
    }
    const users = el.isDef ? trIn(el, 'typed').filter(u => u.performed && u.parent) : (el.performed && el.parent ? [el] : []);
    if (users.length) R(el.kind === 'state' ? 'exhibitedBy' : 'performedBy', listSeg(users.map(u => u.parent)));
    const alloc = trOut(el, 'allocate'); if (alloc.length) R('allocatedTo', listSeg(alloc));
  }
  if (st) {
    const imp = impactOf(el, impactDepth || 2);
    const n = k => imp.filter(x => stageOf(x.el) === k).length;
    const extra = []; if (n('req')) extra.push(Ln('count.requirements', n('req'))); if (n('test')) extra.push(Ln('count.tests', n('test')));
    if (!imp.length) R('impact', [L('brief.impactNone')]);
    else R('impact', [L('brief.impact', { total: Ln('count.elements', imp.length) }) + (extra.length ? L('brief.impactAmong', { list: Lj(extra) }) : ''), { go: 'impact', label: L('brief.show') }]);
  }
  R('location', [{ src: true, label: locText(el) }]);
  return { lead, rows };
}
function idOf_(el) { if (el.short) return el.short; const d = !el.isDef && el.types[0] ? resolveDef(el.types[0], el) : null; return d && d.short || ''; }

/* ================= Modell-Check ================= */
const RULE_SEV = { parse: 'error', broken: 'error', type: 'error', direction: 'error', unsat: 'gap', unver: 'gap', emptytest: 'gap', ambig: 'hint', openport: 'hint', noreq: 'hint', unused: 'hint' };
const RULES = Object.fromEntries(Object.entries(RULE_SEV).map(([id, sev]) => [id, { sev, get title() { return L('rule.' + id + '.title'); }, get why() { return L('rule.' + id + '.why'); } }]));
const LIB_TYPE = /^(ScalarValues|ISQ\w*|SI\w*|USCustomaryUnits|Quantities|MeasurementReferences|Items|Parts|Ports|Actions|States|Requirements|Base|Links|Occurrences|Objects|Performances|Collections|VectorValues|NumericalFunctions|TrigFunctions|Time|Metaobjects|KerML|SysML|RequirementDerivation)::/;
const LIB_SIMPLE = new Set(['Real', 'Integer', 'Natural', 'Positive', 'Rational', 'Complex', 'Boolean', 'String', 'Number', 'NumericalValue', 'ScalarValue', 'Anything', 'Item', 'Part', 'Port', 'Action', 'State', 'Requirement', 'Occurrence', 'Interface', 'Connection', 'Flow', 'Time', 'TimeInstantValue', 'DurationValue']);
const isLibType = t => { const n = t.replace(/^~/, ''); return LIB_TYPE.test(n) || LIB_SIMPLE.has(lastSeg(n)) || /Value$/.test(lastSeg(n)); };
function modelChecks(warns) {
  const items = []; const I = (rule, el, msg, fix, extra) => items.push(Object.assign({ rule, sev: RULES[rule].sev, el, msg, fix, line: el ? el.line : null, file: el ? el.file : null }, extra || {}));
  for (const w of warns || []) I('parse', null, w.msg, L('chk.fix.parse'), { line: w.line, file: w.file });
  for (const b of TR.broken || []) I('broken', b.holder && b.holder.kind !== 'root' ? b.holder : null, L('chk.broken', { type: b.type, chain: b.chain }), L('chk.fix.broken', { name: lastSeg(b.chain) }), { line: b.line, file: b.file });
  for (const el of IDX.all) for (const t of el.types) if (!resolveDef(t, el) && !isLibType(t) && !(IDX.byName.get(lastSeg(t)) || []).length) I('type', el, L('chk.type', { el: dispName(el), t }), `${el.kind === 'feature' ? 'part' : el.kind} def ${lastSeg(t)} { … }  // ` + L('chk.fix.typeComment'));
  for (const l of TR.links || []) {
    if (l.deleg || l.type === 'bind') continue;
    const da = l.pa.kind === 'port' ? portDir(l.pa) : null, db = l.pb.kind === 'port' ? portDir(l.pb) : null;
    if (da && db && da === db && da !== 'inout') I('direction', l.pa, L('chk.dirSame', { a: dispName(l.pa), b: dispName(l.pb), d: da }), L('chk.fix.conjugate', { code: `port ${l.pb.name} : ~${l.pb.types[0] ? shortT(l.pb.types[0]).replace(/^~/, '') : 'PortType'};` }), { line: l.line, file: l.file });
    else if (l.type === 'flow' && (da === 'in' || db === 'out')) I('direction', l.pa, L('chk.dirFlow', { a: dispName(l.pa), da: da || '?', b: dispName(l.pb), db: db || '?' }), L('chk.fix.flow'), { line: l.line, file: l.file });
  }
  for (const r of coverage()) {
    if (r.status === 'group') continue;
    if (!r.sat.length) I('unsat', r.el, `${r.id ? '[' + r.id + '] ' : ''}${r.el.name}`, `satisfy ${r.el.name} by <${L('chk.ph.component')}>;`);
    if (!r.ver.length) I('unver', r.el, `${r.id ? '[' + r.id + '] ' : ''}${r.el.name}`, `verification def ${r.el.name[0].toUpperCase() + r.el.name.slice(1)}Test { objective { verify ${r.el.name}; } }`);
  }
  for (const t of IDX.all.filter(e => stageOf(e) === 'test' && e.isDef)) if (!trOut(t, 'verify').length) I('emptytest', t, t.name, `objective { verify <${L('chk.ph.requirement')}>; }`);
  for (const a of IDX.ambig) I('ambig', a.defs[0], L('chk.ambig', { name: a.name, list: a.defs.map(d => d.qn).join(', ') }), L('chk.fix.qualify', { qn: a.defs[0].qn }), { ambig: a.name });
  // offene Anschlüsse
  const connected = new Set(); for (const e of TR.edges) if (['connect', 'flow', 'bind', 'end'].includes(e.type)) { connected.add(e.a); connected.add(e.b); }
  for (const p of IDX.all.filter(e => e.kind === 'port' && !e.isDef && e.parent && stageOf(e.parent) === 'struct')) {
    const o = p.parent; const used = o.isDef ? trIn(o, 'typed').some(u => u.parent && stageOf(u.parent) === 'struct') : stageOf(o.parent) === 'struct';
    if (used && !connected.has(p)) I('openport', p, L('chk.openPort', { o: o.name, p: p.name }), `connect <${L('chk.ph.part')}>.${p.name} to <${L('chk.ph.otherPart')}>.<port>;`);
  }
  // Komponenten ohne Anforderungsbezug
  const covered = new Set(); const mark = el => { if (!el || covered.has(el)) return; covered.add(el); for (const s of el.isDef ? superDefs(el) : []) mark(s); for (const p of partsOf(el)) mark(p); for (const t of el.isDef ? trIn(el, 'typed') : trOut(el, 'typed')) if (!covered.has(t)) { covered.add(t); for (const p of partsOf(t)) mark(p); if (t.isDef) superDefs(t).forEach(mark); } };
  for (const e of TR.edges) if (e.type === 'satisfy') mark(e.a);
  if (covered.size) for (const el of IDX.all.filter(e => e.kind === 'part' && e.name && (e.isDef || stageOf(e.parent) === 'struct'))) if (!covered.has(el) && !(el.isDef && trIn(el, 'typed').length)) I('noreq', el, dispName(el), `satisfy <${L('chk.ph.requirement')}> by ${el.isDef ? '<' + L('chk.ph.usageOf', { x: el.name }) + '>' : el.name};`);
  // unbenutzte Definitionen
  for (const d of IDX.all.filter(e => e.isDef && e.name && ['part', 'port', 'item', 'interface', 'connection', 'action', 'state', 'requirement'].includes(e.kind))) {
    const usedBy = (TR.inn.get(d) || []).some(e => ['typed', 'spec', 'subject', 'satisfy', 'verify', 'allocate'].includes(e.type)) || (TR.out.get(d) || []).some(e => e.type === 'allocate');
    const referenced = IDX.all.some(e => e !== d && (e.types.concat(e.specs).some(t => lastSeg(t) === d.name)));
    if (!usedBy && !referenced) I('unused', d, `${kindLabel(d)} ${d.name}`, `part x : ${d.name};  // ` + L('chk.fix.unusedComment'));
  }
  return items;
}

/* ================= Disziplinen ================= */
// Disziplin = eine metadata def aus dem Modell, angewendet als Präfix (#Software part def …) oder im Rumpf (@Software;).
// Verwendungen erben die Disziplin ihrer Definition, Definitionen die ihrer allgemeineren Definition.
let DISC = null;
function disciplines() {
  const defs = IDX.all.filter(e => e.kind === 'metadata' && e.isDef && e.name);
  const byLow = new Map(defs.map(d => [d.name.toLowerCase(), d]));
  const applied = new Set(); for (const e of IDX.all) for (const m of e.meta || []) if (byLow.has(m)) applied.add(byLow.get(m));
  return defs.filter(d => applied.has(d));
}
function disciplineOf(el, seen) {
  if (!el) return null; seen = seen || new Set(); if (seen.has(el)) return null; seen.add(el);
  if (!DISC) DISC = new Map(disciplines().map(d => [d.name.toLowerCase(), d]));
  for (const m of el.meta || []) if (DISC.has(m)) return DISC.get(m);
  for (const t of el.isDef ? el.specs : el.types) { const d = resolveDef(t, el); if (d) { const r = disciplineOf(d, seen); if (r) return r; } }
  return null;
}
const DISC_KINDS = ['part', 'item', 'port', 'interface', 'connection', 'action', 'state'];
function disciplineView() {
  const list = disciplines(); if (!DISC) disciplineOf(null);
  const groups = list.map(d => ({ d, els: [], reqs: new Set() })); const none = { d: null, els: [], reqs: new Set() };
  const gOf = d => d ? groups.find(g => g.d === d) : none;
  for (const e of IDX.all) {
    if (!e.name || e.anon || !DISC_KINDS.includes(e.kind)) continue;
    const own = (e.meta || []).some(m => DISC && DISC.has(m));
    if (!e.isDef && !own) continue;
    const d = disciplineOf(e);
    if (!d && e.kind !== 'part') continue;
    gOf(d).els.push(e);
  }
  for (const ed of TR.edges) if (ed.type === 'satisfy') gOf(disciplineOf(ed.a)).reqs.add(ed.b);
  const cross = [];
  for (const l of TR.links) {
    const da = disciplineOf(l.ua) || disciplineOf(l.pa && l.pa.parent), db = disciplineOf(l.ub) || disciplineOf(l.pb && l.pb.parent);
    if (da && db && da !== db) cross.push(Object.assign({ da, db }, l));
  }
  const alloc = []; const seenA = new Set();
  for (const ed of TR.edges) if (ed.type === 'allocate' || ed.type === 'perform') {
    const [sw, hw] = ed.type === 'allocate' ? [ed.a, ed.b] : [ed.b, ed.a];
    const ds = disciplineOf(sw), dh = disciplineOf(hw); const k = ds && dh && (sw.qn + '>' + hw.qn);
    if (ds && dh && ds !== dh && !seenA.has(k)) { seenA.add(k); alloc.push({ type: ed.type, a: sw, b: hw, da: ds, db: dh, line: ed.line, file: ed.file }); }
  }
  return { list, groups: [...groups, none].map(g => Object.assign(g, { reqs: [...g.reqs] })), cross, alloc };
}

// Fachsicht: was eine Disziplin betrifft (eigene Teile, erfüllte Anforderungen, Tests dazu) und wo sie an andere grenzt.
// d = metadata def einer Disziplin oder 'test' für die Fachsicht Test.
function disciplineScope(d) {
  const own = new Set(), reqs = new Set(), tests = new Set(), bound = new Set();
  const member = (e, k) => { if (!e || (k || 0) > 3) return false; if (d === 'test') return stageOf(e) === 'test'; const x = disciplineOf(e); if (x) return x === d; return e.kind === 'port' && member(e.parent, (k || 0) + 1); };
  for (const e of IDX.all) if (e.name && !e.anon && member(e)) own.add(e);
  const rows = coverage();
  if (d === 'test') {
    for (const r of rows) { reqs.add(r.el); r.ver.forEach(t => tests.add(t)); }
    for (const t of own) { for (const s of trOut(t, 'subject')) bound.add(s); }
  } else {
    for (const r of rows) if (r.sat.some(x => member(x) || own.has(x))) { reqs.add(r.el); r.ver.forEach(t => tests.add(t)); }
    for (const l of TR.links) { const a = member(l.ua) || member(l.pa), b = member(l.ub) || member(l.pb); if (a !== b) { const o = a ? [l.ub, l.pb] : [l.ua, l.pa]; o.forEach(x => x && bound.add(x)); } }
    for (const e of TR.edges) if (e.type === 'allocate' || e.type === 'perform') { const a = member(e.a), b = member(e.b); if (a !== b) bound.add(a ? e.b : e.a); }
  }
  return { own, reqs, tests, bound, member };
}

/* ================= Baseline-Vergleich ================= */
// Schlüssel eines Elements über Modellstände hinweg: qualifizierter Name + Art (+ Ort bei Namenlosen)
const elKey = el => el ? (el.qn || el.name || '') + '|' + el.kind + '|' + (el.isDef ? 'd' : 'u') + (el.anon || !el.name ? '|' + el.file + ':' + el.line : '') : '';
const SIG_FIELDS = ['types', 'specs', 'redefs', 'refs', 'mult', 'value', 'doc', 'short', 'dir', 'mods', 'meta'];
const SIG_EDGES = ['typed', 'spec', 'satisfy', 'verify', 'derive', 'refine', 'allocate', 'perform', 'subject', 'connect', 'flow', 'bind', 'end', 'depend'];
// Momentaufnahme des aktuell geladenen Modells (nach buildIndex + buildTrace)
function snapshot(warns) {
  const els = new Map();
  for (const e of IDX.all) {
    if (!e.name || e.anon || e.kind === 'root') continue;
    const sig = {}; for (const f of SIG_FIELDS) { const v = e[f]; sig[f] = Array.isArray(v) ? [...v].sort().join(', ') : (v == null ? '' : String(v)); }
    sig.exprs = [e, ...e.children.filter(c => !c.name || c.anon)].flatMap(c => [...(c.constraints || []), ...(c.exprs || [])]).join('; '); // Bedingungen in namenlosen constraints
    const edges = new Set((TR.out.get(e) || []).filter(x => SIG_EDGES.includes(x.type) && x.b.name && !x.b.anon).map(x => x.type + ' ' + elKey(x.b)));
    let p = e.parent; while (p && (!p.name || p.anon) && p.kind !== 'root') p = p.parent;
    els.set(elKey(e), { key: elKey(e), name: e.name, kind: e.kind, isDef: e.isDef, qn: e.qn, file: e.file, line: e.line, parent: p && p.kind !== 'root' ? elKey(p) : '', sig, edges });
  }
  const cov = new Map(coverage().map(r => [elKey(r.el), { status: r.status, name: r.el.name, id: r.id }]));
  const checks = modelChecks(warns || []).map(c => ({ rule: c.rule, sev: c.sev, key: c.rule + '|' + (c.el ? elKey(c.el) : '') + '|' + c.msg, el: c.el ? elKey(c.el) : '', msg: c.msg }));
  return { els, cov, checks };
}
const keyName = k => { const q = k.split('|')[0]; return q.split('::').pop() || q; };
function diffSnapshots(base, cur) {
  // Gleiche Kennung <'A1'> = gleiches Element, auch wenn sich der Name ändert. Gleicher Name allein begründet keine Gleichheit.
  const ren = []; const newOnly = [...cur.els.values()].filter(c => c.sig.short && !base.els.has(c.key));
  for (const b of base.els.values()) if (b.sig.short && !cur.els.has(b.key)) { const c = newOnly.find(x => x.kind === b.kind && x.isDef === b.isDef && x.sig.short === b.sig.short); if (c) ren.push([b.qn, c.qn]); }
  if (ren.length) {
    const tr = k => { for (const [o, n] of ren) if (k.startsWith(o + '|') || k.startsWith(o + '::')) return n + k.slice(o.length); return k; };
    const trE = x => { const i = x.indexOf(' '); return x.slice(0, i + 1) + tr(x.slice(i + 1)); };
    base = Object.assign({}, base, { els: new Map([...base.els].map(([k, b]) => [tr(k), Object.assign({}, b, { key: tr(k), qnT: tr(b.qn), parent: tr(b.parent), edges: new Set([...b.edges].map(trE)) })])), cov: new Map([...base.cov].map(([k, v]) => [tr(k), v])) });
  }
  const added = [], removed = [], changed = [];
  for (const [k, c] of cur.els) {
    const b = base.els.get(k);
    if (!b) { if (!cur.els.has(c.parent) || base.els.has(c.parent)) added.push(c); continue; }
    const fields = [...SIG_FIELDS, 'exprs'].filter(f => b.sig[f] !== c.sig[f]).map(f => ({ f, old: b.sig[f], now: c.sig[f] }));
    if ((b.qnT || b.qn) !== c.qn) fields.unshift({ f: 'name', old: b.qn, now: c.qn }); // nur die eigene Umbenennung, nicht die des Elternteils
    const edAdd = [...c.edges].filter(x => !b.edges.has(x)), edDel = [...b.edges].filter(x => !c.edges.has(x));
    if (fields.length || edAdd.length || edDel.length) changed.push(Object.assign({}, c, { fields, edAdd, edDel }));
  }
  for (const [k, b] of base.els) if (!cur.els.has(k) && (!base.els.has(b.parent) || cur.els.has(b.parent))) removed.push(b);
  const covChg = [];
  for (const [k, c] of cur.cov) { const b = base.cov.get(k); if (!b) covChg.push({ key: k, name: c.name, id: c.id, old: null, now: c.status }); else if (b.status !== c.status) covChg.push({ key: k, name: c.name, id: c.id, old: b.status, now: c.status }); }
  for (const [k, b] of base.cov) if (!cur.cov.has(k)) covChg.push({ key: k, name: b.name, id: b.id, old: b.status, now: null });
  const bk = new Set(base.checks.map(c => c.key)), ck = new Set(cur.checks.map(c => c.key));
  return { added, removed, changed, covChg, newChecks: cur.checks.filter(c => !bk.has(c.key)), fixedChecks: base.checks.filter(c => !ck.has(c.key)) };
}
// Folgen im aktuellen Modell: was eine neue oder geänderte Stelle beeinflusst
function diffImpact(diff, depth) {
  const byKey = new Map(IDX.all.map(e => [elKey(e), e]));
  const starts = new Set();
  for (const x of [...diff.changed, ...diff.added]) { let e = byKey.get(x.key); while (e && !stageOf(e)) e = e.parent; if (e && e.kind !== 'root') starts.add(e); }
  const hit = new Map();
  for (const s of starts) for (const r of impactOf(s, depth || 3)) if (!starts.has(r.el)) { const h = hit.get(r.el); if (!h || h.depth > r.depth) hit.set(r.el, Object.assign({ from: s }, r)); }
  const all = [...hit.values()];
  return { starts: [...starts], reqs: all.filter(r => stageOf(r.el) === 'req'), tests: all.filter(r => stageOf(r.el) === 'test'), other: all.filter(r => !['req', 'test'].includes(stageOf(r.el))) };
}

/* ================= Geführte Tour: Plan aus dem Modell ================= */
// Sucht eine vollständig nachgewiesene Anforderung mit Umsetzung und Test und baut daraus die Stationen der Tour.
function tourPlan() {
  const rows = coverage().filter(r => r.status !== 'group');
  const score = r => (r.status === 'ok' ? 10 : r.sat.length ? 4 : 0) + r.sat.filter(s => portsOfAny(s).length).length * 2 + (r.sat.some(s => behaviourOf(s)) ? 1 : 0);
  const best = rows.slice().sort((a, b) => score(b) - score(a))[0] || null;
  const gap = rows.find(r => r.status !== 'ok') || null;
  if (!best) return { req: null, gap, impl: null, test: null, port: null, behav: null };
  const impl = best.sat[0] || null;
  const port = impl ? portsOfAny(impl)[0] || null : null;
  const behav = impl ? behaviourOf(impl) : null;
  return { req: best.el, gap: gap && gap.el, impl, test: best.ver[0] || null, port, behav };
}
function defOf(el) { return el && !el.isDef && el.types[0] ? resolveDef(el.types[0], el) : el; }
function portsOfAny(el) { const d = defOf(el); return [...(el.children || []), ...((d && d.children) || [])].filter(c => c.kind === 'port' && c.name); }
function behaviourOf(el) {
  const chain = [el, defOf(el)]; for (let q = el.parent; q && q.kind !== 'package' && q.kind !== 'root'; q = q.parent) chain.push(q);
  for (const x of chain) if (x) {
    const p = trOut(x, 'perform')[0] || (x.children || []).find(c => (c.kind === 'state' || c.kind === 'action') && !c.anon && c.types.length);
    if (p) return defOf(p) || p;
    const a = trIn(x, 'allocate')[0]; if (a) return a;
  }
  return null;
}

if (typeof module !== 'undefined') module.exports = { disciplineScope, disciplines, disciplineOf, disciplineView, elKey, snapshot, diffSnapshots, diffImpact, tourPlan, L, Ln, Lj, setDicts, setLang, getLang: () => LANG, describe, modelChecks, RULES, kindPlain, plainKind, portDir, partsOf, buildTrace, traceNeighbors, impactOf, coverage, stageOf, dispName, resolveChain, trOut, trIn, parseFiles, viewDetail, isOpenable, tokenize, parse, buildIndex, viewStruct, viewIBD, viewStates, viewActions, viewReqs, ibdCandidates, stateCandidates, actionCandidates, elkGraph, renderSVG, measure, setMeasure: f => { measureText = f; }, within, nearestPkg };
