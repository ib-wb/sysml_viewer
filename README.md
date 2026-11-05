# SysML v2 Viewer

Navigator und Diagramme für **SysML-v2-Textmodelle** – im Browser und als VS-Code-Erweiterung. Der Viewer liest ein ganzes Projekt aus mehreren `.sysml`/`.kerml`-Dateien und beantwortet die Fragen, die bei der Arbeit am Modell ständig auftauchen:

- Welche Anforderung wird von welcher Komponente umgesetzt – und von welchem Test geprüft?
- Was hängt an diesem Element: Struktur, Schnittstellen, Verhalten, Nachweise?
- Was ist betroffen, wenn ich es ändere?

Begleitwerkzeug zum Lehrbuch *SysML v2, MBSE und ROS2 für Einsteiger* (Wolfgang Becker, [ib-wb.de](https://ib-wb.de)).

## Funktionen

**Navigator**

| Sicht | Inhalt |
|---|---|
| Abdeckung | Matrix Anforderung → umgesetzt durch (`satisfy`) → verifiziert durch (`verify`), Lücken rot markiert |
| Rückverfolgung | Fokus-Element mit Spalten Anforderungen · Struktur · Schnittstellen · Verhalten · Nachweis; Klick verschiebt den Fokus, „Dein Weg“ führt zurück |
| Auswirkung | Was ist bei einer Änderung betroffen – mit Reichweite, Begründung und Weg je Element |

**Lernhilfen**

| Funktion | Was sie tut |
|---|---|
| Fokus | Ein Element bleibt über Navigator, Diagramme, Detailansicht und Modellbaum hinweg ausgewählt; Diagramme wählen automatisch einen Kontext, in dem es vorkommt, und heben es hervor |
| Steckbrief | Beschreibt das Fokus-Element in Klartext: was es ist, woraus es besteht, womit es verbunden ist, welche Anforderung es erfüllt, welcher Test es prüft, was eine Änderung betrifft – Lücken rot |
| Modell-Check | Fehler (tote Verweise, unbekannte Typen, unpassende Port-Richtungen), Lücken (Anforderung ohne Umsetzung oder Test, Test ohne Anforderung) und Hinweise (offene Ports, Komponenten ohne Anforderung, unbenutzte Definitionen) – jeweils mit Begründung, Sprung und Code-Vorschlag |
| Notation erklären | Beim Überfahren mit der Maus erklärt der Viewer Linien, Pfeilspitzen, Ports, eckige und runde Kästen, `^`, `:>>`, Stereotypen und Beziehungen – mit SysML-Beispiel; abschaltbar |

**Diagramme**: Übersicht nach Dateien gruppiert, Verbindungen (IBD mit Ports), Zustände, Aktionen, Anforderungen; Klick auf einen Part öffnet ein Detaildiagramm (Vererbung, Verwendung, erfüllte Anforderungen, innere Struktur). Namenskollisionen über Dateigrenzen werden gemeldet und lassen sich per Auswahl auflösen. Export als SVG oder PNG.

## Benutzen

**Im Browser:** `dist/sysml-viewer.html` öffnen, dann „Ordner öffnen“ oder einen Ordner auf die Seite ziehen. Es wird nichts hochgeladen, alles läuft lokal im Browser.

**In VS Code:**
1. `npm install` und `npm run package` – erzeugt `dist/sysml-v2-viewer-<version>.vsix`
2. VS Code → Erweiterungen → `…` → **Install from VSIX…**
3. `Strg+Shift+P` → **SysML: Viewer öffnen**

| Aktion in VS Code | So geht's |
|---|---|
| Element unter dem Cursor im Navigator zeigen | Rechtsklick → **Element im Navigator zeigen** oder `Strg+Alt+N` |
| Vom Viewer in den Quelltext | Zeilen-Link, Hinweis oder Kante anklicken |
| Editor automatisch mitlaufen lassen | Einstellung `sysmlViewer.followNavigator` |

Die Ansicht aktualisiert sich beim Tippen, auch ohne Speichern.

## Was das Modell für die Rückverfolgung braucht

Der Navigator folgt nur Beziehungen, die modelliert sind:

| Beziehung | SysML v2 |
|---|---|
| Typisierung / Spezialisierung | `part akku : Akku;` · `part def Akku :> Komponente` |
| Komposition | `part akku` in `part def Roboter` |
| Schnittstelle | `interface : Versorgung connect akku.ausgang to rechner.energie;` |
| Umsetzung | `satisfy laufzeit by roboter.akku;` |
| Nachweis | `verification def T { objective { verify laufzeit; } }` |
| Ableitung | `#derivation connection { end #original ::> a; end #derive ::> b; }` |
| Allokation | `allocate NavigiereZumZiel to roboter.rechner;` |

Ein vollständiges Beispiel mit zwei absichtlichen Lücken liegt in `beispiel/indoorroboter/`.

## Grenzen

Der Parser versteht die gängigen Konstrukte der Textnotation, prüft das Modell aber nicht auf Gültigkeit: Ausdrücke, Standardbibliothek, Sichtbarkeit und Import-Auflösung werden nicht ausgewertet; Namen werden über den einfachen Namen und die Paketnähe aufgelöst. Für Syntaxprüfung eignet sich zusätzlich eine Sprach-Erweiterung wie SysIDE.

## Aufbau des Repositorys

```
src/                 Quellen des Viewers
  core.js            Tokenizer, Parser, Modellindex, Diagramm-Sichten, Layout/Render, Trace-Graph
  app.js             Oberfläche, Dateien, Diagramm-Modus, VS-Code-Anbindung
  nav.js             Navigator: Abdeckung, Rückverfolgung, Auswirkung
  learn.js           Lernhilfen: gemeinsamer Fokus, Steckbrief, Modell-Check, Notationserklärungen
  page.html          Seitengerüst und Styles
  diag.css           Styles der Diagramme (auch für SVG-Export)
tools/build.py       baut dist/ und die Webview der Erweiterung
dist/                fertige Browser-Version
vscode-extension/    VS-Code-Erweiterung (extension.js, package.json, media/)
beispiel/            Beispielprojekt Indoorroboter (5 Dateien)
tests/               Parser-, Traceability-, Steckbrief- und Check-Tests; Test der Erweiterung gegen ein VS-Code-Mock
  fixtures/          absichtlich fehlerhaftes Modell für den Modell-Check
```

## Entwickeln

```bash
npm install          # elkjs (Layout) und vsce (Paketierung)
npm run build        # src/ → dist/sysml-viewer.html + vscode-extension/media/
npm test             # Parser, Traceability, Erweiterung
npm run package      # .vsix nach dist/
```

Abhängigkeiten zur Laufzeit: [elkjs](https://github.com/kieler/elkjs) 0.9.3 (EPL-2.0) für das Layout; im Browser per CDN, in der Erweiterung lokal eingebunden.

## Lizenz

Siehe [LICENSE.md](LICENSE.md).
