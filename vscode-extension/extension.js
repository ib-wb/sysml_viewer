// SysML v2 Viewer – VS-Code-Erweiterung
// Liest alle Modelldateien des Workspace, zeigt sie im Viewer (Webview) und verbindet beides in beide Richtungen.
'use strict';
const vscode = require('vscode');
const cp = require('child_process');
const path = require('path');

const MODEL_EXT = /\.(sysml|kerml)$/i;
let panel = null;          // die eine Viewer-Webview
let ready = false;         // Webview hat „ready“ gemeldet
let pending = [];          // Nachrichten, die vor „ready“ anfallen
let uriByName = new Map(); // relativer Pfad → Uri, für den Sprung zurück in den Editor
let timer = null;

const cfg = () => vscode.workspace.getConfiguration('sysmlViewer');

// Meldungen der Extension selbst; die Webview-Texte stehen in src/lang/*.json
const MSG = {
  de: { noWorkspace: 'Kein Ordner geöffnet.', notFound: 'SysML Viewer: Datei „{0}“ nicht gefunden.', openFirst: 'SysML Viewer: Bitte eine .sysml-Datei im Editor öffnen.' },
  en: { noWorkspace: 'No folder is open.', notFound: 'SysML Viewer: file “{0}” not found.', openFirst: 'SysML Viewer: please open a .sysml file in the editor.' }
};
function msg(key, ...a) {
  const lang = ((vscode.env && vscode.env.language) || 'en').slice(0, 2);
  const s = (MSG[lang] || MSG.en)[key];
  return s.replace(/\{(\d)\}/g, (_, i) => a[i]);
}
function configMsg() { return { type: 'config', follow: cfg().get('followNavigator'), lang: vscode.env && vscode.env.language }; }

function post(msg) {
  if (!panel) return;
  if (ready) panel.webview.postMessage(msg); else pending.push(msg);
}

function projectName() {
  const ws = vscode.workspace.workspaceFolders;
  if (!ws || !ws.length) return 'Workspace';
  return vscode.workspace.name || ws[0].name;
}

async function collectFiles() {
  const uris = await vscode.workspace.findFiles(cfg().get('include'), cfg().get('exclude'));
  const open = new Map(vscode.workspace.textDocuments.filter(d => MODEL_EXT.test(d.fileName)).map(d => [d.uri.toString(), d]));
  uriByName = new Map();
  const files = [];
  for (const uri of uris) {
    const name = vscode.workspace.asRelativePath(uri, (vscode.workspace.workspaceFolders || []).length > 1);
    const doc = open.get(uri.toString());
    let text;
    if (doc) text = doc.getText();                  // auch ungespeicherte Änderungen
    else { try { text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8'); } catch (e) { continue; } }
    uriByName.set(name, uri);
    files.push({ name, text });
  }
  return files;
}


// Baseline für den Vergleich: Modelldateien des ersten Workspace-Ordners im Stand eines Git-Commits
function git(args, cwd) {
  return new Promise((res, rej) => cp.execFile('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 }, (e, out, err) => e ? rej(new Error(String(err || e.message).trim().split('\n')[0])) : res(out)));
}
const SKIP = /(^|\/)(node_modules|\.git|build|dist|out)\//;
async function gitBaseline(ref) {
  const ws = vscode.workspace.workspaceFolders; if (!ws || !ws.length) throw new Error(msg('noWorkspace'));
  const folder = ws[0].uri.fsPath;
  const top = (await git(['rev-parse', '--show-toplevel'], folder)).trim();
  const short = (await git(['rev-parse', '--short', ref], folder)).trim();
  const rel = path.relative(top, folder).split(path.sep).join('/');
  const names = (await git(['ls-tree', '-r', '--name-only', ref, '--', rel || '.'], top)).split('\n').filter(n => MODEL_EXT.test(n) && !SKIP.test(n));
  const files = [];
  for (const n of names) files.push({ name: rel ? n.slice(rel.length + 1) : n, text: await git(['show', ref + ':' + n], top) });
  return { files, name: `${ref} (${short})` };
}

async function sendFiles() {
  if (!panel) return;
  const files = await collectFiles();
  post({ type: 'files', files, project: projectName() });
}
function scheduleSend(ms) { clearTimeout(timer); timer = setTimeout(sendFiles, ms); }

function htmlFor(webview, context) {
  const media = vscode.Uri.joinPath(context.extensionUri, 'media');
  const fs = require('fs');
  let html = fs.readFileSync(vscode.Uri.joinPath(media, 'viewer.html').fsPath, 'utf8');
  const nonce = [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
  const elk = webview.asWebviewUri(vscode.Uri.joinPath(media, 'elk.bundled.js'));
  const csp = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src 'unsafe-inline' ${webview.cspSource} https://fonts.googleapis.com`,
    `font-src ${webview.cspSource} https://fonts.gstatic.com`,
    `img-src ${webview.cspSource} data: blob:`,
  ].join('; ');
  html = html.replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${csp}">`);
  html = html.replace(/<script src="[^"]*elk\.bundled\.js"><\/script>/, `<script nonce="${nonce}" src="${elk}"></script>`);
  html = html.replace(/<script>/g, `<script nonce="${nonce}">`);
  return html;
}

async function gotoInEditor(m) {
  let uri = uriByName.get(m.file);
  if (!uri) { const hit = await vscode.workspace.findFiles('**/' + m.file, null, 1); uri = hit[0]; }
  if (!uri) { vscode.window.showWarningMessage(msg('notFound', m.file)); return; }
  const doc = await vscode.workspace.openTextDocument(uri);
  const line = Math.max(0, Math.min((m.line || 1) - 1, doc.lineCount - 1));
  const range = doc.lineAt(line).range;
  // Editor links vom Viewer öffnen; ist schon einer mit dieser Datei sichtbar, diesen nehmen
  const visible = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
  const column = visible ? visible.viewColumn : (panel && panel.viewColumn === vscode.ViewColumn.One ? vscode.ViewColumn.Two : vscode.ViewColumn.One);
  const ed = await vscode.window.showTextDocument(doc, { viewColumn: column, preserveFocus: !!m.preserveFocus, selection: range });
  ed.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

function setupPanel(p, context) {
  panel = p; ready = false; pending = [];
  p.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] };
  p.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');
  p.webview.html = htmlFor(p.webview, context);
  p.webview.onDidReceiveMessage(msg => {
    if (msg.type === 'ready') {
      ready = true;
      p.webview.postMessage(configMsg());
      sendFiles().then(() => { for (const m of pending) p.webview.postMessage(m); pending = []; });
    }
    if (msg.type === 'goto') gotoInEditor(msg);
    if (msg.type === 'baseline') gitBaseline(msg.ref || 'HEAD').then(r => p.webview.postMessage(Object.assign({ type: 'baseline' }, r)), e => p.webview.postMessage({ type: 'baseline', error: e.message }));
  }, null, context.subscriptions);
  p.onDidDispose(() => { if (panel === p) { panel = null; ready = false; pending = []; } }, null, context.subscriptions);
  return p;
}

function openViewer(context) {
  if (panel) { panel.reveal(undefined, true); return panel; }
  const p = vscode.window.createWebviewPanel('sysmlViewer', 'SysML Viewer', { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, {
    enableScripts: true, retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
  });
  return setupPanel(p, context);
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('sysmlViewer.open', () => openViewer(context)),
    vscode.commands.registerCommand('sysmlViewer.refresh', () => { if (panel) sendFiles(); else openViewer(context); }),
    vscode.commands.registerCommand('sysmlViewer.reveal', () => {
      const ed = vscode.window.activeTextEditor;
      if (!ed || !MODEL_EXT.test(ed.document.fileName)) { vscode.window.showInformationMessage(msg('openFirst')); return; }
      const name = vscode.workspace.asRelativePath(ed.document.uri, (vscode.workspace.workspaceFolders || []).length > 1);
      openViewer(context);
      post({ type: 'reveal', file: name, line: ed.selection.active.line + 1 });
    })
  );
  // Dateien beobachten: Speichern, Anlegen, Löschen, Umbenennen
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.{sysml,kerml}');
  watcher.onDidChange(() => scheduleSend(250)); watcher.onDidCreate(() => scheduleSend(250)); watcher.onDidDelete(() => scheduleSend(250));
  context.subscriptions.push(watcher);
  // Live beim Tippen
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
    if (panel && cfg().get('liveUpdate') && MODEL_EXT.test(e.document.fileName)) scheduleSend(500);
  }));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
    if (!panel) return;
    if (e.affectsConfiguration('sysmlViewer.followNavigator')) post(configMsg());
    if (e.affectsConfiguration('sysmlViewer.include') || e.affectsConfiguration('sysmlViewer.exclude')) scheduleSend(100);
  }));
  // Viewer nach Neustart von VS Code wiederherstellen
  if (vscode.window.registerWebviewPanelSerializer) {
    context.subscriptions.push(vscode.window.registerWebviewPanelSerializer('sysmlViewer', {
      async deserializeWebviewPanel(p) { setupPanel(p, context); }
    }));
  }
}
function deactivate() {}
module.exports = { activate, deactivate };
