# SysML v2 Viewer

Navigator und Diagramme für SysML-v2-Textmodelle direkt in VS Code. Der Viewer liest alle `.sysml`- und `.kerml`-Dateien des geöffneten Ordners und aktualisiert sich beim Tippen.

## Was er zeigt

**Navigator**
- **Abdeckung** – welche Anforderung von welcher Komponente erfüllt (`satisfy`) und von welchem Test verifiziert (`verify`) wird. Lücken sind rot markiert.
- **Rückverfolgung** – ein Element im Fokus, daneben alles, was daran hängt: Anforderungen, Struktur, Schnittstellen, Verhalten, Nachweis. Klick verschiebt den Fokus, „Dein Weg“ führt zurück.
- **Auswirkung** – was betroffen ist, wenn sich ein Element ändert, mit Begründung und Weg.

**Diagramme**: Übersicht nach Dateien, Verbindungen (IBD), Zustände, Aktionen, Anforderungen, Detaildiagramm per Klick auf einen Part.

## Bedienung

| Aktion | So geht's |
|---|---|
| Viewer öffnen | `Strg+Shift+P` → **SysML: Viewer öffnen**, oder Symbol oben rechts in einer `.sysml`-Datei |
| Element unter dem Cursor im Navigator zeigen | Rechtsklick → **Element im Navigator zeigen** oder `Strg+Alt+N` |
| Vom Viewer in den Quelltext | Zeilen-Link auf der Karte, Hinweis oder Kante anklicken |
| Editor automatisch mitlaufen lassen | Einstellung `sysmlViewer.followNavigator` |

## Sprache

Der Viewer übernimmt beim ersten Öffnen die Sprache von VS Code (Deutsch oder Englisch; bei anderen Sprachen Englisch). Umschalten geht jederzeit oben rechts im Viewer; die Wahl wird gemerkt. Befehle und Einstellungen erscheinen in der Sprache von VS Code.

## Einstellungen

| Einstellung | Standard | Wirkung |
|---|---|---|
| `sysmlViewer.followNavigator` | aus | Editor springt mit, sobald sich der Fokus im Navigator ändert |
| `sysmlViewer.liveUpdate` | an | Ansicht schon beim Tippen aktualisieren |
| `sysmlViewer.include` | `**/*.{sysml,kerml}` | welche Dateien gelesen werden |
| `sysmlViewer.exclude` | `**/{node_modules,.git,build,dist,out}/**` | z. B. die Standardbibliothek ausschließen |

## Grenzen

Der Viewer versteht die gängigen Konstrukte der Textnotation, prüft das Modell aber nicht auf Gültigkeit. Ausdrücke, Standardbibliothek und Import-Auflösung werden nicht ausgewertet. Für Syntaxprüfung eignet sich zusätzlich eine Sprach-Erweiterung wie SysIDE.
