use crate::commands::VaultState;
use serde_json::json;
use tauri::State;

#[tauri::command]
pub async fn lock_vault(state: State<'_, VaultState>) -> Result<String, String> {
    state.lock(|_, workspace| {
        workspace.lock();
        Ok(())
    })?;

    Ok(json!({"status": "success"}).to_string())
}

#[tauri::command]
pub async fn get_auth_preferences(state: State<'_, VaultState>) -> Result<String, String> {
    state.lock(|storage, workspace| {
        let auth_method = if storage.exists() {
            storage
                .read()
                .map(|v| v.kdf)
                .unwrap_or_else(|_| "none".to_string())
        } else {
            "none".to_string()
        };
        let is_unlocked = workspace.is_unlocked();

        let session_remaining = if is_unlocked {
            workspace
                .session_start
                .and_then(|start| start.elapsed().ok())
                .map(|e| 30 * 60 - e.as_secs())
                .unwrap_or(0)
        } else {
            0
        };

        Ok(json!({
            "status": "success",
            "auth_method": auth_method,
            "session_valid": is_unlocked,
            "session_remaining_seconds": session_remaining
        })
        .to_string())
    })
}
