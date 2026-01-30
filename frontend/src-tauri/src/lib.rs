mod vault;

use serde_json::json;
use std::sync::Mutex;
use std::thread;
use tauri::menu::{MenuBuilder, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, State};
use tauri_plugin_global_shortcut::ShortcutState;
use vault::{EncryptedVault, Vault};

struct VaultState(Mutex<Vault>);

fn setup_system_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "Show Latch", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = MenuBuilder::new(app)
        .item(&show_item)
        .separator()
        .item(&quit_item)
        .build()?;

    // Load password.ico for system tray icon using the default window icon
    // The password.ico will be used because it's specified in tauri.conf.json
    let _tray = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .tooltip("Latch Password Manager")
        .icon(app.default_window_icon().unwrap().clone())
        .on_menu_event(move |app, event| match event.id.0.as_str() {
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
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
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
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_shortcut("Ctrl+Space")?
                    .with_handler(move |_app, _shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            if let Some(window) = handle.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
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
            delete_entry,
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
    let encrypted_vault: EncryptedVault = {
        let vault = state.0.lock().unwrap();
        let content = std::fs::read_to_string(vault.vault_path())
            .map_err(|e| format!("Failed to read vault: {}", e))?;
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse vault: {}", e))?
    };

    let salt =
        hex::decode(&encrypted_vault.salt).map_err(|e| format!("Invalid salt encoding: {}", e))?;

    let key_result = thread::spawn(move || Vault::derive_key(&password, &salt))
        .join()
        .map_err(|e| format!("Key derivation thread panicked: {:?}", e))?;

    let key = key_result?;

    let encrypted_data = encrypted_vault.data;
    let decrypted_result = thread::spawn(move || Vault::decrypt_data(&key, &encrypted_data))
        .join()
        .map_err(|e| format!("Decryption thread panicked: {:?}", e))?;

    let decrypted = decrypted_result?;

    let vault_data: serde_json::Value = serde_json::from_str(&decrypted)
        .map_err(|e| format!("Failed to parse vault data: {}", e))?;

    let entries: Vec<vault::Entry> =
        serde_json::from_value(vault_data.get("entries").ok_or("Missing entries")?.clone())
            .map_err(|e| format!("Failed to parse entries: {}", e))?;

    let vault = &mut state.0.lock().unwrap();
    vault.set_session_key(key);
    vault.set_entries(entries);

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
    icon_url: Option<String>,
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
        icon_url,
    };

    vault.add_entry(entry)?;
    Ok(json!({"status": "success", "id": id}).to_string())
}

#[tauri::command]
async fn delete_entry(entry_id: String, state: State<'_, VaultState>) -> Result<String, String> {
    let vault = &mut state.0.lock().unwrap();
    vault.delete_entry(&entry_id)?;

    Ok(json!({"status": "success"}).to_string())
}
