use std::fs;
use std::path::PathBuf;

const IDENTIFIER: &str = "com.note.app";

pub fn resolve() -> PathBuf {
    if let Ok(dir) = std::env::var("NOTE_DATA_DIR") {
        let path = PathBuf::from(dir.trim());
        if !path.as_os_str().is_empty() {
            return path;
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let marker = parent.join("data-dir.txt");
            if let Ok(text) = fs::read_to_string(marker) {
                let path = PathBuf::from(text.trim());
                if !path.as_os_str().is_empty() {
                    return path;
                }
            }
            let portable = parent.join("data");
            if portable.is_dir() {
                return portable;
            }
        }
    }

    default_app_data_dir()
}

pub fn sqlite_url() -> String {
    let db = resolve().join("notes.db");
    format!("sqlite:{}", db.to_string_lossy().replace('\\', "/"))
}

pub fn ensure() -> PathBuf {
    let dir = resolve();
    let _ = fs::create_dir_all(dir.join("images"));
    let _ = fs::create_dir_all(dir.join("logs"));
    dir
}

fn default_app_data_dir() -> PathBuf {
    if let Ok(appdata) = std::env::var("APPDATA") {
        return PathBuf::from(appdata).join(IDENTIFIER);
    }
    PathBuf::from("NoteData")
}
