use serde_json::json;

#[tauri::command]
pub async fn generate_password(
    options: crate::password_generator::PasswordOptions,
) -> Result<String, String> {
    let password = crate::password_generator::generate_password(&options)?;

    Ok(json!({
        "status": "success",
        "password": password
    })
    .to_string())
}

#[tauri::command]
pub async fn analyze_password_strength(password: String) -> Result<String, String> {
    let report = crate::password_generator::analyze_password_strength(&password);

    Ok(json!({
        "status": "success",
        "report": report
    })
    .to_string())
}
