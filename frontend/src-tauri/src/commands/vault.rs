use crate::commands::VaultState;
use crate::AuthState;
use serde_json::json;
use tauri::{AppHandle, State};

fn decode_salt_hex(salt_hex: &str) -> Result<[u8; 32], String> {
    let salt_bytes = hex::decode(salt_hex).map_err(|e| format!("Invalid salt: {}", e))?;
    if salt_bytes.len() != 32 {
        return Err("Salt must be 32 bytes".to_string());
    }
    let mut salt = [0u8; 32];
    salt.copy_from_slice(&salt_bytes);
    Ok(salt)
}

#[tauri::command]
pub async fn init_vault_oauth(
    id_token: String,
    state: State<'_, VaultState>,
) -> Result<String, String> {
    let user_id = crate::auth::oauth::extract_user_id(&id_token)
        .map_err(|e| format!("Invalid ID token: {}", e))?;
    let key = crate::auth::oauth::derive_key(&user_id)?;

    state.lock(|storage, workspace| {
        crate::vault::provision::provision(
            storage,
            workspace,
            &key,
            crate::auth::method::AuthMethod::OAuth,
            &user_id,
        )
    })?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
pub async fn init_vault_with_key(
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

    let auth_method = crate::auth::method::AuthMethod::from_vault_tag(&kdf)
        .ok_or_else(|| format!("Unknown KDF: {}", kdf))?;

    state.lock(|storage, workspace| {
        crate::vault::provision::provision(storage, workspace, &key, auth_method, "")
    })?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
pub async fn init_vault(password: String, state: State<'_, VaultState>) -> Result<String, String> {
    let salt = crate::auth::password::generate_salt();
    let key = crate::auth::password::derive_key(&password, &salt);
    let salt_hex = hex::encode(salt);

    state.lock(|storage, workspace| {
        crate::vault::provision::provision(
            storage,
            workspace,
            &key,
            crate::auth::method::AuthMethod::Password,
            &salt_hex,
        )
    })?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
pub async fn unlock_vault_oauth(
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

    let user_id = crate::auth::oauth::extract_user_id(&id_token).map_err(|e| {
        auth.record_failure().ok();
        format!("Invalid ID token: {}", e)
    })?;
    let key = crate::auth::oauth::derive_key(&user_id)?;

    let state_arc = vault_state.0.clone();
    vault_state.lock(|storage, workspace| {
        match crate::vault::access::access(storage, workspace, &key) {
            Ok(_) => {
                auth.reset();
                if let Some(start) = workspace.session_start {
                    crate::spawn_session_timer(app_handle, state_arc, start);
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
    })
}

#[tauri::command]
pub async fn unlock_vault_with_key(
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

    let state_arc = vault_state.0.clone();
    vault_state.lock(|storage, workspace| {
        match crate::vault::access::access(storage, workspace, &key) {
            Ok(_) => {
                auth.reset();
                if let Some(start) = workspace.session_start {
                    crate::spawn_session_timer(app_handle, state_arc, start);
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
    })
}

#[tauri::command]
pub async fn unlock_vault(
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

    let state_arc = vault_state.0.clone();
    vault_state.lock(|storage, workspace| {
        let vault_file = storage.read()?;
        if vault_file.kdf != "password-pbkdf2" {
            return Err("Failed to unlock vault".to_string());
        }

        let salt =
            decode_salt_hex(&vault_file.salt).map_err(|_| "Failed to unlock vault".to_string())?;

        let key = crate::auth::password::derive_key(&password, &salt);

        match crate::vault::access::access(storage, workspace, &key) {
            Ok(_) => {
                auth.reset();
                if let Some(start) = workspace.session_start {
                    crate::spawn_session_timer(app_handle, state_arc, start);
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
    })
}

#[tauri::command]
pub async fn get_vault_auth_method(state: State<'_, VaultState>) -> Result<String, String> {
    state.lock(|storage, _| {
        let method = if storage.exists() {
            storage
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
    })
}

#[tauri::command]
pub async fn vault_status(state: State<'_, VaultState>) -> Result<String, String> {
    state.lock(|storage, workspace| {
        let unlocked = workspace.is_unlocked();
        let has_vault = storage.exists();
        Ok(json!({
            "status": "success",
            "has_vault": has_vault,
            "is_unlocked": unlocked
        })
        .to_string())
    })
}

#[tauri::command]
pub async fn reencrypt_vault(
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

    let auth_method = crate::auth::method::AuthMethod::from_vault_tag(&new_kdf)
        .ok_or_else(|| format!("Unknown KDF: {}", new_kdf))?;

    state.lock(|storage, workspace| {
        crate::vault::rotate::rotate(storage, workspace, &key, auth_method, &new_salt)
    })?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
pub async fn reencrypt_vault_to_oauth(
    id_token: String,
    state: State<'_, VaultState>,
) -> Result<String, String> {
    let user_id = crate::auth::oauth::extract_user_id(&id_token)
        .map_err(|e| format!("Invalid ID token: {}", e))?;
    let key = crate::auth::oauth::derive_key(&user_id)?;

    state.lock(|storage, workspace| {
        crate::vault::rotate::rotate(
            storage,
            workspace,
            &key,
            crate::auth::method::AuthMethod::OAuth,
            &user_id,
        )
    })?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
pub async fn migrate_to_oauth(
    password: String,
    id_token: String,
    state: State<'_, VaultState>,
) -> Result<String, String> {
    let user_id = crate::auth::oauth::extract_user_id(&id_token)
        .map_err(|e| format!("Invalid ID token: {}", e))?;

    state.lock(|storage, workspace| {
        let vault_file = storage.read()?;
        if vault_file.kdf != "password-pbkdf2" {
            return Err("Migration is only supported from password-based vaults".to_string());
        }

        let salt = decode_salt_hex(&vault_file.salt)?;

        let password_key = crate::auth::password::derive_key(&password, &salt);
        crate::vault::access::access(storage, workspace, &password_key)?;

        let oauth_key = crate::auth::oauth::derive_key(&user_id)?;
        crate::vault::rotate::rotate(
            storage,
            workspace,
            &oauth_key,
            crate::auth::method::AuthMethod::OAuth,
            &user_id,
        )
    })?;

    Ok(json!({"status": "success"}).to_string())
}
