use super::{storage::VaultStorage, workspace::Workspace, VaultData};
use crate::crypto::aead;

pub fn access(
    storage: &VaultStorage,
    workspace: &mut Workspace,
    key: &[u8; 32],
) -> Result<(), String> {
    if !storage.exists() {
        return Err("Vault does not exist".to_string());
    }

    let vault = storage.read()?;
    let decrypted = aead::decrypt(key, &vault.data)?;
    let vault_data: VaultData = serde_json::from_str(&decrypted)
        .map_err(|e| format!("Failed to parse vault data: {}", e))?;

    workspace.start(*key);
    workspace.credentials = vault_data.entries;

    Ok(())
}
