// Prüft Disziplinen, Baseline-Vergleich und Tour-Plan an beiden Beispielprojekten
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const C = require('../src/core.js');
C.setDicts({ de: require('../src/lang/de.json'), en: require('../src/lang/en.json') });
function load(d) {
  const base = path.resolve(__dirname, '../beispiel', d), out = [];
  (function walk(x) { for (const f of fs.readdirSync(x)) { const p = path.join(x, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.sysml$/.test(f)) out.push({ name: path.relative(base, p).split(path.sep).join('/'), text: fs.readFileSync(p, 'utf8') }); } })(base);
  return out;
}
const build = files => { const r = C.parseFiles(files); C.buildIndex(r.root, {}); C.buildTrace(); return r; };
const snap = files => C.snapshot(build(files).warns);

for (const [lang, dir, names] of [['de', 'indoorroboter', { mech: 'Mechanik', el: 'Elektronik', akku: 'Akku', cap: 'kapazitaet : Real = 5.2', capNew: 'kapazitaet : Real = 6.0', req: 'laufzeit', test: 'LaufzeitTest', gap: 'notaus', sys: 'System.sysml', satisfy: '    allocate', newSat: '    satisfy Anforderungen::roboterAnforderungen.notaus by roboter.rechner;\n    allocate' }],
                                   ['en', 'indoor-robot', { mech: 'Mechanics', el: 'Electronics', akku: 'Battery', cap: 'capacity : Real = 5.2', capNew: 'capacity : Real = 6.0', req: 'runtime', test: 'RuntimeTest', gap: 'emergencyStop', sys: 'System.sysml', satisfy: '    allocate', newSat: '    satisfy Requirements::robotRequirements.emergencyStop by robot.controller;\n    allocate' }]]) {
  C.setLang(lang);
  const files = load(dir); build(files);

  // Disziplinen: drei aus Metadaten, Verwendungen erben, zwei Schnittstellen über Grenzen
  const v = C.disciplineView();
  assert.deepStrictEqual(v.list.map(d => d.name), [names.mech, names.el, 'Software'], lang + ': Disziplinen');
  const g = Object.fromEntries(v.groups.map(x => [x.d ? x.d.name : '-', x.els.map(e => e.name)]));
  assert.ok(g[names.el].includes(names.akku) && g.Software.length === 2, lang + ': Zuordnung');
  assert.strictEqual(v.cross.length, 2, lang + ': Schnittstellen über Disziplingrenzen');
  assert.ok(v.cross.every(c => c.db.name === names.mech), lang + ': beide Grenzen führen zur Mechanik');
  assert.ok(v.alloc.some(a => a.type === 'allocate' && a.da.name === 'Software'), lang + ': Software auf Hardware');
  const use = C.disciplineOf(C.trIn(v.groups.find(x => x.d && x.d.name === names.el).els.find(e => e.name === names.akku), 'typed')[0]);
  assert.strictEqual(use && use.name, names.el, lang + ': Verwendung erbt die Disziplin der Definition');

  // Tour: vollständige Kette für eine geprüfte Anforderung
  const t = C.tourPlan();
  assert.strictEqual(t.req.name, names.req, lang + ': Tour-Anforderung');
  assert.ok(t.impl && t.test && t.port && t.behav, lang + ': Tour-Kette unvollständig');
  assert.strictEqual(t.test.name, names.test);

  // Vergleich: unverändert → leer; Wert, neue Beziehung → erkannt, Folgen abgeleitet
  const B = snap(files);
  const same = C.diffSnapshots(B, snap(files));
  assert.strictEqual(same.added.length + same.removed.length + same.changed.length, 0, lang + ': gleicher Stand muss leer sein');
  const mod = files.map(f => ({ name: f.name, text: f.text.replace(names.cap, names.capNew).replace(f.name === names.sys ? names.satisfy : '\u0000', names.newSat) }));
  const N = snap(mod); const d = C.diffSnapshots(B, N);
  const chg = Object.fromEntries(d.changed.map(c => [c.name, c]));
  const capName = names.cap.split(' ')[0];
  assert.deepStrictEqual(chg[capName].fields.map(f => [f.f, f.old, f.now]), [['value', '5.2', '6.0']], lang + ': Wertänderung');
  assert.ok(d.changed.some(c => c.edAdd.some(x => x.startsWith('satisfy ') && x.includes(names.gap))), lang + ': neue satisfy-Beziehung');
  assert.deepStrictEqual(d.covChg.map(c => [c.name, c.old, c.now]), [[names.gap, 'open', 'untested']], lang + ': Abdeckung vorher/nachher');
  assert.ok(d.fixedChecks.some(c => c.rule === 'unsat'), lang + ': behobene Lücke');
  const im = C.diffImpact(d, 3);
  assert.ok(im.tests.some(r => r.el.name === names.test), lang + ': Test wiederholen');
  assert.ok(im.reqs.some(r => r.el.name === names.req), lang + ': Anforderung neu nachweisen');
  // entfernt
  const rem = C.diffSnapshots(B, snap(files.filter(f => !/[Tt]ests/.test(f.name))));
  assert.deepStrictEqual(rem.removed.map(r => r.qn), ['Tests'], lang + ': entferntes Paket fasst seinen Inhalt zusammen');
  assert.ok(rem.covChg.length >= 3 && rem.covChg.every(c => c.now === 'untested' || c.now === 'open'), lang + ': ohne Tests ist nichts mehr nachgewiesen');
}
// Umbenennung über die Kennung, Fachsichten, Tour-Dateien
for (const [lang, dir, o] of [['de', 'indoorroboter', { def: 'Laufzeit', neu: 'Betriebsdauer', el: 'Elektronik', reqs: ['laufzeit', 'hindernis', 'scanrate'], bound: 'antrieb' }],
                              ['en', 'indoor-robot', { def: 'Runtime', neu: 'OperatingTime', el: 'Electronics', reqs: ['runtime', 'obstacle', 'scanRate'], bound: 'drive' }]]) {
  C.setLang(lang); const files = load(dir);
  const B = snap(files); const re = new RegExp('\\b' + o.def + '\\b', 'g');
  const d = C.diffSnapshots(B, snap(files.map(f => ({ name: f.name, text: f.text.replace(re, o.neu) }))));
  assert.strictEqual(d.added.length + d.removed.length, 0, lang + ': Umbenennung darf nicht als entfernt + neu erscheinen');
  assert.ok(d.changed.some(c => c.fields.some(f => f.f === 'name' && f.now.endsWith('::' + o.neu))), lang + ': Umbenennung erkannt');
  assert.ok(!d.changed.some(c => c.qn.startsWith('Anforderungen::' + o.neu + '::') || c.qn.startsWith('Requirements::' + o.neu + '::')), lang + ': Kinder des umbenannten Elements sind keine eigene Änderung');

  build(files);
  const el = C.disciplines().find(x => x.name === o.el); const sc = C.disciplineScope(el);
  assert.deepStrictEqual([...sc.reqs].map(r => r.name).sort(), o.reqs.slice().sort(), lang + ': Fachsicht – erfüllte Anforderungen');
  assert.ok([...sc.bound].some(b => b.name === o.bound), lang + ': Fachsicht – Grenze zur Mechanik');
  assert.ok(sc.tests.size === 2, lang + ': Fachsicht – Tests');
  const ts = C.disciplineScope('test');
  assert.strictEqual(ts.own.size, 2, lang + ': Fachsicht Test');

  const tour = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../beispiel', dir, 'tour.json'), 'utf8'));
  assert.ok(tour.steps.length >= 8 && tour.steps.length <= 10, lang + ': Tour hat 8 bis 10 Schritte');
  for (const st of tour.steps) if (st.focus) {
    const r = C.parseFiles(files); const I = C.buildIndex(r.root, {});
    assert.ok(I.all.some(e => e.qn === st.focus), lang + ': Tour-Element fehlt im Modell: ' + st.focus);
  }
}
console.log('guide.test.js: Disziplinen, Vergleich und Tour in de und en bestanden');
