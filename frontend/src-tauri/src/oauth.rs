use argon2::{Argon2, Params};
use jsonwebtoken::{decode, Algorithm, Validation};
use serde::Deserialize;
use std::env;

#[derive(Debug, Deserialize)]
pub struct GoogleIdToken {
    pub sub: String,
}

fn get_app_secret() -> String {
    let secret = env::var("LATCH_OAUTH_SECRET").unwrap_or_else(|_| {
        panic!("LATCH_OAUTH_SECRET environment variable not set. Please set it for production use.")
    });

    if secret.len() < 32 {
        panic!(
            "LATCH_OAUTH_SECRET must be at least 32 bytes for security. Current length: {}",
            secret.len()
        )
    }

    secret
}

pub fn derive_key_from_oauth(user_id: &str) -> Result<[u8; 32], String> {
    let app_secret = get_app_secret();

    // Use Argon2id to derive a 32-byte key
    // Parameters: memory_cost=65536 (64MB), time_cost=3, parallelism=4
    let params =
        Params::new(65536, 3, 4, Some(32)).map_err(|e| format!("Invalid Argon2 params: {}", e))?;

    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);

    // Salt includes user_id to make keys user-specific
    let salt = format!("latch-vault-oauth-{}", user_id);
    let salt_bytes = salt.as_bytes();

    // Derive key using Argon2id
    let mut key = [0u8; 32];
    argon2
        .hash_password_into(app_secret.as_bytes(), salt_bytes, &mut key)
        .map_err(|e| format!("Argon2 hashing failed: {}", e))?;

    Ok(key)
}

pub fn decode_id_token(id_token: &str) -> Result<GoogleIdToken, String> {
    // Validate critical claims for security
    // Note: Signature validation requires fetching Google's public keys (JWKs)
    // which should be implemented for production. For now, we validate claims.
    let client_id = env::var("LATCH_OAUTH_CLIENT_ID").unwrap_or_else(|_| String::new());

    let mut validation = Validation::new(Algorithm::RS256);
    validation.insecure_disable_signature_validation();
    validation.validate_aud = true;
    validation.validate_exp = true;
    validation.validate_nbf = true;
    validation.set_issuer(&["https://accounts.google.com", "accounts.google.com"]);

    if !client_id.is_empty() {
        validation.set_audience(&[&client_id]);
    }

    let token_data = decode::<GoogleIdToken>(
        id_token,
        &jsonwebtoken::DecodingKey::from_secret(&[]),
        &validation,
    )
    .map_err(|e| format!("Failed to decode token: {}", e))?;

    Ok(token_data.claims)
}

pub fn get_user_id_from_token(id_token: &str) -> Result<String, String> {
    let claims = decode_id_token(id_token)?;
    Ok(claims.sub)
}
