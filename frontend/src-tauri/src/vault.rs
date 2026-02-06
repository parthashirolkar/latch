use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use fuzzy_matcher::skim::SkimMatcherV2;
use fuzzy_matcher::FuzzyMatcher;
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, time::SystemTime};

use crate::oauth::derive_key_from_oauth;

const SESSION_TIMEOUT_SECS: u64 = 30 * 60;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    pub id: String,
    pub title: String,
    pub username: String,
    pub password: String,
    pub url: Option<String>,
    pub icon_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryPreview {
    pub id: String,
    pub title: String,
    pub username: String,
    pub icon_url: Option<String>,
}

impl From<Entry> for EntryPreview {
    fn from(entry: Entry) -> Self {
        EntryPreview {
            id: entry.id,
            title: entry.title,
            username: entry.username,
            icon_url: entry.icon_url,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptedVault {
    pub version: String,
    pub kdf: String,
    pub salt: String,
    pub data: EncryptedData,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptedData {
    pub nonce: String,
    pub ciphertext: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VaultData {
    pub entries: Vec<Entry>,
}

pub struct Vault {
    entries: Vec<Entry>,
    pub(crate) session_key: Option<[u8; 32]>,
    pub(crate) session_start: Option<SystemTime>,
    pub(crate) vault_path: PathBuf,
}

impl Vault {
    pub fn new() -> Result<Self, String> {
        let vault_path = get_vault_path()?;
        let config_dir = vault_path.parent().ok_or("Invalid vault path")?;

        fs::create_dir_all(config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;

        Ok(Vault {
            entries: Vec::new(),
            session_key: None,
            session_start: None,
            vault_path,
        })
    }

    pub fn vault_exists(&self) -> bool {
        self.vault_path.exists()
    }

    pub fn encrypt_data(key: &[u8; 32], data: &str) -> Result<EncryptedData, String> {
        let cipher = Aes256Gcm::new(key.into());
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

        let ciphertext = cipher
            .encrypt(&nonce, data.as_bytes())
            .map_err(|e| format!("Encryption failed: {}", e))?;

        Ok(EncryptedData {
            nonce: hex::encode(nonce),
            ciphertext: hex::encode(ciphertext),
        })
    }

    pub fn decrypt_data(key: &[u8; 32], encrypted_data: &EncryptedData) -> Result<String, String> {
        let cipher = Aes256Gcm::new(key.into());
        let nonce_bytes = hex::decode(&encrypted_data.nonce)
            .map_err(|e| format!("Invalid nonce encoding: {}", e))?;
        let ciphertext = hex::decode(&encrypted_data.ciphertext)
            .map_err(|e| format!("Invalid ciphertext encoding: {}", e))?;

        let nonce = Nonce::from_slice(&nonce_bytes);

        let plaintext = cipher
            .decrypt(nonce, ciphertext.as_ref())
            .map_err(|e| format!("Decryption failed: {}", e))?;

        String::from_utf8(plaintext).map_err(|e| format!("Invalid UTF-8 in decrypted data: {}", e))
    }

    fn check_session(&self) -> Result<(), String> {
        if self.session_key.is_none() {
            return Err("Vault is locked".to_string());
        }

        if let Some(start) = self.session_start {
            let elapsed = start
                .elapsed()
                .map_err(|e| format!("Failed to get elapsed time: {}", e))?
                .as_secs();

            if elapsed > SESSION_TIMEOUT_SECS {
                return Err("Session expired".to_string());
            }
        } else {
            return Err("Invalid session".to_string());
        }

        Ok(())
    }

    fn refresh_session(&mut self) {
        self.session_start = Some(SystemTime::now());
    }
    pub fn lock_vault(&mut self) {
        self.session_key = None;
        self.session_start = None;
        self.entries.clear();
    }

    pub fn is_unlocked(&self) -> bool {
        self.session_key.is_some()
    }

    pub fn search_entries(&mut self, query: &str) -> Result<Vec<EntryPreview>, String> {
        self.check_session()?;
        self.refresh_session();

        let matcher = SkimMatcherV2::default();
        let mut scored_entries: Vec<(i64, EntryPreview)> = Vec::new();

        for entry in &self.entries {
            if query.is_empty() {
                scored_entries.push((0, entry.clone().into()));
                continue;
            }

            let title_score = matcher.fuzzy_match(&entry.title, query).unwrap_or(0);
            let username_score = matcher.fuzzy_match(&entry.username, query).unwrap_or(0);
            let best_score = title_score.max(username_score);

            if best_score >= 50 {
                scored_entries.push((best_score, entry.clone().into()));
            }
        }

        scored_entries.sort_by(|a, b| b.0.cmp(&a.0));
        let results: Vec<EntryPreview> =
            scored_entries.into_iter().map(|(_, entry)| entry).collect();

        Ok(results)
    }

    pub fn get_entry(&mut self, entry_id: &str, field: &str) -> Result<String, String> {
        self.check_session()?;
        self.refresh_session();

        let entry = self
            .entries
            .iter()
            .find(|e| e.id == entry_id)
            .ok_or("Entry not found".to_string())?;

        match field {
            "title" => Ok(entry.title.clone()),
            "username" => Ok(entry.username.clone()),
            "password" => Ok(entry.password.clone()),
            _ => Err("Field not found".to_string()),
        }
    }

    pub fn add_entry(&mut self, entry: Entry) -> Result<(), String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }
        self.entries.push(entry);
        Ok(())
    }

    pub fn get_full_entry(&self, entry_id: &str) -> Result<Entry, String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }
        self.entries
            .iter()
            .find(|e| e.id == entry_id)
            .cloned()
            .ok_or_else(|| format!("Entry '{}' not found", entry_id))
    }

    pub fn update_entry(&mut self, entry: Entry) -> Result<(), String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }
        let index = self
            .entries
            .iter()
            .position(|e| e.id == entry.id)
            .ok_or_else(|| format!("Entry '{}' not found", entry.id))?;

        self.entries[index] = entry;
        Ok(())
    }

    pub fn delete_entry(&mut self, entry_id: &str) -> Result<(), String> {
        self.check_session()?;
        self.refresh_session();

        let original_len = self.entries.len();
        self.entries.retain(|e| e.id != entry_id);

        if self.entries.len() == original_len {
            return Err("Entry not found".to_string());
        }

        self.save_vault()?;
        Ok(())
    }

    fn save_vault(&self) -> Result<(), String> {
        let key = self.session_key.ok_or("Vault is locked".to_string())?;

        let vault_data = VaultData {
            entries: self.entries.clone(),
        };

        let json_data = serde_json::to_string(&vault_data)
            .map_err(|e| format!("Failed to serialize vault data: {}", e))?;

        let encrypted_data = Self::encrypt_data(&key, &json_data)?;

        let content = fs::read_to_string(&self.vault_path)
            .map_err(|e| format!("Failed to read vault: {}", e))?;

        let mut vault: EncryptedVault =
            serde_json::from_str(&content).map_err(|e| format!("Failed to parse vault: {}", e))?;

        vault.data = encrypted_data;

        let json_vault = serde_json::to_string_pretty(&vault)
            .map_err(|e| format!("Failed to serialize vault: {}", e))?;

        fs::write(&self.vault_path, json_vault)
            .map_err(|e| format!("Failed to write vault: {}", e))?;

        Ok(())
    }

    pub fn init_with_oauth(&mut self, user_id: &str) -> Result<(), String> {
        if self.vault_exists() {
            return Err("Vault already exists".to_string());
        }

        let key = derive_key_from_oauth(user_id)?;

        let vault_data = VaultData {
            entries: Vec::new(),
        };
        let json_data = serde_json::to_string(&vault_data)
            .map_err(|e| format!("Failed to serialize vault data: {}", e))?;

        let encrypted_data = Self::encrypt_data(&key, &json_data)?;

        let vault = EncryptedVault {
            version: "1".to_string(),
            kdf: "oauth-pbkdf2".to_string(),
            salt: user_id.to_string(),
            data: encrypted_data,
        };

        let json_vault = serde_json::to_string_pretty(&vault)
            .map_err(|e| format!("Failed to serialize vault: {}", e))?;

        fs::write(&self.vault_path, json_vault)
            .map_err(|e| format!("Failed to write vault: {}", e))?;

        self.session_key = Some(key);
        self.session_start = Some(SystemTime::now());
        self.entries = Vec::new();

        Ok(())
    }

    pub fn unlock_with_oauth(&mut self, user_id: &str) -> Result<(), String> {
        if !self.vault_exists() {
            return Err("Vault does not exist".to_string());
        }

        let content = fs::read_to_string(&self.vault_path)
            .map_err(|e| format!("Failed to read vault: {}", e))?;

        let vault: EncryptedVault =
            serde_json::from_str(&content).map_err(|e| format!("Failed to parse vault: {}", e))?;

        if vault.kdf != "oauth-pbkdf2" {
            return Err("Vault was created with password auth. Use migration first.".to_string());
        }

        if vault.salt != user_id {
            return Err("Wrong user account".to_string());
        }

        let key = derive_key_from_oauth(user_id)?;

        let decrypted = Self::decrypt_data(&key, &vault.data)?;

        let vault_data: VaultData = serde_json::from_str(&decrypted)
            .map_err(|e| format!("Failed to parse vault data: {}", e))?;

        self.session_key = Some(key);
        self.session_start = Some(SystemTime::now());
        self.entries = vault_data.entries;

        Ok(())
    }

    pub fn get_encryption_key(&self) -> Result<[u8; 32], String> {
        self.session_key.ok_or("Vault is not unlocked".to_string())
    }

    pub fn unlock_with_key(&mut self, key: &[u8; 32]) -> Result<(), String> {
        if !self.vault_exists() {
            return Err("Vault does not exist".to_string());
        }

        let content = fs::read_to_string(&self.vault_path)
            .map_err(|e| format!("Failed to read vault: {}", e))?;

        let vault: EncryptedVault =
            serde_json::from_str(&content).map_err(|e| format!("Failed to parse vault: {}", e))?;

        if vault.kdf != "oauth-pbkdf2" {
            return Err("Vault was created with password auth. Use migration first.".to_string());
        }

        let decrypted = Self::decrypt_data(key, &vault.data)?;

        let vault_data: VaultData = serde_json::from_str(&decrypted)
            .map_err(|e| format!("Failed to parse vault data: {}", e))?;

        self.session_key = Some(*key);
        self.session_start = Some(SystemTime::now());
        self.entries = vault_data.entries;

        Ok(())
    }
}

fn get_vault_path() -> Result<PathBuf, String> {
    let config_dir = if cfg!(target_os = "windows") {
        dirs::config_dir()
            .map(|p| p.join("Latch"))
            .ok_or("Failed to get config dir")?
    } else if cfg!(target_os = "macos") {
        dirs::config_dir()
            .map(|p| p.join("Latch"))
            .ok_or("Failed to get config dir")?
    } else {
        dirs::config_dir()
            .map(|p| p.join("latch"))
            .ok_or("Failed to get config dir")?
    };

    Ok(config_dir.join("vault.enc"))
}
