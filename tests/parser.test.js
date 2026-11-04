// Prüft Parser, Namensauflösung und Traceability am Beispielprojekt
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const C = require('../src/core.js');
const dir = path.resolve(__dirname, '../beispiel/indoorroboter');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(sysml|kerml)$/.test(f)) files.push({ name: path.relative(dir, p).split(path.sep).join('/'), text: fs.readFileSync(p, 'utf8') }); } })(dir);

const { root, warns } = C.parseFiles(files);
assert.deepStrictEqual(warns, [], 'Parser-Hinweise im Beispielprojekt');
const I = C.buildIndex(root, {});
C.buildTrace();

// Abdeckung: zwei absichtliche Lücken
const cov = Object.fromEntries(C.coverage().map(r => [r.el.name, r.status]));
assert.deepStrictEqual(cov, { roboterAnforderungen: 'group', laufzeit: 'ok', hindernis: 'ok', scanrate: 'ok', gewicht: 'untested', notaus: 'open' });

// Auswirkung: Änderung am Akku erreicht Anforderung und Test
const akku = I.all.find(e => e.name === 'Akku' && e.isDef);
const hit = C.impactOf(akku, 3).map(x => C.dispName(x.el));
assert.ok(hit.includes('laufzeit : Laufzeit') && hit.includes('LaufzeitTest'), 'Auswirkungskette Akku → laufzeit → LaufzeitTest fehlt');

// Namenskollision: Auflösung nach Paketnähe und per Auswahl
const extra = { name: 'zukauf/Zukauf.sysml', text: 'package Zukauf { part def Motor; part def E { part m : Motor; } }' };
const r2 = C.parseFiles([...files, extra]); const I2 = C.buildIndex(r2.root, {});
assert.strictEqual(I2.ambig.length, 1);
C.buildTrace();
const typeOf = (I, n) => C.trOut(I.all.find(e => e.name === n), 'typed')[0].qn;
assert.strictEqual(typeOf(I2, 'm'), 'Zukauf::Motor', 'automatisch: eigenes Paket');
assert.strictEqual(typeOf(I2, 'motorLinks'), 'Struktur::Motor', 'automatisch: eigenes Paket');
// Auswahl im Kollisionsdialog: gilt für alle unqualifizierten Verweise
const I3 = C.buildIndex(C.parseFiles([...files, extra]).root, { Motor: 'Zukauf::Motor' }); C.buildTrace();
assert.strictEqual(typeOf(I3, 'motorLinks'), 'Zukauf::Motor', 'Auswahl wird nicht beachtet');
console.log('parser.test.js: alle Prüfungen bestanden');
