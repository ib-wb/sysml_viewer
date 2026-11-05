// Prüft, dass jede Sprachdatei vollständig ist und die Texte in Englisch wirklich ankommen.
// Neue Sprache: src/lang/<code>.json anlegen – dieser Test meldet fehlende Schlüssel und Platzhalter.
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const C = require('../src/core.js');
const dir = path.resolve(__dirname, '../src/lang');
const dicts = {};
for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) dicts[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const base = dicts.de; assert.ok(base, 'de.json fehlt (Basissprache)');
const ph = s => [...new Set(String(s).match(/\{\w+\}/g) || [])].sort().join(',');
const problems = [];
for (const [code, d] of Object.entries(dicts)) {
  if (!d._name || !d._locale) problems.push(`${code}: _name oder _locale fehlt`);
  for (const k of Object.keys(base)) {
    if (k.startsWith('_')) continue;
    if (!(k in d)) problems.push(`${code}: fehlt ${k}`);
    else if (ph(d[k]) !== ph(base[k])) problems.push(`${code}: Platzhalter in ${k}: ${ph(d[k])} statt ${ph(base[k])}`);
  }
  for (const k of Object.keys(d)) if (!k.startsWith('_') && !(k in base)) problems.push(`${code}: überzählig ${k}`);
}
assert.deepStrictEqual(problems, [], 'Sprachdateien unvollständig:\n' + problems.join('\n'));

// Englisch durchspielen
C.setDicts(dicts);
assert.strictEqual(C.setLang('en'), 'en');
assert.strictEqual(C.setLang('xx'), 'de', 'unbekannte Sprache fällt auf die Basissprache zurück');
C.setLang('en');
assert.strictEqual(C.Ln('count.tests', 1), '1 test');
assert.strictEqual(C.Ln('count.tests', 3), '3 tests');
assert.strictEqual(C.Lj(['a', 'b', 'c']), 'a, b, and c');
const files = [];
const ex = path.resolve(__dirname, '../beispiel/indoorroboter');
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.sysml$/.test(f)) files.push({ name: path.relative(ex, p), text: fs.readFileSync(p, 'utf8') }); } })(ex);
const { root, warns } = C.parseFiles(files); const I = C.buildIndex(root, {}); C.buildTrace();
const txt = segs => segs.map(s => typeof s === 'string' ? s : s.text || s.name || '').join('');
const b = C.describe(I.all.find(e => e.name === 'notaus'));
const keys = b.rows.map(r => r.k);
assert.ok(keys.includes('Implemented by') && keys.includes('Verified by'), 'Steckbrief-Zeilen nicht englisch: ' + keys.join(' | '));
const checks = C.modelChecks(warns);
assert.ok(checks.every(c => !/[äöüß]|Anforderung/.test(c.rule && C.RULES[c.rule].title)), 'Regeltitel noch deutsch');
assert.strictEqual(C.RULES.unver.title, 'Requirement without a test');
C.setLang('de');
assert.strictEqual(C.RULES.unver.title, 'Anforderung ohne Test');
console.log(`i18n.test.js: ${Object.keys(dicts).join(', ')} vollständig, Englisch geprüft`);
