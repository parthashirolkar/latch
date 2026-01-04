use std::process::Command;
use std::str;

fn get_vault_core_exe() -> &'static str {
  if cfg!(windows) {
    "vault-core.exe"
  } else {
    "vault-core"
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
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
fn search_entries(query: String) -> Result<String, String> {
  let output = Command::new(get_vault_core_exe())
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
  let output = Command::new(get_vault_core_exe())
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

#[tauri::command]
fn init_vault(password: String) -> Result<String, String> {
  let output = Command::new(get_vault_core_exe())
    .arg("init")
    .arg(&password)
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
fn unlock_vault(password: String) -> Result<String, String> {
  let output = Command::new(get_vault_core_exe())
    .arg("unlock")
    .arg(&password)
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
fn lock_vault() -> Result<String, String> {
  let output = Command::new(get_vault_core_exe())
    .arg("lock")
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
fn vault_status() -> Result<String, String> {
  let output = Command::new(get_vault_core_exe())
    .arg("status")
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
