use std::fs;
use std::path::PathBuf;

use super::EncryptedVault;

pub struct VaultStorage {
    pub path: PathBuf,
}

impl VaultStorage {
    pub fn new() -> Result<Self, String> {
        let path = get_vault_path()?;
        let config_dir = path.parent().ok_or("Invalid vault path")?;
        fs::create_dir_all(config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
        Ok(Self { path })
    }

    pub fn exists(&self) -> bool {
        self.path.exists()
    }

    pub fn read(&self) -> Result<EncryptedVault, String> {
        let content =
            fs::read_to_string(&self.path).map_err(|e| format!("Failed to read vault: {}", e))?;
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse vault: {}", e))
    }

    pub fn write(&self, vault: &EncryptedVault) -> Result<(), String> {
        let json = serde_json::to_string_pretty(vault)
            .map_err(|e| format!("Failed to serialize vault: {}", e))?;

        let tmp_path = self.path.with_extension("enc.tmp");
        fs::write(&tmp_path, &json).map_err(|e| format!("Failed to write vault: {}", e))?;
        fs::rename(&tmp_path, &self.path).map_err(|e| format!("Failed to rename vault: {}", e))?;
        Ok(())
    }
}

fn get_vault_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .map(|p| {
            if cfg!(target_os = "linux") {
                p.join("latch")
            } else {
                p.join("Latch")
            }
        })
        .ok_or("Failed to get config dir")?;
    Ok(config_dir.join("vault.enc"))
}
