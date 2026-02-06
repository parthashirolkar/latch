use crate::vault::Vault;

pub struct BiometricState {
    pub vault_key: Option<[u8; 32]>,
}

pub fn enable_biometric_unlock(
    vault: &mut Vault,
    biometric_state: &mut BiometricState,
) -> Result<(), String> {
    if !vault.is_unlocked() {
        return Err("Vault must be unlocked before enabling biometric".to_string());
    }

    let vault_key = vault
        .get_encryption_key()
        .map_err(|e| format!("Failed to get vault key: {}", e))?;

    biometric_state.vault_key = Some(vault_key);
    Ok(())
}

pub fn unlock_with_biometric_key(key: &[u8; 32], vault: &mut Vault) -> Result<(), String> {
    vault.unlock_with_key(key)
}

pub fn is_biometric_enabled(biometric_state: &BiometricState) -> bool {
    biometric_state.vault_key.is_some()
}

pub fn disable_biometric_unlock(biometric_state: &mut BiometricState) {
    biometric_state.vault_key = None;
}
