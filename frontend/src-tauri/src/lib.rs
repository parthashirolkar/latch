mod auth;
mod crypto;
mod password_generator;
mod vault;
mod vault_health;

use auth::lockout::AuthAttemptState;
use serde_json::json;
use std::sync::{Arc, Mutex};
use std::time::SystemTime;
use tauri::menu::{MenuBuilder, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::ShortcutState;
use vault::storage::VaultStorage;
use vault::workspace::Workspace;
use vault::{Entry, SESSION_TIMEOUT_SECS};

struct AuthState(Mutex<AuthAttemptState>);

impl AuthState {
    fn new() -> Self {
        Self(Mutex::new(AuthAttemptState::new()))
    }
}

fn validate_entry_fields(
    title: &str,
    username: &str,
    password: &str,
    url: Option<&String>,
) -> Result<(), String> {
    if title.trim().is_empty() {
        return Err("Title cannot be empty".to_string());
    }
    if title.len() > 256 {
        return Err("Title is too long (max 256 characters)".to_string());
    }

    if username.trim().is_empty() {
        return Err("Username cannot be empty".to_string());
    }
    if username.len() > 256 {
        return Err("Username is too long (max 256 characters)".to_string());
    }

    if password.trim().is_empty() {
        return Err("Password cannot be empty".to_string());
    }
    if password.len() > 1024 {
        return Err("Password is too long (max 1024 characters)".to_string());
    }

    if let Some(url_val) = url {
        if !url_val.trim().is_empty() {
            match url::Url::parse(url_val) {
                Ok(parsed) => {
                    let scheme = parsed.scheme();
                    if scheme != "http" && scheme != "https" {
                        return Err("URL must use http or https scheme".to_string());
                    }
                }
                Err(e) => return Err(format!("Invalid URL: {}", e)),
            }
        }
    }

    Ok(())
}

struct VaultState(Arc<Mutex<(VaultStorage, Workspace)>>);

fn spawn_session_timer(
    app_handle: AppHandle,
    state_arc: Arc<Mutex<(VaultStorage, Workspace)>>,
    session_start: SystemTime,
) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(SESSION_TIMEOUT_SECS)).await;
        if let Ok(mut guard) = state_arc.lock() {
            if guard.1.session_start == Some(session_start) {
                guard.1.lock();
                let _ = app_handle.emit("vault-locked", ());
            }
        }
    });
}

fn setup_system_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "Show Latch", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = MenuBuilder::new(app)
        .item(&show_item)
        .separator()
        .item(&quit_item)
        .build()?;

    let tray_icon = app
        .default_window_icon()
        .ok_or("Failed to get window icon")?
        .clone();

    let _tray = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .tooltip("Latch Password Manager")
        .icon(tray_icon)
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

            let storage = VaultStorage::new().expect("Failed to initialize vault storage");
            let workspace = Workspace::new();
            app.manage(VaultState(Arc::new(Mutex::new((storage, workspace)))));
            app.manage(AuthState::new());

            let handle = app.handle().clone();
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_shortcut("Ctrl+Space")?
                    .with_handler(move |_app, _shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            if let Some(window) = handle.get_webview_window("main") {
                                let is_visible = window.is_visible().unwrap_or(false);
                                if is_visible {
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
            let window = app
                .get_webview_window("main")
                .ok_or("Failed to get main window")?;
            let window_clone = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    let _ = window_clone.hide();
                    api.prevent_close();
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            init_vault_oauth,
            init_vault_with_key,
            init_vault,
            unlock_vault_oauth,
            unlock_vault_with_key,
            unlock_vault,
            get_vault_auth_method,
            reencrypt_vault,
            reencrypt_vault_to_oauth,
            migrate_to_oauth,
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
    let mut guard = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    let results = vault::search::search(&mut guard.1, &query)?;

    serde_json::to_string(&results).map_err(|e| format!("Failed to serialize results: {}", e))
}

#[tauri::command]
async fn request_secret(
    entry_id: String,
    field: String,
    state: State<'_, VaultState>,
) -> Result<String, String> {
    let mut guard = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    let secret = vault::entries::get_field(&mut guard.1, &entry_id, &field)?;

    Ok(json!({"status": "success", "value": secret}).to_string())
}

#[tauri::command]
async fn lock_vault(state: State<'_, VaultState>) -> Result<String, String> {
    let mut guard = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    guard.1.lock();

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn vault_status(state: State<'_, VaultState>) -> Result<String, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    let unlocked = guard.1.is_unlocked();
    let has_vault = guard.0.exists();

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
    validate_entry_fields(&title, &username, &password, url.as_ref())?;

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    let id = uuid::Uuid::new_v4().to_string();

    let entry = Entry {
        id: id.clone(),
        title,
        username,
        password,
        url,
        icon_url,
    };

    vault::entries::add(&mut guard.1, entry)?;
    Ok(json!({"status": "success", "id": id}).to_string())
}

#[tauri::command]
async fn delete_entry(entry_id: String, state: State<'_, VaultState>) -> Result<String, String> {
    let mut guard = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    let (storage, workspace) = &mut *guard;
    vault::entries::delete(workspace, storage, &entry_id)?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn get_full_entry(entry_id: String, state: State<'_, VaultState>) -> Result<String, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    let entry = vault::entries::get_full(&guard.1, &entry_id)?;

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
    validate_entry_fields(&title, &username, &password, url.as_ref())?;

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;

    let entry = Entry {
        id,
        title,
        username,
        password,
        url,
        icon_url,
    };

    vault::entries::update(&mut guard.1, entry)?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn init_vault_oauth(
    id_token: String,
    state: State<'_, VaultState>,
) -> Result<String, String> {
    let user_id =
        auth::oauth::extract_user_id(&id_token).map_err(|e| format!("Invalid ID token: {}", e))?;
    let key = auth::oauth::derive_key(&user_id)?;

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    let (storage, workspace) = &mut *guard;
    vault::provision::provision(
        storage,
        workspace,
        &key,
        auth::method::AuthMethod::OAuth,
        &user_id,
    )?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn unlock_vault_oauth(
    id_token: String,
    app_handle: AppHandle,
    vault_state: State<'_, VaultState>,
    auth_state: State<'_, AuthState>,
) -> Result<String, String> {
    let mut auth = auth_state
        .0
        .lock()
        .map_err(|_| "Auth state temporarily unavailable")?;

    if auth.is_locked_out() {
        return Err("Too many failed attempts. Please try again later.".to_string());
    }

    let user_id = auth::oauth::extract_user_id(&id_token).map_err(|e| {
        auth.record_failure().ok();
        format!("Invalid ID token: {}", e)
    })?;
    let key = auth::oauth::derive_key(&user_id)?;

    let mut guard = vault_state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    let (storage, workspace) = &mut *guard;

    match vault::access::access(storage, workspace, &key) {
        Ok(_) => {
            auth.reset();
            if let Some(start) = workspace.session_start {
                spawn_session_timer(app_handle, Arc::clone(&vault_state.0), start);
            }
            Ok(json!({"status": "success"}).to_string())
        }
        Err(e) => {
            let auth_error = auth.record_failure();
            let error_msg = if let Err(msg) = auth_error {
                format!("\n{}", msg)
            } else {
                String::new()
            };
            Err(format!("{}{}", e, error_msg))
        }
    }
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

    let auth_method = auth::method::AuthMethod::from_vault_tag(&kdf)
        .ok_or_else(|| format!("Unknown KDF: {}", kdf))?;

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    let (storage, workspace) = &mut *guard;
    vault::provision::provision(storage, workspace, &key, auth_method, "")?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn unlock_vault_with_key(
    key_hex: String,
    app_handle: AppHandle,
    vault_state: State<'_, VaultState>,
    auth_state: State<'_, AuthState>,
) -> Result<String, String> {
    let mut auth = auth_state
        .0
        .lock()
        .map_err(|_| "Auth state temporarily unavailable")?;

    if auth.is_locked_out() {
        return Err("Too many failed attempts. Please try again later.".to_string());
    }

    let key_bytes = hex::decode(&key_hex).map_err(|e| {
        auth.record_failure().ok();
        format!("Invalid key hex: {}", e)
    })?;
    if key_bytes.len() != 32 {
        auth.record_failure().ok();
        return Err("Key must be 32 bytes".to_string());
    }
    let mut key = [0u8; 32];
    key.copy_from_slice(&key_bytes);

    let mut guard = vault_state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    let (storage, workspace) = &mut *guard;

    match vault::access::access(storage, workspace, &key) {
        Ok(_) => {
            auth.reset();
            if let Some(start) = workspace.session_start {
                spawn_session_timer(app_handle, Arc::clone(&vault_state.0), start);
            }
            Ok(json!({"status": "success"}).to_string())
        }
        Err(e) => {
            let auth_error = auth.record_failure();
            let error_msg = if let Err(msg) = auth_error {
                format!("\n{}", msg)
            } else {
                String::new()
            };
            Err(format!("{}{}", e, error_msg))
        }
    }
}

#[tauri::command]
async fn init_vault(password: String, state: State<'_, VaultState>) -> Result<String, String> {
    let salt = auth::password::generate_salt();
    let key = auth::password::derive_key(&password, &salt);
    let salt_hex = hex::encode(salt);

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    let (storage, workspace) = &mut *guard;
    vault::provision::provision(
        storage,
        workspace,
        &key,
        auth::method::AuthMethod::Password,
        &salt_hex,
    )?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn unlock_vault(
    password: String,
    app_handle: AppHandle,
    vault_state: State<'_, VaultState>,
    auth_state: State<'_, AuthState>,
) -> Result<String, String> {
    let mut auth = auth_state
        .0
        .lock()
        .map_err(|_| "Auth state temporarily unavailable")?;

    if auth.is_locked_out() {
        return Err("Too many failed attempts. Please try again later.".to_string());
    }

    let mut guard = vault_state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    let (storage, workspace) = &mut *guard;

    let vault_file = storage.read()?;
    if vault_file.kdf != "password-pbkdf2" {
        return Err("Failed to unlock vault".to_string());
    }

    let salt_hex = vault_file.salt;
    let salt_bytes = hex::decode(salt_hex).map_err(|e| format!("Failed to unlock vault: {}", e))?;
    if salt_bytes.len() != 32 {
        return Err("Failed to unlock vault".to_string());
    }
    let mut salt = [0u8; 32];
    salt.copy_from_slice(&salt_bytes);

    let key = auth::password::derive_key(&password, &salt);

    match vault::access::access(storage, workspace, &key) {
        Ok(_) => {
            auth.reset();
            if let Some(start) = workspace.session_start {
                spawn_session_timer(app_handle, Arc::clone(&vault_state.0), start);
            }
            Ok(json!({"status": "success"}).to_string())
        }
        Err(e) => {
            let auth_error = auth.record_failure();
            let error_msg = if let Err(msg) = auth_error {
                format!("\n{}", msg)
            } else {
                String::new()
            };
            Err(format!("{}{}", e, error_msg))
        }
    }
}

#[tauri::command]
async fn migrate_to_oauth(
    password: String,
    id_token: String,
    state: State<'_, VaultState>,
) -> Result<String, String> {
    let user_id =
        auth::oauth::extract_user_id(&id_token).map_err(|e| format!("Invalid ID token: {}", e))?;

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    let (storage, workspace) = &mut *guard;

    let vault_file = storage.read()?;
    if vault_file.kdf != "password-pbkdf2" {
        return Err("Migration is only supported from password-based vaults".to_string());
    }

    let salt_hex = vault_file.salt;
    let salt_bytes = hex::decode(salt_hex).map_err(|e| format!("Invalid salt encoding: {}", e))?;
    if salt_bytes.len() != 32 {
        return Err("Invalid salt length".to_string());
    }
    let mut salt = [0u8; 32];
    salt.copy_from_slice(&salt_bytes);

    let password_key = auth::password::derive_key(&password, &salt);
    vault::access::access(storage, workspace, &password_key)?;

    let oauth_key = auth::oauth::derive_key(&user_id)?;
    vault::rotate::rotate(
        storage,
        workspace,
        &oauth_key,
        auth::method::AuthMethod::OAuth,
        &user_id,
    )?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn get_vault_auth_method(state: State<'_, VaultState>) -> Result<String, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    let method = if guard.0.exists() {
        guard
            .0
            .read()
            .map(|v| v.kdf)
            .unwrap_or_else(|_| "none".to_string())
    } else {
        "none".to_string()
    };

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

    let auth_method = auth::method::AuthMethod::from_vault_tag(&new_kdf)
        .ok_or_else(|| format!("Unknown KDF: {}", new_kdf))?;

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    let (storage, workspace) = &mut *guard;
    vault::rotate::rotate(storage, workspace, &key, auth_method, &new_salt)?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn reencrypt_vault_to_oauth(
    id_token: String,
    state: State<'_, VaultState>,
) -> Result<String, String> {
    let user_id =
        auth::oauth::extract_user_id(&id_token).map_err(|e| format!("Invalid ID token: {}", e))?;
    let key = auth::oauth::derive_key(&user_id)?;

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    let (storage, workspace) = &mut *guard;
    vault::rotate::rotate(
        storage,
        workspace,
        &key,
        auth::method::AuthMethod::OAuth,
        &user_id,
    )?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn get_auth_preferences(state: State<'_, VaultState>) -> Result<String, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    let auth_method = if guard.0.exists() {
        guard
            .0
            .read()
            .map(|v| v.kdf)
            .unwrap_or_else(|_| "none".to_string())
    } else {
        "none".to_string()
    };
    let is_unlocked = guard.1.is_unlocked();

    let session_remaining = if is_unlocked {
        guard
            .1
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
        let guard = state.0.lock().unwrap();
        guard.1.credentials.clone()
    };

    let checker = vault_health::breach_checker::PwnedPasswordsApi;
    let report = vault_health::audit::check_vault_health(&entries, &checker).await;

    Ok(json!({
        "status": "success",
        "report": report
    })
    .to_string())
}
