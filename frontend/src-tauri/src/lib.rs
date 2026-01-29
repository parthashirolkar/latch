mod vault;

use serde_json::json;
use std::sync::Mutex;
use tauri::{Manager, State};
use tauri::tray::TrayIconBuilder;
use tauri::menu::{MenuBuilder, MenuItem};
use tauri_plugin_global_shortcut::ShortcutState;
use vault::Vault;

struct VaultState(Mutex<Vault>);

fn setup_system_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "Show Latch", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = MenuBuilder::new(app)
        .item(&show_item)
        .separator()
        .item(&quit_item)
        .build()?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .tooltip("Latch Password Manager")
        .icon(app.default_window_icon().unwrap().clone())
        .on_menu_event(move |app, event| {
            match event.id.0.as_str() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let vault = Vault::new().expect("Failed to initialize vault");
            app.manage(VaultState(Mutex::new(vault)));

            let handle = app.handle().clone();
            app.handle()
                .plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_shortcut("Alt+Space")?
                        .with_handler(move |_app, _shortcut, event| {
                            if event.state == ShortcutState::Pressed {
                                if let Some(window) = handle.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        })
                        .build(),
                )?;

            // Setup system tray
            if let Err(e) = setup_system_tray(app) {
                eprintln!("Failed to setup system tray: {}", e);
            }

            // Intercept window close event to hide instead
            let window = app.get_webview_window("main").unwrap();
            let window_clone = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    window_clone.hide().unwrap();
                    api.prevent_close();
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            search_entries,
            request_secret,
            init_vault,
            unlock_vault,
            lock_vault,
            vault_status,
            add_entry,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn search_entries(query: String, state: State<'_, VaultState>) -> Result<String, String> {
    let vault = &mut state.0.lock().unwrap();
    let results = vault.search_entries(&query)?;

    serde_json::to_string(&results).map_err(|e| format!("Failed to serialize results: {}", e))
}

#[tauri::command]
async fn request_secret(
    entry_id: String,
    field: String,
    state: State<'_, VaultState>,
) -> Result<String, String> {
    let vault = &mut state.0.lock().unwrap();
    let secret = vault.get_entry(&entry_id, &field)?;

    Ok(json!({"status": "success", "value": secret}).to_string())
}

#[tauri::command]
async fn init_vault(password: String, state: State<'_, VaultState>) -> Result<String, String> {
    let vault = &mut state.0.lock().unwrap();
    vault.init_vault(&password)?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn unlock_vault(password: String, state: State<'_, VaultState>) -> Result<String, String> {
    let vault = &mut state.0.lock().unwrap();
    vault.unlock_vault(&password)?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn lock_vault(state: State<'_, VaultState>) -> Result<String, String> {
    let vault = &mut state.0.lock().unwrap();
    vault.lock_vault();

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn vault_status(state: State<'_, VaultState>) -> Result<String, String> {
    let vault = state.0.lock().unwrap();
    let unlocked = vault.is_unlocked();
    let has_vault = vault.vault_exists();

    Ok(json!({"has_vault": has_vault, "is_unlocked": unlocked}).to_string())
}

#[tauri::command]
async fn add_entry(
    title: String,
    username: String,
    password: String,
    url: Option<String>,
    notes: Option<String>,
    state: State<'_, VaultState>,
) -> Result<String, String> {
    let vault = &mut state.0.lock().unwrap();
    let id = uuid::Uuid::new_v4().to_string();

    let entry = vault::Entry {
        id: id.clone(),
        title,
        username,
        password,
        url,
        notes,
    };

    vault.add_entry(entry)?;
    Ok(json!({"status": "success", "id": id}).to_string())
}
