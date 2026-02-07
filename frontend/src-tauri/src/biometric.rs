use crate::vault::Vault;

pub fn is_vault_biometric(vault: &Vault) -> Result<bool, String> {
    Ok(vault.get_auth_method()? == "biometric-keychain")
}
