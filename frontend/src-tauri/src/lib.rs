use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![
      search_entries,
      request_secret,
      init_vault,
      unlock_vault,
      lock_vault,
      vault_status,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[tauri::command]
async fn search_entries(query: String, app: tauri::AppHandle) -> Result<String, String> {
  let output = app.shell().sidecar("vault-core")
    .map_err(|e| format!("Failed to resolve vault-core binary: {}", e))?
    .args(["search", &query])
    .output()
    .await
    .map_err(|e| format!("Failed to spawn vault-core: {}", e))?;

  if output.status.success() {
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
  } else {
    Err(format!("vault-core failed: {}", String::from_utf8_lossy(&output.stderr)))
  }
}

#[tauri::command]
async fn request_secret(entry_id: String, field: String, app: tauri::AppHandle) -> Result<String, String> {
  let output = app.shell().sidecar("vault-core")
    .map_err(|e| format!("Failed to resolve vault-core binary: {}", e))?
    .args(["request-secret", &entry_id, &field])
    .output()
    .await
    .map_err(|e| format!("Failed to spawn vault-core: {}", e))?;

  if output.status.success() {
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
  } else {
    Err(format!("vault-core failed: {}", String::from_utf8_lossy(&output.stderr)))
  }
}

#[tauri::command]
async fn init_vault(password: String, app: tauri::AppHandle) -> Result<String, String> {
  let output = app.shell().sidecar("vault-core")
    .map_err(|e| format!("Failed to resolve vault-core binary: {}", e))?
    .args(["init", &password])
    .output()
    .await
    .map_err(|e| format!("Failed to spawn vault-core: {}", e))?;

  if output.status.success() {
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
  } else {
    Err(format!("vault-core failed: {}", String::from_utf8_lossy(&output.stderr)))
  }
}

#[tauri::command]
async fn unlock_vault(password: String, app: tauri::AppHandle) -> Result<String, String> {
  let output = app.shell().sidecar("vault-core")
    .map_err(|e| format!("Failed to resolve vault-core binary: {}", e))?
    .args(["unlock", &password])
    .output()
    .await
    .map_err(|e| format!("Failed to spawn vault-core: {}", e))?;

  if output.status.success() {
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
  } else {
    Err(format!("vault-core failed: {}", String::from_utf8_lossy(&output.stderr)))
  }
}

#[tauri::command]
async fn lock_vault(app: tauri::AppHandle) -> Result<String, String> {
  let output = app.shell().sidecar("vault-core")
    .map_err(|e| format!("Failed to resolve vault-core binary: {}", e))?
    .args(["lock"])
    .output()
    .await
    .map_err(|e| format!("Failed to spawn vault-core: {}", e))?;

  if output.status.success() {
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
  } else {
    Err(format!("vault-core failed: {}", String::from_utf8_lossy(&output.stderr)))
  }
}

#[tauri::command]
async fn vault_status(app: tauri::AppHandle) -> Result<String, String> {
  let output = app.shell().sidecar("vault-core")
    .map_err(|e| format!("Failed to resolve vault-core binary: {}", e))?
    .args(["status"])
    .output()
    .await
    .map_err(|e| format!("Failed to spawn vault-core: {}", e))?;

  if output.status.success() {
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
  } else {
    Err(format!("vault-core failed: {}", String::from_utf8_lossy(&output.stderr)))
  }
}
