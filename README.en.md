# SysML v2 Viewer

[Deutsch](README.md) · **English**

Navigator and diagrams for **SysML v2 text models** – in the browser, as a VS Code extension and as a desktop app (Rust/Tauri). The viewer reads a whole project made of several `.sysml`/`.kerml` files and answers the questions that keep coming up while working on a model:

- Which requirement is implemented by which component – and verified by which test?
- What is attached to this element: structure, interfaces, behaviour, verification?
- What is affected if I change it?

Companion tool to the textbook *SysML v2, MBSE und ROS2 für Einsteiger* (German; Wolfgang Becker, [ib-wb.de](https://ib-wb.de)).

## Features

**Navigator**

| View | Content |
|---|---|
| Start | The model in numbers and guiding questions – “What does the system require?”, “What does it consist of?”, “How are the parts connected?”, “What is still open?”, “What happens if I change something?” – each leads straight to the matching view |
| Coverage | Matrix requirement → implemented by (`satisfy`) → verified by (`verify`), gaps marked in red |
| Traceability | Focus element with the columns requirements · structure · interfaces · behaviour · verification; a click moves the focus, “Your path” leads back |
| Impact | What a change affects – with reach, reason and path for each element |
| Disciplines | Overview of what belongs to mechanics, electronics, software … and interfaces across discipline boundaries. **Discipline view**: pick one discipline or *Test* – then only its part counts (parts, ports, satisfied requirements, tests), all diagrams dim everything else and mark the parts on the boundary with a dashed frame |
| Compare | Differences from a baseline (kept state, folder, files or – in VS Code – the last Git commit): new, removed, changed and renamed elements (same ID `<'R1'>` = same element), requirements to re-prove, tests to repeat, coverage and model check before/after; marked in the diagrams |

**Learning aids**

| Feature | What it does |
|---|---|
| Guided tour | 8–10 steps from requirement to test. If a `tour.json` is in the model folder, it tells its text; otherwise the viewer generates the tour from the model |
| Focus | One element stays selected across navigator, diagrams, detail view and model tree; diagrams automatically pick a context in which it appears and highlight it |
| Profile | Describes the focus element in plain language: what it is, what it consists of, what it is connected to, which requirement it satisfies, which test checks it, what a change affects – gaps in red |
| Model check | Errors (dangling references, unknown types, mismatched port directions), gaps (requirement without implementation or test, test without requirement) and hints (open ports, components without a requirement, unused definitions) – each with a reason, a jump to the source and a code suggestion |
| Explain notation | On mouse-over the viewer explains lines, arrowheads, ports, square and rounded boxes, `^`, `:>>`, stereotypes and relationships – with a SysML example and, if filled in, the book chapter; can be switched off |

**Diagrams**: overview grouped by file, connections (IBD with ports), states, actions, requirements; clicking a part opens a detail diagram (inheritance, usage, satisfied requirements, internal structure). Name collisions across files are reported and can be resolved by choosing the valid definition. Export as SVG or PNG.

## Usage

**In the browser:** open `dist/sysml-viewer.html`, then click “Open folder” or drop a folder onto the page. Nothing is uploaded; everything runs locally in the browser.

**In VS Code:**
1. `npm install` and `npm run package` – creates `dist/sysml-v2-viewer-<version>.vsix`
2. VS Code → Extensions → `…` → **Install from VSIX…**
3. `Ctrl+Shift+P` → **SysML: Open viewer**

| Action in VS Code | How |
|---|---|
| Show the element under the cursor in the navigator | Right-click → **Show element in navigator** or `Ctrl+Alt+N` |
| From the viewer to the source | Click a line link, hint or edge |
| Let the editor follow along | Setting `sysmlViewer.followNavigator` |

The view updates while you type, even without saving.

**As a desktop app:** installers for Windows, macOS and Linux under *Actions → Desktop-App bauen*; the app saves changes, watches the folder and compares with the last Git commit. Details in [desktop/README.en.md](desktop/README.en.md).

## What the model needs for traceability

The navigator only follows relationships that are modelled:

| Relationship | SysML v2 |
|---|---|
| Typing / specialization | `part battery : Battery;` · `part def Battery :> Component` |
| Composition | `part battery` in `part def Robot` |
| Interface | `interface : PowerSupply connect battery.output to controller.power;` |
| Implementation | `satisfy runtime by robot.battery;` |
| Verification | `verification def T { objective { verify runtime; } }` |
| Derivation | `#derivation connection { end #original ::> a; end #derive ::> b; }` |
| Allocation | `allocate NavigateToGoal to robot.controller;` |

## Disciplines in the model

Disciplines are ordinary metadata. The viewer has no fixed names – every `metadata def` applied in the model is a discipline:

```
package Disciplines {
    metadata def Mechanics;
    metadata def Electronics;
    metadata def Software;
}
#Mechanics part def Wheel { … }       // as a prefix
part def Battery { @Electronics; }    // or in the body
```

Usages inherit the discipline of their definition, definitions that of their more general definition. If an element has several, the first one counts.

## Your own tour

A `tour.json` (or `tour.de.json`, `tour.en.json` per language) in the model folder replaces the generated tour. The viewer reads it along with the model; it also appears in the file list and can be edited there.

```json
{
  "title": "From requirement to verification",
  "steps": [
    { "show": "reqs", "title": "What does the system require?", "text": "Five requirements …" },
    { "focus": "Requirements::robotRequirements::runtime", "show": "trace", "code": true,
      "title": "R1: two hours of runtime", "text": "…", "chapter": "Ch. 6" }
  ]
}
```

| Field | Meaning |
|---|---|
| `title`, `text` | Heading and explanation of the step |
| `focus` | Element in focus: qualified name (`Package::Element`) or simple name |
| `show` | `start`, `reqs`, `struct`, `ibd`, `states`, `actions`, `diagram` (matching diagram for the focus), `cover`, `gaps`, `trace`, `impact`, `check`, `disc`, `diff` |
| `code` | `true` = source line of the element, or your own code snippet |
| `chapter` | Reference into the book, shown below the text |

The sample project contains a nine-step draft. The test checks that every `focus` element exists in the model and that the tour has 8–10 steps.

## Book chapters for the notation explanations

`src/book.json` maps each notation, the navigator tabs and the steps of the generated tour to a section of the (German) book, edition 16.1, e.g. `"e-iface": "Kap. 10.8 Schnittstellen in SysML"`. Empty entries are not shown. The keys are prefilled: `e-…` lines in diagrams, `c-…` compartments in boxes, `r-…` relationships in the profile, plus element kinds (`part def`, `port` …). Run `npm run build` afterwards.

## Sample project

A complete sample with two deliberate gaps is in `beispiel/indoor-robot/`, with identical content in German in `beispiel/indoorroboter/`. The viewer shows the sample in the selected language; switching the language swaps it as long as you have not edited it.

## Limitations

The parser understands the common constructs of the textual notation but does not validate the model: expressions, the standard library, visibility and import resolution are not evaluated; names are resolved by their simple name and package proximity. For syntax checking, use a language extension such as SysIDE in addition.

## Languages

The user interface and explanations are available in German and English; switch at the top right. On first start the viewer uses the browser language, in VS Code the VS Code display language; if that language is not available, English. The choice in the menu is remembered and takes precedence.

SysML keywords (`part def`, `satisfy`, `verify` …) and compartment names such as `parts` or `ports` are not translated – they are notation, not UI text. The model content also stays as it is.

**Adding a language**, e.g. French:

1. Copy `src/lang/de.json` to `src/lang/fr.json`.
2. Set `_name` (shown in the menu, e.g. `Français`) and `_locale` (e.g. `fr-FR`), then translate the values. Do not change the keys.
3. Keep placeholders such as `{name}` or `{n}` unchanged. Keys ending in `.one` / `.other` are plural forms; languages with more forms (e.g. `.few`, `.many`) can add them – the form is chosen via `Intl.PluralRules`.
4. `npm test` – the language test reports missing or extra keys and mismatched placeholders.
5. `npm run build` – the file is picked up automatically by the viewer and its language menu.

If a key is missing in a language, the viewer shows the German text.

A dedicated sample project for the new language is optional: create a folder under `beispiel/` and register it in `SAMPLES` in `tools/build.py`. Without an entry the viewer shows the English sample. The language test checks that all samples have the same coverage and the same gaps. For the commands and settings of the VS Code extension, also add `vscode-extension/package.nls.fr.json` (template: `package.nls.json`).

## Repository layout

```
src/                 viewer sources
  core.js            tokenizer, parser, model index, diagram views, layout/render, trace graph
  app.js             user interface, files, diagram mode, VS Code integration
  nav.js             navigator: coverage, traceability, impact
  learn.js           learning aids: shared focus, profile, model check, notation explanations
  guide.js           getting started: start page, guided tour, disciplines, baseline comparison
  desktop.js         desktop app integration (active only there)
  page.html          page skeleton and styles
  diag.css           diagram styles (also used for SVG export)
  lang/              UI texts per language: de.json (base), en.json, …
  book.json          book chapters for the notation explanations
tools/build.py       builds dist/ and the extension webview
dist/                ready-to-use browser version
vscode-extension/    VS Code extension (extension.js, package.json, media/)
desktop/             desktop app: Rust/Tauri (src-tauri/) with the UI from src/ (ui/, generated)
beispiel/            indoor robot sample, 6 model files and tour.json each: indoorroboter/ (de), indoor-robot/ (en)
tests/               parser, traceability, profile, check and language tests; extension test against a VS Code mock
  fixtures/          deliberately faulty model for the model check
```

## Development

```bash
npm install          # elkjs (layout) and vsce (packaging)
npm run build        # src/ → dist/sysml-viewer.html + vscode-extension/media/
npm test             # parser, traceability, language files, extension
npm run package      # .vsix into dist/
npm run desktop      # start the desktop app (needs Rust, see desktop/README.en.md)
```

Runtime dependency: [elkjs](https://github.com/kieler/elkjs) 0.9.3 (EPL-2.0) for the layout; loaded from a CDN in the browser, bundled locally in the extension.

## License

See [LICENSE.md](LICENSE.md) (German). In short: use for teaching, training and your own projects is permitted, as is passing the unmodified .vsix file on to pupils and students; all other rights reserved. Third-party components: elkjs (EPL-2.0), IBM Plex fonts (OFL 1.1).
