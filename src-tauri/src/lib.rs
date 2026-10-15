mod data_dir;

use std::fs;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg(desktop)]
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[tauri::command]
fn create_float_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("float") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, "float", WebviewUrl::App("index.html".into()))
        .title("快速笔记")
        .inner_size(420.0, 560.0)
        .resizable(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn close_float_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("float") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_data_dir() -> String {
    data_dir::resolve().to_string_lossy().replace('\\', "/")
}

#[tauri::command]
fn get_mcp_config() -> Result<String, String> {
    let command = resolve_mcp_command()?;
    let escaped = command.replace('\\', "\\\\");
    Ok(format!(
        "{{\n  \"mcpServers\": {{\n    \"hygnote\": {{\n      \"command\": \"{escaped}\"\n    }}\n  }}\n}}"
    ))
}

fn resolve_mcp_command() -> Result<String, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let mut dir = exe.parent().ok_or("missing exe directory")?.to_path_buf();
    for _ in 0..6 {
        let candidate = dir.join("mcp").join("hygnote-mcp.cmd");
        if candidate.is_file() {
            return Ok(candidate.to_string_lossy().replace('/', "\\"));
        }
        if !dir.pop() {
            break;
        }
    }
    Err("未找到 MCP 入口 hygnote-mcp.cmd".into())
}

fn image_dir() -> Result<std::path::PathBuf, String> {
    Ok(data_dir::ensure().join("images"))
}

fn image_filename(value: &str) -> Option<String> {
    std::path::Path::new(value)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.contains(".."))
        .map(|name| name.to_string())
}

#[tauri::command]
fn save_note_image(filename: String, data: Vec<u8>) -> Result<String, String> {
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err("invalid filename".into());
    }
    let dir = image_dir()?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(&filename);
    if !path.exists() {
        fs::write(&path, data).map_err(|e| e.to_string())?;
    }
    Ok(format!("images/{filename}"))
}

#[tauri::command]
fn purge_unused_images(used: Vec<String>) -> Result<u32, String> {
    let dir = image_dir()?;
    if !dir.exists() {
        return Ok(0);
    }
    let keep: std::collections::HashSet<String> = used
        .iter()
        .filter_map(|item| image_filename(item))
        .collect();
    let mut removed = 0;
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if keep.contains(&name) {
            continue;
        }
        if fs::remove_file(entry.path()).is_ok() {
            removed += 1;
        }
    }
    Ok(removed)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let data_root = data_dir::ensure();
    let db_url = data_dir::sqlite_url();
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_notes_table",
            sql: "CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            pinned INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_created_at ON notes(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_pinned ON notes(pinned DESC, created_at DESC);",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_note_tags",
            sql: "ALTER TABLE notes ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_note_locked",
            sql: "ALTER TABLE notes ADD COLUMN locked INTEGER NOT NULL DEFAULT 0;",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(&db_url, migrations)
                .build(),
        )
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    use tauri_plugin_global_shortcut::ShortcutState;
                    if event.state() == ShortcutState::Pressed {
                        let _ = create_float_window(app.clone());
                    }
                })
                .build(),
        )
        .setup(move |app| {
            let _ = app.asset_protocol_scope().allow_directory(&data_root, true);
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};

                let shortcut =
                    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyN);
                let gs = app.global_shortcut();
                if gs.is_registered(shortcut) {
                    let _ = gs.unregister(shortcut);
                }
                if let Err(error) = gs.register(shortcut) {
                    use std::io::Write;

                    let warning = format!(
                        "Ctrl+Shift+N registration failed; global shortcut unavailable: {error}"
                    );
                    eprintln!("{warning}");
                    if let Ok(mut log) = fs::OpenOptions::new()
                        .create(true)
                        .append(true)
                        .open(data_root.join("logs").join("startup.log"))
                    {
                        let _ = writeln!(log, "{warning}");
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_float_window,
            close_float_window,
            get_data_dir,
            get_mcp_config,
            save_note_image,
            purge_unused_images
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
