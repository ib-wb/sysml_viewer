# SysML v2 Viewer – Desktop-App (Rust/Tauri)

**Deutsch** · [English](README.en.md)

Der Viewer als eigenständiges Programm für Windows, macOS und Linux. Die Oberfläche ist dieselbe wie im Browser und in VS Code; Rust übernimmt, was dort fehlt:

| Funktion | Im Browser | In der Desktop-App |
|---|---|---|
| Ordner öffnen | Auswahl im Browser, je nach Browser eingeschränkt | Ordnerdialog des Betriebssystems, zuletzt geöffneter Ordner wird beim Start wieder geladen |
| Änderungen speichern | nicht möglich | **Speichern** bzw. `Strg+S` schreibt in die Dateien zurück; ● markiert ungespeicherte Dateien; beim Schließen fragt die App nach |
| Änderungen von außen | erst nach „Neu einlesen“ | Ordner wird überwacht – speicherst du in VS Code oder einem anderen Editor, aktualisiert sich die Ansicht sofort. Dateien mit ungespeicherten Änderungen bleiben unangetastet |
| Baseline-Vergleich | gemerkter Stand, Ordner, Dateien | zusätzlich **letzter Git-Commit** des geöffneten Ordners |
| Diagramme exportieren | SVG kopieren, PNG anzeigen | zusätzlich **SVG speichern …** und **PNG speichern …** |
| Ohne Internet | Layout-Bibliothek kommt vom CDN | alles lokal, läuft offline |
| Ordner beim Start | – | `sysml-viewer <ordner>` öffnet den Ordner direkt |

## Installieren

Fertige Installer baut GitHub Actions bei jedem Push auf diesen Branch und bei jedem Tag `v*`: im Repository unter **Actions → Desktop-App bauen → letzter Lauf → Artifacts**.

| System | Datei |
|---|---|
| Windows | `.msi` oder `…-setup.exe` |
| macOS | `.dmg` |
| Linux | `.AppImage` oder `.deb` |

Die Installer sind nicht signiert. Windows zeigt deshalb beim ersten Start „Der Computer wurde durch Windows geschützt“ → **Weitere Informationen → Trotzdem ausführen**. macOS: Rechtsklick auf die App → **Öffnen**.

## Selbst bauen

Voraussetzungen: [Rust](https://rustup.rs), Node.js 18+, Python 3. Unter Linux zusätzlich `libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev`, unter Windows WebView2 (bei Windows 10/11 vorhanden).

```bash
npm install            # einmalig, holt elkjs
npm run desktop        # App im Entwicklungsmodus starten
npm run desktop:build  # Installer nach desktop/src-tauri/target/release/bundle/
npm run desktop:test   # Tests des Rust-Teils
```

## Aufbau

```
desktop/
  ui/                    Oberfläche – wird von tools/build.py aus src/ erzeugt, nicht von Hand ändern
  src-tauri/
    src/lib.rs           Rust: Ordner lesen und überwachen, speichern, Git-Baseline, Export, Schließen
    src/main.rs          Einstieg
    tauri.conf.json      Fenster, Bundle, Symbole
    capabilities/        Rechte des Fensters
src/desktop.js           Gegenstück im Viewer: aktiv nur, wenn er in der App läuft
```

Die Oberfläche spricht über `invoke` mit Rust (`open_folder`, `save_model_file`, `git_baseline_cmd`, `save_export` …) und erhält die Ereignisse `folder-changed` und `close-requested`. Gespeichert werden nur `.sysml`, `.kerml` und `tour*.json` innerhalb des geöffneten Ordners; Pfade mit `..` oder absolute Pfade lehnt Rust ab.

## Grenzen

- Ein Ordner pro Fenster.
- Speichern überschreibt die Datei ohne Rückfrage, auch wenn sie außerhalb geändert wurde. Die App warnt aber, sobald eine Datei, die du gerade bearbeitest, von außen geändert wird.
- Für den Git-Vergleich muss `git` installiert und im Pfad sein.
