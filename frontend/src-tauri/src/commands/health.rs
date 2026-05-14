use crate::commands::VaultState;
use crate::vault_health::breach_checker::PwnedPasswordsApi;
use serde_json::json;
use tauri::State;

#[tauri::command]
pub async fn check_vault_health(state: State<'_, VaultState>) -> Result<String, String> {
    let entries = state.lock(|_, workspace| Ok(workspace.credentials.clone()))?;

    let checker = PwnedPasswordsApi;
    let report = crate::vault_health::audit::check_vault_health(&entries, &checker).await;

    Ok(json!({
        "status": "success",
        "report": report
    })
    .to_string())
}
