use std::process::Command;
use std::str;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      search_entries,
      request_secret,
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
fn search_entries(query: String) -> Result<String, String> {
  let output = Command::new("vault-core")
    .arg("search")
    .arg(&query)
    .output();

  match output {
    Ok(output) => {
      if output.status.success() {
        Ok(str::from_utf8(&output.stdout).unwrap_or("").to_string())
      } else {
        Err(format!("vault-core failed: {}", str::from_utf8(&output.stderr).unwrap_or("unknown error")))
      }
    }
    Err(e) => Err(format!("Failed to execute vault-core: {}", e)),
  }
}

#[tauri::command]
fn request_secret(entry_id: String, field: String) -> Result<String, String> {
  let output = Command::new("vault-core")
    .arg("request-secret")
    .arg(&entry_id)
    .arg(&field)
    .output();

  match output {
    Ok(output) => {
      if output.status.success() {
        Ok(str::from_utf8(&output.stdout).unwrap_or("").to_string())
      } else {
        Err(format!("vault-core failed: {}", str::from_utf8(&output.stderr).unwrap_or("unknown error")))
      }
    }
    Err(e) => Err(format!("Failed to execute vault-core: {}", e)),
  }
}
