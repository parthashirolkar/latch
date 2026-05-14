use super::{storage::VaultStorage, workspace::Workspace, Entry, VaultData};
use crate::crypto::aead;

pub fn add(workspace: &mut Workspace, storage: &VaultStorage, entry: Entry) -> Result<(), String> {
    workspace.check_session()?;
    workspace.refresh();
    workspace.credentials.push(entry);
    persist(workspace, storage)
}

pub fn get_full(workspace: &Workspace, id: &str) -> Result<Entry, String> {
    if !workspace.is_unlocked() {
        return Err("Vault is locked".to_string());
    }
    workspace
        .credentials
        .iter()
        .find(|e| e.id == id)
        .cloned()
        .ok_or_else(|| format!("Credential '{}' not found", id))
}

pub fn update(
    workspace: &mut Workspace,
    storage: &VaultStorage,
    entry: Entry,
) -> Result<(), String> {
    workspace.check_session()?;
    workspace.refresh();
    let idx = workspace
        .credentials
        .iter()
        .position(|e| e.id == entry.id)
        .ok_or_else(|| format!("Credential '{}' not found", entry.id))?;
    workspace.credentials[idx] = entry;
    persist(workspace, storage)
}

pub fn delete(workspace: &mut Workspace, storage: &VaultStorage, id: &str) -> Result<(), String> {
    workspace.check_session()?;
    workspace.refresh();
    let len_before = workspace.credentials.len();
    workspace.credentials.retain(|e| e.id != id);
    if workspace.credentials.len() == len_before {
        return Err("Credential not found".to_string());
    }
    persist(workspace, storage)
}

pub fn get_field(workspace: &mut Workspace, id: &str, field: &str) -> Result<String, String> {
    workspace.check_session()?;
    workspace.refresh();
    let entry = workspace
        .credentials
        .iter()
        .find(|e| e.id == id)
        .ok_or("Credential not found".to_string())?;
    match field {
        "title" => Ok(entry.title.clone()),
        "username" => Ok(entry.username.clone()),
        "password" => Ok(entry.password.clone()),
        _ => Err("Field not found".to_string()),
    }
}

fn persist(workspace: &Workspace, storage: &VaultStorage) -> Result<(), String> {
    let key = workspace.session_key.as_ref().ok_or("Vault is locked")?;
    let vault_data = VaultData {
        entries: workspace.credentials.clone(),
    };
    let json =
        serde_json::to_string(&vault_data).map_err(|e| format!("Failed to serialize: {}", e))?;
    let encrypted = aead::encrypt(key, &json)?;

    let mut vault = storage.read()?;
    vault.data = encrypted;
    storage.write(&vault)
}
