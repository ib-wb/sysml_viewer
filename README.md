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

Ein vollständiges Beispiel mit zwei absichtlichen Lücken liegt in `beispiel/indoorroboter/`, inhaltsgleich auf Englisch in `beispiel/indoor-robot/`. Der Viewer zeigt das Beispiel in der eingestellten Sprache; ein Sprachwechsel tauscht es aus, solange du es nicht bearbeitet hast.

## Grenzen

Der Parser versteht die gängigen Konstrukte der Textnotation, prüft das Modell aber nicht auf Gültigkeit: Ausdrücke, Standardbibliothek, Sichtbarkeit und Import-Auflösung werden nicht ausgewertet; Namen werden über den einfachen Namen und die Paketnähe aufgelöst. Für Syntaxprüfung eignet sich zusätzlich eine Sprach-Erweiterung wie SysIDE.

## Sprachen

Oberfläche und Erklärtexte gibt es auf Deutsch und Englisch; umgeschaltet wird oben rechts. Beim ersten Start nimmt der Viewer die Browsersprache, in VS Code die Sprache von VS Code; gibt es diese Sprache nicht, Englisch. Die Wahl im Menü wird gemerkt und hat Vorrang.

Nicht übersetzt werden SysML-Schlüsselwörter (`part def`, `satisfy`, `verify` …) und Abteilungsnamen wie `parts` oder `ports` – das ist Notation, kein Oberflächentext. Ebenso bleibt der Inhalt des Modells, wie er ist.

**Eine Sprache ergänzen**, z. B. Französisch:

1. `src/lang/de.json` nach `src/lang/fr.json` kopieren.
2. `_name` (Anzeige im Menü, z. B. `Français`) und `_locale` (z. B. `fr-FR`) setzen, dann die Werte übersetzen. Schlüssel nicht ändern.
3. Platzhalter wie `{name}` oder `{n}` unverändert übernehmen. Schlüssel mit `.one` / `.other` sind Pluralformen; Sprachen mit weiteren Formen (z. B. `.few`, `.many`) können sie ergänzen – gewählt wird über `Intl.PluralRules`.
4. `npm test` – der Sprachtest meldet fehlende oder überzählige Schlüssel und abweichende Platzhalter.
5. `npm run build` – die Datei landet automatisch im Viewer und im Sprachmenü.

Fehlt ein Schlüssel in einer Sprache, zeigt der Viewer den deutschen Text.

Ein eigenes Beispielprojekt für die neue Sprache ist optional: Ordner unter `beispiel/` anlegen und in `tools/build.py` bei `SAMPLES` eintragen. Ohne Eintrag zeigt der Viewer das englische Beispiel. Der Sprachtest prüft, dass alle Beispiele dieselbe Abdeckung und dieselben Lücken haben. Für die Befehle und Einstellungen der VS-Code-Erweiterung zusätzlich `vscode-extension/package.nls.fr.json` anlegen (Vorlage: `package.nls.de.json`).

## Aufbau des Repositorys

```
src/                 Quellen des Viewers
  core.js            Tokenizer, Parser, Modellindex, Diagramm-Sichten, Layout/Render, Trace-Graph
  app.js             Oberfläche, Dateien, Diagramm-Modus, VS-Code-Anbindung
  nav.js             Navigator: Abdeckung, Rückverfolgung, Auswirkung
  learn.js           Lernhilfen: gemeinsamer Fokus, Steckbrief, Modell-Check, Notationserklärungen
  page.html          Seitengerüst und Styles
  diag.css           Styles der Diagramme (auch für SVG-Export)
  lang/              Oberflächentexte je Sprache: de.json (Basis), en.json, …
tools/build.py       baut dist/ und die Webview der Erweiterung
dist/                fertige Browser-Version
vscode-extension/    VS-Code-Erweiterung (extension.js, package.json, media/)
beispiel/            Beispielprojekt Indoorroboter, je 5 Dateien: indoorroboter/ (de), indoor-robot/ (en)
tests/               Parser-, Traceability-, Steckbrief-, Check- und Sprachtests; Test der Erweiterung gegen ein VS-Code-Mock
  fixtures/          absichtlich fehlerhaftes Modell für den Modell-Check
```

## Entwickeln

```bash
npm install          # elkjs (Layout) und vsce (Paketierung)
npm run build        # src/ → dist/sysml-viewer.html + vscode-extension/media/
npm test             # Parser, Traceability, Sprachdateien, Erweiterung
npm run package      # .vsix nach dist/
```

Abhängigkeiten zur Laufzeit: [elkjs](https://github.com/kieler/elkjs) 0.9.3 (EPL-2.0) für das Layout; im Browser per CDN, in der Erweiterung lokal eingebunden.

## Lizenz

Siehe [LICENSE.md](LICENSE.md).
