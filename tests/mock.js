// Minimaler vscode-Mock, um extension.js ohne VS Code zu prüfen
const fs = require('fs'), path = require('path');
const WS = path.resolve(__dirname, '..', 'beispiel', 'indoorroboter');
const log = []; const handlers = {}; let webviewMsgHandler = null; const posted = [];
class Uri { constructor(p) { this.fsPath = p; } toString() { return 'file://' + this.fsPath; } static file(p) { return new Uri(p); } static joinPath(u, ...ps) { return new Uri(path.join(u.fsPath, ...ps)); } }
function walk(d) { let r = []; for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) r = r.concat(walk(p)); else r.push(p); } return r; }
const editors = [];
const vscode = {
  env: { language: 'en' },
  Uri, ViewColumn: { One: 1, Two: 2, Beside: -2 }, TextEditorRevealType: { InCenterIfOutsideViewport: 2 },
  workspace: {
    workspaceFolders: [{ name: 'Indoorroboter', uri: Uri.file(WS) }], name: 'Indoorroboter', textDocuments: [],
    getConfiguration: () => ({ get: k => ({ include: '**/*.{sysml,kerml}', exclude: '', followNavigator: false, liveUpdate: true })[k] }),
    findFiles: async (inc) => walk(WS).filter(p => /\.(sysml|kerml)$/.test(p) && (!inc.startsWith('**/') || inc.includes('{') || p.endsWith(inc.slice(3)))).map(Uri.file),
    asRelativePath: u => path.relative(WS, u.fsPath).split(path.sep).join('/'),
    fs: { readFile: async u => fs.readFileSync(u.fsPath) },
    openTextDocument: async u => { const lines = fs.readFileSync(u.fsPath, 'utf8').split('\n'); return { uri: u, fileName: u.fsPath, lineCount: lines.length, lineAt: i => ({ range: { line: i, text: lines[i] } }) }; },
    createFileSystemWatcher: () => ({ onDidChange() {}, onDidCreate() {}, onDidDelete() {}, dispose() {} }),
    onDidChangeTextDocument: () => ({ dispose() {} }), onDidChangeConfiguration: () => ({ dispose() {} }),
  },
  window: {
    activeTextEditor: null, visibleTextEditors: editors,
    createWebviewPanel: (id, title, col, opts) => {
      const p = { viewColumn: 2, webview: { options: opts, cspSource: 'vscode-resource:', asWebviewUri: u => 'vscode-resource:' + u.fsPath, html: '',
        postMessage: m => { posted.push(m); return Promise.resolve(true); }, onDidReceiveMessage: (h) => { webviewMsgHandler = h; } },
        onDidDispose() {}, reveal() {}, dispose() {} };
      vscode._panel = p; return p;
    },
    showTextDocument: async (doc, o) => { log.push(['show', vscode.workspace.asRelativePath(doc.uri), o.selection.line + 1, o.viewColumn, o.preserveFocus]); return { revealRange() {} }; },
    showWarningMessage: m => log.push(['warn', m]), showInformationMessage: m => log.push(['info', m]),
    registerWebviewPanelSerializer: () => ({ dispose() {} }),
  },
  commands: { registerCommand: (n, f) => { handlers[n] = f; return { dispose() {} }; } },
};
module.exports = { vscode, log, handlers, posted, send: m => webviewMsgHandler(m) };
