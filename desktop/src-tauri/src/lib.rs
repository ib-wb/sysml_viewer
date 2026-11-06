//! SysML v2 Viewer als Desktop-App.
//!
//! Rust übernimmt alles, was ein Browser nicht darf oder nicht gut kann:
//! Ordner lesen, auf Änderungen von außen reagieren, Dateien zurückschreiben,
//! eine Baseline aus Git holen und Exporte speichern. Die Oberfläche ist der
//! bestehende Viewer (ui/index.html), der über `invoke` und Ereignisse mit Rust spricht.

use std::{
    fs,
    path::{Component, Path, PathBuf},
    process::Command,
    sync::Mutex,
    time::Duration,
};

use base64::Engine;
use notify_debouncer_mini::{
    new_debouncer,
    notify::{RecommendedWatcher, RecursiveMode},
    DebounceEventResult, Debouncer,
};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

/* ---------- Modelldateien ---------- */

/// Eine Datei des Modells, Name relativ zum geöffneten Ordner, immer mit `/`.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct ModelFile {
    pub name: String,
    pub text: String,
}

/// Ein geöffneter Modellordner.
#[derive(Serialize, Clone, Debug)]
pub struct Folder {
    pub name: String,
    pub root: String,
    pub files: Vec<ModelFile>,
}

/// Ordner, die der Viewer nie durchsucht (Werkzeuge, Bibliotheken, Build-Ausgaben).
const SKIP_DIRS: &[&str] = &[
    ".git", ".svn", ".hg", "node_modules", "build", "dist", "out", "target", ".venv", "venv", "__pycache__", ".idea", ".vscode",
];
/// Größere Dateien sind kein handgeschriebenes Modell.
const MAX_SIZE: u64 = 5_000_000;

/// `tour.json` oder `tour.<sprache>.json`, z. B. `tour.de.json`.
pub fn is_tour_file(name: &str) -> bool {
    let f = Path::new(name).file_name().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    if f == "tour.json" {
        return true;
    }
    let b = f.as_bytes();
    f.len() == 12 && f.starts_with("tour.") && f.ends_with(".json") && b[5].is_ascii_alphabetic() && b[6].is_ascii_alphabetic()
}

/// Dateien, die der Viewer liest: SysML, KerML und Tour-Dateien.
pub fn is_model_file(name: &str) -> bool {
    let l = name.to_lowercase();
    l.ends_with(".sysml") || l.ends_with(".kerml") || is_tour_file(&l)
}

fn skipped_dir(name: &str) -> bool {
    SKIP_DIRS.contains(&name)
}

/// Liegt der Pfad (relativ zum Ordner) in einem übersprungenen Unterordner?
fn in_skipped_dir(root: &Path, p: &Path) -> bool {
    p.strip_prefix(root)
        .map(|r| r.components().any(|c| matches!(c, Component::Normal(s) if skipped_dir(&s.to_string_lossy()))))
        .unwrap_or(false)
}

fn walk(root: &Path, dir: &Path, out: &mut Vec<ModelFile>) -> std::io::Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let ft = entry.file_type()?;
        if ft.is_dir() {
            if !skipped_dir(&name) {
                walk(root, &path, out)?;
            }
        } else if ft.is_file() && is_model_file(&name) && entry.metadata()?.len() <= MAX_SIZE {
            let bytes = fs::read(&path)?;
            let rel = path.strip_prefix(root).unwrap_or(&path);
            let rel = rel.components().map(|c| c.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/");
            out.push(ModelFile { name: rel, text: String::from_utf8_lossy(&bytes).replace("\r\n", "\n") });
        }
    }
    Ok(())
}

/// Liest alle Modelldateien eines Ordners, sortiert wie im Browser: erst flache Pfade, dann alphabetisch.
pub fn read_folder(root: &Path) -> Result<Folder, String> {
    if !root.is_dir() {
        return Err(format!("Kein Ordner: {}", root.display()));
    }
    // echter Pfad statt "." oder "..\\x"; dunce lässt unter Windows das \\?\-Präfix weg
    let root_buf = dunce::canonicalize(root).map_err(|e| format!("{}: {e}", root.display()))?;
    let root = root_buf.as_path();
    let mut files = Vec::new();
    walk(root, root, &mut files).map_err(|e| format!("{}: {e}", root.display()))?;
    files.sort_by(|a, b| a.name.matches('/').count().cmp(&b.name.matches('/').count()).then_with(|| a.name.cmp(&b.name)));
    let name = root.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| root.display().to_string());
    Ok(Folder { name, root: root.display().to_string(), files })
}

/// Hängt einen relativen Dateinamen an den Ordner an – nur echte Unterpfade, kein `..`, kein absoluter Pfad.
pub fn safe_join(root: &Path, name: &str) -> Result<PathBuf, String> {
    let p = Path::new(name);
    if name.is_empty() || p.is_absolute() || p.components().any(|c| !matches!(c, Component::Normal(_))) {
        return Err(format!("Ungültiger Dateiname: {name}"));
    }
    Ok(root.join(p))
}

/// Schreibt eine Modelldatei zurück. Andere Dateiarten nimmt die App nicht an.
pub fn save_file(root: &Path, name: &str, text: &str) -> Result<(), String> {
    if !is_model_file(name) {
        return Err(format!("Keine Modelldatei: {name}"));
    }
    let p = safe_join(root, name)?;
    if let Some(dir) = p.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    fs::write(&p, text).map_err(|e| format!("{}: {e}", p.display()))
}

/* ---------- Git-Baseline ---------- */

#[derive(Serialize, Clone, Debug)]
pub struct Baseline {
    pub name: String,
    pub files: Vec<ModelFile>,
}

/// Nur Revisionsangaben wie `HEAD`, `HEAD~1`, `v0.4.0` oder einen Commit-Hash – nichts, was git als Option liest.
pub fn valid_rev(rev: &str) -> bool {
    !rev.is_empty() && !rev.starts_with('-') && rev.len() <= 100 && rev.chars().all(|c| c.is_ascii_alphanumeric() || "_./~^-".contains(c))
}

fn git(args: &[&str], cwd: &Path) -> Result<String, String> {
    let out = Command::new("git").args(args).current_dir(cwd).output().map_err(|e| format!("git nicht gefunden: {e}"))?;
    if !out.status.success() {
        let msg = String::from_utf8_lossy(&out.stderr);
        return Err(msg.lines().next().unwrap_or("git-Fehler").trim().to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

/// Modelldateien des Ordners im Stand einer Git-Revision (z. B. des letzten Commits).
pub fn git_baseline(root: &Path, rev: &str) -> Result<Baseline, String> {
    if !valid_rev(rev) {
        return Err(format!("Ungültige Revision: {rev}"));
    }
    let top = PathBuf::from(git(&["rev-parse", "--show-toplevel"], root)?.trim());
    let short = git(&["rev-parse", "--short", rev], root)?.trim().to_string();
    let root_c = dunce::canonicalize(root).map_err(|e| e.to_string())?;
    let top_c = dunce::canonicalize(&top).map_err(|e| e.to_string())?;
    let rel = root_c.strip_prefix(&top_c).map_err(|e| e.to_string())?;
    let rel = rel.components().map(|c| c.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/");
    let spec = if rel.is_empty() { ".".to_string() } else { rel.clone() };
    let list = git(&["ls-tree", "-r", "--name-only", rev, "--", &spec], &top_c)?;
    let mut files = Vec::new();
    for n in list.lines().filter(|n| is_model_file(n)) {
        let inside = if rel.is_empty() { n.to_string() } else { n.strip_prefix(&format!("{rel}/")).unwrap_or(n).to_string() };
        if inside.split('/').any(skipped_dir) {
            continue;
        }
        let text = git(&["show", &format!("{rev}:{n}")], &top_c)?;
        files.push(ModelFile { name: inside, text: text.replace("\r\n", "\n") });
    }
    Ok(Baseline { name: format!("{rev} ({short})"), files })
}

/* ---------- Zustand der App ---------- */

#[derive(Default)]
struct AppState {
    root: Mutex<Option<PathBuf>>,
    watcher: Mutex<Option<Debouncer<RecommendedWatcher>>>,
    startup: Mutex<Option<PathBuf>>,
    dirty: Mutex<usize>,
}

fn current_root(state: &State<AppState>) -> Result<PathBuf, String> {
    state.root.lock().unwrap().clone().ok_or_else(|| "Kein Ordner geöffnet".to_string())
}

/// Beobachtet den Ordner und schickt bei Änderungen an Modelldateien den neuen Stand an die Oberfläche.
fn watch(app: &AppHandle, root: &Path) -> Result<Debouncer<RecommendedWatcher>, String> {
    let app = app.clone();
    let r = root.to_path_buf();
    let mut deb = new_debouncer(Duration::from_millis(400), move |res: DebounceEventResult| {
        let Ok(events) = res else { return };
        let relevant = events.iter().any(|e| is_model_file(&e.path.to_string_lossy()) && !in_skipped_dir(&r, &e.path));
        if relevant {
            if let Ok(f) = read_folder(&r) {
                let _ = app.emit("folder-changed", f);
            }
        }
    })
    .map_err(|e| e.to_string())?;
    deb.watcher().watch(root, RecursiveMode::Recursive).map_err(|e| e.to_string())?;
    Ok(deb)
}

/* ---------- Befehle für die Oberfläche ---------- */

#[tauri::command]
async fn pick_folder(app: AppHandle) -> Option<String> {
    app.dialog().file().blocking_pick_folder().and_then(|p| p.into_path().ok()).map(|p| p.display().to_string())
}

#[tauri::command]
fn open_folder(app: AppHandle, state: State<AppState>, root: String) -> Result<Folder, String> {
    let folder = read_folder(Path::new(&root))?;
    let path = PathBuf::from(&folder.root); // echter Pfad für Überwachung und Speichern
    *state.watcher.lock().unwrap() = None; // alte Überwachung beenden
    *state.watcher.lock().unwrap() = watch(&app, &path).ok();
    *state.root.lock().unwrap() = Some(path);
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_title(&format!("{} – SysML v2 Viewer", folder.name));
    }
    Ok(folder)
}

/// Ordner nur lesen, ohne ihn zu öffnen (für eine Baseline aus einem anderen Ordner).
#[tauri::command]
fn read_folder_cmd(root: String) -> Result<Folder, String> {
    read_folder(Path::new(&root))
}

#[tauri::command]
fn close_folder(app: AppHandle, state: State<AppState>) {
    *state.watcher.lock().unwrap() = None;
    *state.root.lock().unwrap() = None;
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_title("SysML v2 Viewer");
    }
}

/// Ordner, der beim Start als Argument übergeben wurde (`sysml-viewer <ordner>`). Wird nur einmal geliefert.
#[tauri::command]
fn startup_folder(state: State<AppState>) -> Option<String> {
    state.startup.lock().unwrap().take().map(|p| p.display().to_string())
}

#[tauri::command]
fn save_model_file(state: State<AppState>, name: String, text: String) -> Result<(), String> {
    save_file(&current_root(&state)?, &name, &text)
}

#[tauri::command]
async fn git_baseline_cmd(state: State<'_, AppState>, rev: Option<String>) -> Result<Baseline, String> {
    let root = current_root(&state)?;
    git_baseline(&root, rev.as_deref().unwrap_or("HEAD"))
}

/// Export speichern: SVG als Text, PNG als Base64. Liefert den gewählten Pfad oder nichts bei Abbruch.
#[tauri::command]
async fn save_export(app: AppHandle, default_name: String, data: String, base64: bool) -> Result<Option<String>, String> {
    let ext = Path::new(&default_name).extension().and_then(|e| e.to_str()).unwrap_or("svg").to_string();
    let Some(p) = app.dialog().file().set_file_name(&default_name).add_filter(ext.to_uppercase(), &[ext.as_str()]).blocking_save_file() else {
        return Ok(None);
    };
    let path = p.into_path().map_err(|e| e.to_string())?;
    let bytes = if base64 { base64::engine::general_purpose::STANDARD.decode(data.as_bytes()).map_err(|e| e.to_string())? } else { data.into_bytes() };
    fs::write(&path, bytes).map_err(|e| format!("{}: {e}", path.display()))?;
    Ok(Some(path.display().to_string()))
}

/// Anzahl ungespeicherter Dateien; nur dann fragt die App beim Schließen nach.
#[tauri::command]
fn set_dirty(state: State<AppState>, n: usize) {
    *state.dirty.lock().unwrap() = n;
}

/// Frage beim Schließen mit ungespeicherten Änderungen. `true` = speichern und schließen.
#[tauri::command]
async fn ask_close(app: AppHandle, title: String, text: String, save_label: String, discard_label: String) -> bool {
    app.dialog()
        .message(text)
        .title(title)
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(save_label, discard_label))
        .blocking_show()
}

#[tauri::command]
fn quit(app: AppHandle, state: State<AppState>) {
    *state.dirty.lock().unwrap() = 0;
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.close();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let startup = std::env::args().skip(1).map(PathBuf::from).find(|p| p.is_dir());
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState { startup: Mutex::new(startup), ..Default::default() })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let dirty = *window.state::<AppState>().dirty.lock().unwrap();
                if dirty > 0 {
                    api.prevent_close();
                    let _ = window.emit("close-requested", dirty);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            pick_folder,
            open_folder,
            read_folder_cmd,
            close_folder,
            startup_folder,
            save_model_file,
            git_baseline_cmd,
            save_export,
            set_dirty,
            ask_close,
            quit
        ])
        .run(tauri::generate_context!())
        .expect("SysML v2 Viewer konnte nicht starten");
}

/* ---------- Tests ---------- */

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../beispiel/indoorroboter")
    }

    #[test]
    fn erkennt_modell_und_tourdateien() {
        for ok in ["a.sysml", "B.KERML", "x/tour.json", "tour.de.json", "tour.EN.json"] {
            assert!(is_model_file(ok), "{ok}");
        }
        for no in ["a.txt", "tour.deu.json", "mytour.json", "tour.1x.json", "package.json"] {
            assert!(!is_model_file(no), "{no}");
        }
    }

    #[test]
    fn nennt_den_ordner_auch_bei_relativem_pfad() {
        let f = read_folder(&sample().join("struktur/..")).unwrap();
        assert_eq!(f.name, "indoorroboter");
        assert!(!f.root.contains(".."));
    }

    #[test]
    fn liest_das_beispielprojekt() {
        let f = read_folder(&sample()).unwrap();
        assert_eq!(f.name, "indoorroboter");
        let names: Vec<_> = f.files.iter().map(|m| m.name.as_str()).collect();
        assert_eq!(names[0], "System.sysml", "flache Pfade zuerst");
        assert!(names.contains(&"tour.json"));
        assert!(names.contains(&"struktur/Struktur.sysml"));
        assert_eq!(f.files.iter().filter(|m| m.name.ends_with(".sysml")).count(), 6);
    }

    #[test]
    fn ueberspringt_werkzeugordner_und_fremde_dateien() {
        let d = tempfile::tempdir().unwrap();
        fs::create_dir_all(d.path().join("node_modules/x")).unwrap();
        fs::create_dir_all(d.path().join("modell")).unwrap();
        fs::write(d.path().join("node_modules/x/lib.sysml"), "package L;").unwrap();
        fs::write(d.path().join("modell/a.sysml"), "package A;\r\n").unwrap();
        fs::write(d.path().join("notiz.txt"), "x").unwrap();
        let f = read_folder(d.path()).unwrap();
        assert_eq!(f.files, vec![ModelFile { name: "modell/a.sysml".into(), text: "package A;\n".into() }]);
        assert!(in_skipped_dir(d.path(), &d.path().join("node_modules/x/lib.sysml")));
        assert!(!in_skipped_dir(d.path(), &d.path().join("modell/a.sysml")));
    }

    #[test]
    fn speichert_nur_innerhalb_des_ordners() {
        let d = tempfile::tempdir().unwrap();
        save_file(d.path(), "neu/b.sysml", "package B;").unwrap();
        assert_eq!(fs::read_to_string(d.path().join("neu/b.sysml")).unwrap(), "package B;");
        for bad in ["../x.sysml", "/etc/x.sysml", "a/../../x.sysml", "", "a.txt"] {
            assert!(save_file(d.path(), bad, "x").is_err(), "{bad}");
        }
    }

    #[test]
    fn prueft_git_revisionen() {
        for ok in ["HEAD", "HEAD~1", "v0.4.0", "main", "a1b2c3d", "origin/main", "HEAD^"] {
            assert!(valid_rev(ok), "{ok}");
        }
        for bad in ["--output=x", "-p", "", "HEAD;rm", "a b", "$(x)"] {
            assert!(!valid_rev(bad), "{bad}");
        }
    }

    #[test]
    fn baseline_aus_git() {
        // Läuft im Repository des Viewers; ohne git wird der Test übersprungen.
        if Command::new("git").arg("--version").output().is_err() {
            return;
        }
        let b = git_baseline(&sample(), "HEAD").unwrap();
        assert!(b.name.starts_with("HEAD ("));
        assert!(b.files.iter().any(|f| f.name == "struktur/Struktur.sysml"), "Namen relativ zum Ordner");
        assert!(b.files.iter().all(|f| !f.name.starts_with("beispiel/")));
        assert!(git_baseline(&sample(), "--help").is_err());
    }
}
