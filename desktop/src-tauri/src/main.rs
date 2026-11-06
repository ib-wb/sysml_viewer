// Unter Windows ohne zusätzliches Konsolenfenster starten
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    sysml_viewer_lib::run()
}
