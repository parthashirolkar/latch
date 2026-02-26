mod oauth;
mod password;
mod password_generator;
mod vault;
mod vault_health;

use oauth::get_user_id_from_token;
use serde_json::json;
use std::fs;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::menu::{MenuBuilder, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, State};
use tauri_plugin_global_shortcut::ShortcutState;
use vault::Vault;

const MAX_FAILED_ATTEMPTS: u32 = 10;
const BASE_LOCKOUT_DURATION: Duration = Duration::from_secs(5);
const MAX_LOCKOUT_DURATION: Duration = Duration::from_secs(300);

#[derive(Clone)]
struct AuthAttemptState {
    failed_attempts: u32,
    last_failed_time: Option<Instant>,
    lockout_until: Option<Instant>,
}

impl AuthAttemptState {
    fn new() -> Self {
        Self {
            failed_attempts: 0,
            last_failed_time: None,
            lockout_until: None,
        }
    }

    fn is_locked_out(&self) -> bool {
        if let Some(lockout) = self.lockout_until {
            Instant::now() < lockout
        } else {
            false
        }
    }

    fn record_failure(&mut self) -> Result<(), String> {
        self.failed_attempts += 1;
        self.last_failed_time = Some(Instant::now());

        if self.failed_attempts >= MAX_FAILED_ATTEMPTS {
            self.lockout_until = Some(Instant::now() + MAX_LOCKOUT_DURATION);
            return Err(format!(
                "Too many failed attempts. Account locked for {} minutes.",
                MAX_LOCKOUT_DURATION.as_secs() / 60
            ));
        }

        let lockout_duration =
            BASE_LOCKOUT_DURATION.saturating_mul(2_u32.pow(self.failed_attempts.saturating_sub(1)));
        let lockout_duration = std::cmp::min(lockout_duration, MAX_LOCKOUT_DURATION);

        self.lockout_until = Some(Instant::now() + lockout_duration);

        Err(format!(
            "Too many failed attempts. Please try again in {} seconds.",
            lockout_duration.as_secs()
        ))
    }

    fn reset(&mut self) {
        self.failed_attempts = 0;
        self.last_failed_time = None;
        self.lockout_until = None;
    }
}

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
            if let Err(e) = url::Url::parse(url_val) {
                return Err(format!("Invalid URL: {}", e));
            }
        }
    }

    Ok(())
}

#[allow(dead_code)]
const KDF_PASSWORD_PBKDF2: &str = "password-pbkdf2";
#[allow(dead_code)]
const KDF_OAUTH_ARGON2ID: &str = "oauth-argon2id";
#[allow(dead_code)]
const KDF_OAUTH_PBKDF2: &str = "oauth-pbkdf2";
#[allow(dead_code)]
const KDF_BIOMETRIC_KEYCHAIN: &str = "biometric-keychain";

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

            let vault = Vault::new().expect("Failed to initialize vault");
            app.manage(VaultState(Mutex::new(vault)));
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
    let vault = &mut state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    let results = vault.search_entries(&query)?;

    serde_json::to_string(&results).map_err(|e| format!("Failed to serialize results: {}", e))
}

#[tauri::command]
async fn request_secret(
    entry_id: String,
    field: String,
    state: State<'_, VaultState>,
) -> Result<String, String> {
    let vault = &mut state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    let secret = vault.get_entry(&entry_id, &field)?;

    Ok(json!({"status": "success", "value": secret}).to_string())
}

#[tauri::command]
async fn lock_vault(state: State<'_, VaultState>) -> Result<String, String> {
    let vault = &mut state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    vault.lock_vault();

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn vault_status(state: State<'_, VaultState>) -> Result<String, String> {
    let vault = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
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
    validate_entry_fields(&title, &username, &password, url.as_ref())?;

    let vault = &mut state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
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
    let vault = &mut state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    vault.delete_entry(&entry_id)?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn get_full_entry(entry_id: String, state: State<'_, VaultState>) -> Result<String, String> {
    let vault = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
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
    validate_entry_fields(&title, &username, &password, url.as_ref())?;

    let vault = &mut state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;

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

    let vault = &mut state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    vault.init_with_oauth(&user_id)?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn unlock_vault_oauth(
    id_token: String,
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

    let user_id = get_user_id_from_token(&id_token).map_err(|e| {
        auth.record_failure().ok();
        format!("Invalid ID token: {}", e)
    })?;

    let vault = &mut vault_state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;

    match vault.unlock_with_oauth(&user_id) {
        Ok(_) => {
            auth.reset();
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

    let vault = &mut state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    vault.init_with_key(&key, &kdf, "")?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn unlock_vault_with_key(
    key_hex: String,
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

    let vault = &mut vault_state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;

    match vault.unlock_with_key(&key) {
        Ok(_) => {
            auth.reset();
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
    let salt = password::generate_salt();
    let key = password::derive_key_from_password(&password, &salt);
    let salt_hex = hex::encode(salt);

    let vault = &mut state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    vault.init_with_key(&key, KDF_PASSWORD_PBKDF2, &salt_hex)?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn unlock_vault(
    password: String,
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

    let vault = &mut vault_state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;

    let content = fs::read_to_string(&vault.vault_path)
        .map_err(|e| format!("Failed to unlock vault: {}", e))?;
    let vault_data: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Failed to unlock vault: {}", e))?;

    let kdf = vault_data
        .get("kdf")
        .and_then(|v| v.as_str())
        .ok_or("Failed to unlock vault".to_string())?;

    if kdf != KDF_PASSWORD_PBKDF2 {
        return Err("Failed to unlock vault".to_string());
    }

    let salt_hex = vault_data
        .get("salt")
        .and_then(|v| v.as_str())
        .ok_or("Failed to unlock vault".to_string())?;

    let salt_bytes = hex::decode(salt_hex).map_err(|e| format!("Failed to unlock vault: {}", e))?;

    if salt_bytes.len() != 32 {
        return Err("Failed to unlock vault".to_string());
    }
    let mut salt = [0u8; 32];
    salt.copy_from_slice(&salt_bytes);

    let key = password::derive_key_from_password(&password, &salt);

    match vault.unlock_with_key(&key) {
        Ok(_) => {
            auth.reset();
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
        get_user_id_from_token(&id_token).map_err(|e| format!("Invalid ID token: {}", e))?;

    let vault = &mut state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;

    let content = fs::read_to_string(&vault.vault_path)
        .map_err(|e| format!("Failed to read vault: {}", e))?;
    let vault_data: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse vault: {}", e))?;

    let kdf = vault_data
        .get("kdf")
        .and_then(|v| v.as_str())
        .ok_or("Invalid vault: missing kdf")?;

    if kdf != "password-pbkdf2" {
        return Err("Migration is only supported from password-based vaults".to_string());
    }

    let salt_hex = vault_data
        .get("salt")
        .and_then(|v| v.as_str())
        .ok_or("Invalid vault: missing salt")?;

    let salt_bytes = hex::decode(salt_hex).map_err(|e| format!("Invalid salt encoding: {}", e))?;

    if salt_bytes.len() != 32 {
        return Err("Invalid salt length".to_string());
    }
    let mut salt = [0u8; 32];
    salt.copy_from_slice(&salt_bytes);

    let password_key = password::derive_key_from_password(&password, &salt);

    let encrypted_data: vault::EncryptedData =
        serde_json::from_str(&vault_data["data"].to_string())
            .map_err(|e| format!("Failed to parse encrypted data: {}", e))?;

    let decrypted = vault::Vault::decrypt_data(&password_key, &encrypted_data)?;

    let oauth_key = oauth::derive_key_from_oauth(&user_id)?;

    let new_encrypted_data = vault::Vault::encrypt_data(&oauth_key, &decrypted)?;

    let new_vault_data = serde_json::json!({
        "version": vault_data["version"],
        "kdf": KDF_OAUTH_ARGON2ID,
        "salt": user_id,
        "data": new_encrypted_data
    });

    let json_vault = serde_json::to_string_pretty(&new_vault_data)
        .map_err(|e| format!("Failed to serialize vault: {}", e))?;

    let vault_path = vault.vault_path.clone();

    let tmp_path = vault_path.with_extension("enc.tmp");
    fs::write(&tmp_path, json_vault).map_err(|e| format!("Failed to write vault: {}", e))?;
    fs::rename(&tmp_path, &vault_path).map_err(|e| format!("Failed to rename vault: {}", e))?;

    let vault = &mut state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    vault.unlock_with_key(&oauth_key)?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn get_vault_auth_method(state: State<'_, VaultState>) -> Result<String, String> {
    let vault = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
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

    let vault = &mut state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
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

    let vault = &mut state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
    vault.reencrypt_vault(&key, KDF_OAUTH_ARGON2ID, &user_id)?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
async fn get_auth_preferences(state: State<'_, VaultState>) -> Result<String, String> {
    let vault = state
        .0
        .lock()
        .map_err(|_| "Vault is temporarily unavailable")?;
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
