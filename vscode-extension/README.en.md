# SysML v2 Viewer

[Deutsch](README.md) · **English**

Navigator and diagrams for SysML v2 text models, right inside VS Code. The viewer reads all `.sysml` and `.kerml` files of the open folder and updates while you type.

## What it shows

**Navigator**
- **Coverage** – which requirement is satisfied by which component (`satisfy`) and verified by which test (`verify`). Gaps are marked in red.
- **Traceability** – one element in focus, next to it everything attached to it: requirements, structure, interfaces, behaviour, verification. A click moves the focus, “Your path” leads back.
- **Impact** – what is affected when an element changes, with reason and path.
- **Start** – entry questions and a guided tour through your own model.
- **Disciplines** – mechanics, electronics, software (via `metadata def` in the model) and the interfaces between them.
- **Compare** – differences from the last Git commit: what is new, removed or changed and which tests to repeat. Unsaved changes are included.

**Diagrams**: overview by file, connections (IBD), states, actions, requirements, detail diagram by clicking a part.

## Usage

| Action | How |
|---|---|
| Open the viewer | `Ctrl+Shift+P` → **SysML: Open viewer**, or the icon at the top right of a `.sysml` file |
| Show the element under the cursor in the navigator | Right-click → **Show element in navigator** or `Ctrl+Alt+N` |
| From the viewer to the source | Click a line link on a card, a hint or an edge |
| Let the editor follow along | Setting `sysmlViewer.followNavigator` |

## Language

On first opening, the viewer uses the VS Code display language (German or English; English for any other language). You can switch at any time at the top right of the viewer; the choice is remembered. Commands and settings appear in the VS Code display language.

## Settings

| Setting | Default | Effect |
|---|---|---|
| `sysmlViewer.followNavigator` | off | The editor jumps along whenever the focus in the navigator changes |
| `sysmlViewer.liveUpdate` | on | Update the view while typing |
| `sysmlViewer.include` | `**/*.{sysml,kerml}` | Which files are read |
| `sysmlViewer.exclude` | `**/{node_modules,.git,build,dist,out}/**` | E.g. exclude the standard library |

## Limitations

The viewer understands the common constructs of the textual notation but does not validate the model. Expressions, the standard library and import resolution are not evaluated. For syntax checking, use a language extension such as SysIDE in addition.
