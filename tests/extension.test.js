// Prüft extension.js gegen ein nachgebautes VS Code (tests/mock.js)
const assert = require('assert'); const path = require('path');
const Module = require('module'); const M = require('./mock.js');
const orig = Module._load; Module._load = function (r, ...a) { return r === 'vscode' ? M.vscode : orig.call(this, r, ...a); };
const ext = require('../vscode-extension/extension.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const ctx = { subscriptions: [], extensionUri: M.vscode.Uri.file(path.resolve(__dirname, '../vscode-extension')) };
  ext.activate(ctx);
  assert.deepStrictEqual(Object.keys(M.handlers).sort(), ['sysmlViewer.open', 'sysmlViewer.refresh', 'sysmlViewer.reveal']);

  M.handlers['sysmlViewer.open']();
  const html = M.vscode._panel.webview.html;
  assert.ok(/Content-Security-Policy/.test(html), 'CSP fehlt');
  assert.ok(!/<script>/.test(html), 'Skript ohne Nonce');
  assert.ok(!/cdn\.jsdelivr/.test(html), 'CDN-Verweis übrig');

  M.send({ type: 'ready' }); await wait(100);
  const conf = M.posted.find(m => m.type === 'config');
  assert.strictEqual(conf && conf.lang, 'en', 'VS-Code-Sprache nicht an den Viewer übergeben');
  const files = M.posted.find(m => m.type === 'files');
  assert.ok(files && files.files.length >= 5, 'Modelldateien nicht gesendet');

  M.send({ type: 'baseline', ref: 'HEAD' }); await wait(1500);
  const base = M.posted.find(m => m.type === 'baseline');
  assert.ok(base && !base.error, 'Baseline aus Git fehlgeschlagen: ' + (base && base.error));
  assert.ok(base.files.length >= 5 && base.files.every(f => !f.name.startsWith('beispiel/')) && /^HEAD \(\w+\)$/.test(base.name), 'Baseline-Dateien falsch: ' + base.name);

  M.send({ type: 'goto', file: 'anforderungen/Anforderungen.sysml', line: 34 }); await wait(50);
  assert.deepStrictEqual(M.log.find(l => l[0] === 'show').slice(1, 3), ['anforderungen/Anforderungen.sysml', 34]);

  M.vscode.window.activeTextEditor = { document: { fileName: 'Struktur.sysml', uri: M.vscode.Uri.file(path.resolve(__dirname, '../beispiel/indoorroboter/struktur/Struktur.sysml')) }, selection: { active: { line: 40 } } };
  M.handlers['sysmlViewer.reveal'](); await wait(50);
  assert.deepStrictEqual(M.posted[M.posted.length - 1], { type: 'reveal', file: 'struktur/Struktur.sysml', line: 41 });
  console.log('extension.test.js: alle Prüfungen bestanden');
})().catch(e => { console.error(e); process.exit(1); });
