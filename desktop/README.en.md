# SysML v2 Viewer – desktop app (Rust/Tauri)

[Deutsch](README.md) · **English**

The viewer as a standalone program for Windows, macOS and Linux. The user interface is the same as in the browser and in VS Code; Rust adds what is missing there:

| Feature | In the browser | In the desktop app |
|---|---|---|
| Open a folder | browser picker, limited in some browsers | the operating system's folder dialog; the last folder is reopened on start |
| Save changes | not possible | **Save** or `Ctrl+S` writes back to the files; ● marks unsaved files; the app asks before closing |
| Changes from outside | only after “Reload” | the folder is watched – save in VS Code or another editor and the view updates immediately. Files with unsaved changes are left alone |
| Baseline comparison | kept state, folder, files | additionally the **last Git commit** of the open folder |
| Export diagrams | copy SVG, show PNG | additionally **Save SVG …** and **Save PNG …** |
| Offline | layout library comes from a CDN | everything local, works offline |
| Folder on start | – | `sysml-viewer <folder>` opens the folder directly |

## Install

GitHub Actions builds installers on every push to this branch and on every `v*` tag: in the repository under **Actions → Desktop-App bauen → latest run → Artifacts**.

| System | File |
|---|---|
| Windows | `.msi` or `…-setup.exe` |
| macOS | `.dmg` |
| Linux | `.AppImage` or `.deb` |

The installers are not signed. Windows therefore shows “Windows protected your PC” on first start → **More info → Run anyway**. macOS: right-click the app → **Open**.

## Build it yourself

Requirements: [Rust](https://rustup.rs), Node.js 18+, Python 3. On Linux also `libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev`; on Windows WebView2 (included in Windows 10/11).

```bash
npm install            # once, fetches elkjs
npm run desktop        # start the app in development mode
npm run desktop:build  # installers into desktop/src-tauri/target/release/bundle/
npm run desktop:test   # tests of the Rust part
```

## Structure

```
desktop/
  ui/                    user interface – generated from src/ by tools/build.py, do not edit by hand
  src-tauri/
    src/lib.rs           Rust: read and watch the folder, save, Git baseline, export, close
    src/main.rs          entry point
    tauri.conf.json      window, bundle, icons
    capabilities/        window permissions
src/desktop.js           counterpart in the viewer: active only when running inside the app
```

The UI talks to Rust via `invoke` (`open_folder`, `save_model_file`, `git_baseline_cmd`, `save_export` …) and receives the events `folder-changed` and `close-requested`. Only `.sysml`, `.kerml` and `tour*.json` inside the open folder are written; Rust rejects paths with `..` and absolute paths.

## Limitations

- One folder per window.
- Saving overwrites the file without asking, even if it was changed outside. The app does warn, however, as soon as a file you are editing is changed from outside.
- The Git comparison needs `git` installed and on the path.
