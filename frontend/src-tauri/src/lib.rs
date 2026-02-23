mod oauth;
mod password_generator;
mod vault;
mod vault_health;

use oauth::get_user_id_from_token;
use serde_json::json;
use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, State};
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
    // Load .env file in development
    if cfg!(debug_assertions) {
        dotenvy::dotenv().ok();
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_google_auth::init())
        .plugin(tauri_plugin_biometry::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
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
            init_vault_oauth,
            init_vault_with_key,
            unlock_vault_oauth,
            unlock_vault_with_key,
            get_vault_auth_method,
            reencrypt_vault,
            reencrypt_vault_to_oauth,
            vault_status,
            lock_vault,
            search_entries,
            request_secret,
            add_entry,
            get_full_entry,
            update_entry,
            delete_entry,
            get_auth_preferences,
            generate_password,
            analyze_password_strength,
            check_vault_health,
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

#[tauri::command]
async fn get_full_entry(entry_id: String, state: State<'_, VaultState>) -> Result<String, String> {
    let vault = state.0.lock().unwrap();
    let entry = vault.get_full_entry(&entry_id)?;

    serde_json::to_string(&entry).map_err(|e| format!("Failed to serialize entry: {}", e))
}

#[tauri::command]
async fn update_entry(
    id: String,
    title: String,
    username: String,
    password: String,
    url: Option<String>,
    icon_url: Option<String>,
    state: State<'_, VaultState>,
) -> Result<String, String> {
    let vault = &mut state.0.lock().unwrap();

    let entry = vault::Entry {
        id,
        title,
        username,
        password,
        url,
        icon_url,
    };

    vault.update_entry(entry)?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn init_vault_oauth(
    id_token: String,
    state: State<'_, VaultState>,
) -> Result<String, String> {
    let user_id =
        get_user_id_from_token(&id_token).map_err(|e| format!("Invalid ID token: {}", e))?;

    let vault = &mut state.0.lock().unwrap();
    vault.init_with_oauth(&user_id)?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn unlock_vault_oauth(
    id_token: String,
    state: State<'_, VaultState>,
) -> Result<String, String> {
    let user_id =
        get_user_id_from_token(&id_token).map_err(|e| format!("Invalid ID token: {}", e))?;

    let vault = &mut state.0.lock().unwrap();
    vault.unlock_with_oauth(&user_id)?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn init_vault_with_key(
    key_hex: String,
    kdf: String,
    state: State<'_, VaultState>,
) -> Result<String, String> {
    let key_bytes = hex::decode(&key_hex).map_err(|e| format!("Invalid key hex: {}", e))?;
    if key_bytes.len() != 32 {
        return Err("Key must be 32 bytes".to_string());
    }
    let mut key = [0u8; 32];
    key.copy_from_slice(&key_bytes);

    let vault = &mut state.0.lock().unwrap();
    vault.init_with_key(&key, &kdf)?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn unlock_vault_with_key(
    key_hex: String,
    state: State<'_, VaultState>,
) -> Result<String, String> {
    let key_bytes = hex::decode(&key_hex).map_err(|e| format!("Invalid key hex: {}", e))?;
    if key_bytes.len() != 32 {
        return Err("Key must be 32 bytes".to_string());
    }
    let mut key = [0u8; 32];
    key.copy_from_slice(&key_bytes);

    let vault = &mut state.0.lock().unwrap();
    vault.unlock_with_key(&key)?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn get_vault_auth_method(state: State<'_, VaultState>) -> Result<String, String> {
    let vault = state.0.lock().unwrap();
    let method = vault
        .get_auth_method()
        .unwrap_or_else(|_| "none".to_string());

    Ok(json!({
        "status": "success",
        "auth_method": method
    })
    .to_string())
}

#[tauri::command]
async fn reencrypt_vault(
    new_key_hex: String,
    new_kdf: String,
    new_salt: String,
    state: State<'_, VaultState>,
) -> Result<String, String> {
    let key_bytes = hex::decode(&new_key_hex).map_err(|e| format!("Invalid key hex: {}", e))?;
    if key_bytes.len() != 32 {
        return Err("Key must be 32 bytes".to_string());
    }
    let mut key = [0u8; 32];
    key.copy_from_slice(&key_bytes);

    let vault = &mut state.0.lock().unwrap();
    vault.reencrypt_vault(&key, &new_kdf, &new_salt)?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn reencrypt_vault_to_oauth(
    id_token: String,
    state: State<'_, VaultState>,
) -> Result<String, String> {
    let user_id =
        get_user_id_from_token(&id_token).map_err(|e| format!("Invalid ID token: {}", e))?;
    let key = oauth::derive_key_from_oauth(&user_id)?;

    let vault = &mut state.0.lock().unwrap();
    vault.reencrypt_vault(&key, "oauth-argon2id", &user_id)?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn get_auth_preferences(state: State<'_, VaultState>) -> Result<String, String> {
    let vault = state.0.lock().unwrap();
    let auth_method = vault
        .get_auth_method()
        .unwrap_or_else(|_| "none".to_string());
    let is_unlocked = vault.is_unlocked();

    let session_remaining = if is_unlocked {
        vault
            .session_start
            .and_then(|start| start.elapsed().ok())
            .map(|e| 30 * 60 - e.as_secs())
            .unwrap_or(0)
    } else {
        0
    };

    Ok(json!( {
        "status": "success",
        "auth_method": auth_method,
        "session_valid": is_unlocked,
        "session_remaining_seconds": session_remaining
    })
    .to_string())
}

#[tauri::command]
async fn generate_password(options: password_generator::PasswordOptions) -> Result<String, String> {
    let password = password_generator::generate_password(&options)?;

    Ok(json!({
        "status": "success",
        "password": password
    })
    .to_string())
}

#[tauri::command]
async fn analyze_password_strength(password: String) -> Result<String, String> {
    let report = password_generator::analyze_password_strength(&password);

    Ok(json!({
        "status": "success",
        "report": report
    })
    .to_string())
}

#[tauri::command]
async fn check_vault_health(state: State<'_, VaultState>) -> Result<String, String> {
    let entries = {
        let vault = &state.0.lock().unwrap();
        vault.get_entries().clone()
    };

    let report = vault_health::check_vault_health(&entries).await;

    Ok(json!({
        "status": "success",
        "report": report
    })
    .to_string())
}
