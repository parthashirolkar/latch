use jsonwebtoken::{decode, Algorithm, Validation};
use serde::Deserialize;
use std::env;

#[derive(Debug, Deserialize)]
pub struct GoogleIdToken {
    pub sub: String,
}

fn get_app_secret() -> String {
    env::var("LATCH_OAUTH_SECRET").unwrap_or_else(|_| {
        // Fallback for development - NOT FOR PRODUCTION
        // This is only used if env var is not set
        "latch-dev-secret-32bytes-long!!".to_string()
    })
}

pub fn derive_key_from_oauth(user_id: &str) -> Result<[u8; 32], String> {
    let app_secret = get_app_secret();

    if app_secret.len() < 16 {
        return Err("App secret too short - must be at least 16 bytes".to_string());
    }

    // Use PBKDF2 to derive a 32-byte key
    // Salt includes user_id to make keys user-specific
    let salt = format!("latch-vault-oauth-{}", user_id);

    let mut key = [0u8; 32];
    pbkdf2::pbkdf2_hmac::<sha2::Sha256>(
        app_secret.as_bytes(),
        salt.as_bytes(),
        100_000, // 100,000 iterations
        &mut key,
    );

    Ok(key)
}

pub fn decode_id_token(id_token: &str) -> Result<GoogleIdToken, String> {
    // For ID tokens, we decode without verifying signature or any claims
    // The signature was already verified by the Google OAuth plugin
    // We just need to extract the 'sub' claim (user ID)
    let mut validation = Validation::new(Algorithm::RS256);
    validation.insecure_disable_signature_validation();
    validation.validate_aud = false;
    validation.validate_exp = false;
    validation.validate_nbf = false;
    validation.required_spec_claims.clear();

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
