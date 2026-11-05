#!/usr/bin/env python3
"""Baut den SysML v2 Viewer aus src/ zusammen.

Ergebnis:
  dist/sysml-viewer.html              eigenständige Seite für den Browser
  vscode-extension/media/viewer.html  Webview-Variante für die VS-Code-Erweiterung
  vscode-extension/media/elk.bundled.js  Layout-Bibliothek (aus node_modules)
"""
import json, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
SAMPLE_DIR = os.path.join(ROOT, 'beispiel', 'indoorroboter')

def read(*p):
    with open(os.path.join(*p), encoding='utf-8') as f:
        return f.read()

def sample_files():
    files = []
    for dp, _, fs in os.walk(SAMPLE_DIR):
        for f in fs:
            if f.endswith(('.sysml', '.kerml')):
                p = os.path.join(dp, f)
                files.append({'name': os.path.relpath(p, SAMPLE_DIR).replace(os.sep, '/'), 'text': read(p)})
    files.sort(key=lambda x: (x['name'].count('/'), x['name']))
    return files

def page():
    css = read(SRC, 'diag.css')
    app = read(SRC, 'app.js').replace('/*NAV*/', read(SRC, 'nav.js') + '\n' + read(SRC, 'learn.js'))
    p = read(SRC, 'page.html')
    p = p.replace('/*DIAGCSS*/', css).replace('/*APP*/', app).replace('/*CORE*/', read(SRC, 'core.js'))
    p = p.replace('/*SAMPLE*/', json.dumps(sample_files(), ensure_ascii=False)).replace('/*DIAGCSS_STR*/', json.dumps(css.replace('\n', '')))
    return p

HEAD = '<!doctype html><html lang="de"><head><meta charset="utf-8">{csp}<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{{color-scheme:light}}body{{margin:0;font-size:14px}}[hidden]{{display:none!important}}</style></head><body>'

def main():
    body = page()
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    with open(os.path.join(ROOT, 'dist', 'sysml-viewer.html'), 'w', encoding='utf-8') as f:
        f.write(HEAD.format(csp='') + body + '</body></html>')
    media = os.path.join(ROOT, 'vscode-extension', 'media')
    with open(os.path.join(media, 'viewer.html'), 'w', encoding='utf-8') as f:
        f.write(HEAD.format(csp='<!--CSP-->') + body + '</body></html>')
    elk = os.path.join(ROOT, 'node_modules', 'elkjs', 'lib', 'elk.bundled.js')
    if os.path.exists(elk):
        shutil.copy(elk, os.path.join(media, 'elk.bundled.js'))
    else:
        print('Hinweis: node_modules/elkjs fehlt – erst "npm install" ausführen, sonst fehlt der Erweiterung die Layout-Bibliothek.', file=sys.stderr)
    print('gebaut: dist/sysml-viewer.html, vscode-extension/media/viewer.html')

if __name__ == '__main__':
    main()
