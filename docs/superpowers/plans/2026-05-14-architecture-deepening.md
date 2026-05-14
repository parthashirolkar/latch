# Architecture Deepening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Latch Password Manager codebase by decomposing shallow modules (lib.rs, vault.rs, CommandPalette.tsx) into focused, deep modules with clean seams, replacing monolithic CSS with Tailwind v4 + shadcn/ui, and cleaning up unwanted files.

**Architecture:** Dependency-ordered restructuring. Backend first: extract pure crypto, then auth, then vault sub-modules, then Tauri commands, then slim lib.rs. Frontend: install Tailwind/shadcn, build typed API client, decompose CommandPalette into mode components, migrate UI to Tailwind. File cleanup runs in parallel.

**Tech Stack:** Rust (Tauri v2, AES-256-GCM, Argon2id, PBKDF2), TypeScript (React 19, Vite 7, Tailwind v4, shadcn/ui, Zod), Bun package manager.

---

## Task 1: File Cleanup — Remove Unwanted Files

**Files:**
- Delete: `.cursorignore`
- Delete: `GEMINI.md`
- Delete: `CLAUDE.md`
- Delete: `.agent/skills/` (entire directory)
- Delete: `dist/` (entire directory)
- Modify: `.gitignore` (add `dist/` entry if missing)

- [ ] **Step 1: Delete unwanted files and directories**

```powershell
Remove-Item -LiteralPath "D:\git_repos\latch\.cursorignore" -Force
Remove-Item -LiteralPath "D:\git_repos\latch\GEMINI.md" -Force
Remove-Item -LiteralPath "D:\git_repos\latch\CLAUDE.md" -Force
Remove-Item -LiteralPath "D:\git_repos\latch\.agent\skills" -Recurse -Force
Remove-Item -LiteralPath "D:\git_repos\latch\dist" -Recurse -Force
```

- [ ] **Step 2: Check .gitignore for dist/**

Read `.gitignore` and check if `dist/` is listed. If not, append `dist/` on a new line.

- [ ] **Step 3: Verify files are gone**

Run: `Get-ChildItem -LiteralPath "D:\git_repos\latch" -Name ".cursorignore","GEMINI.md","CLAUDE.md"` — Expected: no results.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove unwanted files and build artifacts"
```

---

## Task 2: Create Rust Crypto Module — Pure AEAD Functions

**Files:**
- Create: `frontend/src-tauri/src/crypto/mod.rs`
- Create: `frontend/src-tauri/src/crypto/aead.rs`
- Modify: `frontend/src-tauri/src/lib.rs` (add `mod crypto;`)

- [ ] **Step 1: Create `crypto/mod.rs`**

```rust
pub mod aead;
```

- [ ] **Step 2: Create `crypto/aead.rs`**

Move `encrypt_data` and `decrypt_data` from `vault.rs` into pure functions that take a key and data, returning results with no filesystem or state dependencies. Also move the `EncryptedData` struct.

```rust
use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptedData {
    pub nonce: String,
    pub ciphertext: String,
}

pub fn encrypt(key: &[u8; 32], plaintext: &str) -> Result<EncryptedData, String> {
    let cipher = Aes256Gcm::new(key.into());
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    Ok(EncryptedData {
        nonce: hex::encode(nonce),
        ciphertext: hex::encode(ciphertext),
    })
}

pub fn decrypt(key: &[u8; 32], data: &EncryptedData) -> Result<String, String> {
    let cipher = Aes256Gcm::new(key.into());
    let nonce_bytes =
        hex::decode(&data.nonce).map_err(|e| format!("Invalid nonce encoding: {}", e))?;
    let ciphertext = hex::decode(&data.ciphertext)
        .map_err(|e| format!("Invalid ciphertext encoding: {}", e))?;

    let nonce = Nonce::from_slice(&nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(plaintext).map_err(|e| format!("Invalid UTF-8 in decrypted data: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = [42u8; 32];
        let plaintext = "hello world";
        let encrypted = encrypt(&key, plaintext).unwrap();
        let decrypted = decrypt(&key, &encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_decrypt_wrong_key_fails() {
        let key1 = [1u8; 32];
        let key2 = [2u8; 32];
        let encrypted = encrypt(&key1, "secret").unwrap();
        assert!(decrypt(&key2, &encrypted).is_err());
    }

    #[test]
    fn test_decrypt_tampered_ciphertext_fails() {
        let key = [1u8; 32];
        let mut encrypted = encrypt(&key, "secret").unwrap();
        encrypted.ciphertext = "deadbeef".to_string();
        assert!(decrypt(&key, &encrypted).is_err());
    }
}
```

- [ ] **Step 3: Add `mod crypto;` to `lib.rs`**

Insert `mod crypto;` after the existing `mod` declarations at the top of `lib.rs`.

- [ ] **Step 4: Verify compilation and tests**

Run: `cargo test -p latch crypto::aead` — Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src-tauri/src/crypto/ frontend/src-tauri/src/lib.rs
git commit -m "refactor: extract pure AEAD crypto functions into crypto module"
```

---

## Task 3: Create Rust Auth Module

**Files:**
- Create: `frontend/src-tauri/src/auth/mod.rs`
- Create: `frontend/src-tauri/src/auth/method.rs`
- Create: `frontend/src-tauri/src/auth/lockout.rs`
- Create: `frontend/src-tauri/src/auth/password.rs`
- Create: `frontend/src-tauri/src/auth/oauth.rs`
- Modify: `frontend/src-tauri/src/lib.rs` (add `mod auth;`, remove inline AuthAttemptState)
- Delete: `frontend/src-tauri/src/password.rs` (moved to auth)
- Delete: `frontend/src-tauri/src/oauth.rs` (moved to auth)

- [ ] **Step 1: Create `auth/mod.rs`**

```rust
pub mod lockout;
pub mod method;
pub mod oauth;
pub mod password;
```

- [ ] **Step 2: Create `auth/method.rs`**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AuthMethod {
    Password,
    OAuth,
    Biometric,
}

impl AuthMethod {
    /// Tag stored in the vault file's `kdf` field.
    pub fn vault_tag(&self) -> &'static str {
        match self {
            AuthMethod::Password => "password-pbkdf2",
            AuthMethod::OAuth => "oauth-argon2id",
            AuthMethod::Biometric => "biometric-keychain",
        }
    }

    /// Parse from a vault file's `kdf` field.
    pub fn from_vault_tag(tag: &str) -> Option<Self> {
        match tag {
            "password-pbkdf2" => Some(AuthMethod::Password),
            "oauth-argon2id" | "oauth-pbkdf2" => Some(AuthMethod::OAuth),
            "biometric-keychain" => Some(AuthMethod::Biometric),
            _ => None,
        }
    }

    pub fn all_tags() -> &'static [&'static str] {
        &["password-pbkdf2", "oauth-argon2id", "oauth-pbkdf2", "biometric-keychain"]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_roundtrip_all_methods() {
        for method in &[AuthMethod::Password, AuthMethod::OAuth, AuthMethod::Biometric] {
            let tag = method.vault_tag();
            let parsed = AuthMethod::from_vault_tag(tag).unwrap();
            assert_eq!(*method, parsed);
        }
    }

    #[test]
    fn test_oauth_legacy_pbkdf2_tag() {
        let method = AuthMethod::from_vault_tag("oauth-pbkdf2").unwrap();
        assert_eq!(method, AuthMethod::OAuth);
    }

    #[test]
    fn test_unknown_tag() {
        assert!(AuthMethod::from_vault_tag("unknown").is_none());
    }
}
```

- [ ] **Step 3: Create `auth/lockout.rs`** — move `AuthAttemptState` from `lib.rs`

```rust
use std::time::{Duration, Instant};

const MAX_FAILED_ATTEMPTS: u32 = 10;
const BASE_LOCKOUT_DURATION: Duration = Duration::from_secs(5);
const MAX_LOCKOUT_DURATION: Duration = Duration::from_secs(300);

pub struct AuthAttemptState {
    failed_attempts: u32,
    last_failed_time: Option<Instant>,
    lockout_until: Option<Instant>,
}

impl AuthAttemptState {
    pub fn new() -> Self {
        Self {
            failed_attempts: 0,
            last_failed_time: None,
            lockout_until: None,
        }
    }

    pub fn is_locked_out(&self) -> bool {
        if let Some(lockout) = self.lockout_until {
            Instant::now() < lockout
        } else {
            false
        }
    }

    pub fn record_failure(&mut self) -> Result<(), String> {
        self.failed_attempts += 1;
        self.last_failed_time = Some(Instant::now());

        if self.failed_attempts >= MAX_FAILED_ATTEMPTS {
            self.lockout_until = Some(Instant::now() + MAX_LOCKOUT_DURATION);
            return Err(format!(
                "Too many failed attempts. Account locked for {} minutes.",
                MAX_LOCKOUT_DURATION.as_secs() / 60
            ));
        }

        let lockout_duration = BASE_LOCKOUT_DURATION
            .saturating_mul(2_u32.pow(self.failed_attempts.saturating_sub(1)));
        let lockout_duration = std::cmp::min(lockout_duration, MAX_LOCKOUT_DURATION);
        self.lockout_until = Some(Instant::now() + lockout_duration);

        Err(format!(
            "Too many failed attempts. Please try again in {} seconds.",
            lockout_duration.as_secs()
        ))
    }

    pub fn reset(&mut self) {
        self.failed_attempts = 0;
        self.last_failed_time = None;
        self.lockout_until = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_is_not_locked_out() {
        let state = AuthAttemptState::new();
        assert!(!state.is_locked_out());
    }

    #[test]
    fn test_first_failure_returns_error_with_wait() {
        let mut state = AuthAttemptState::new();
        let result = state.record_failure();
        assert!(result.is_err());
        assert!(state.is_locked_out());
    }

    #[test]
    fn test_reset_clears_lockout() {
        let mut state = AuthAttemptState::new();
        state.record_failure().ok();
        state.reset();
        assert!(!state.is_locked_out());
        assert_eq!(state.failed_attempts, 0);
    }
}
```

- [ ] **Step 4: Create `auth/password.rs`** — move from `src/password.rs`

```rust
use pbkdf2::pbkdf2_hmac;
use rand::Rng;
use sha2::Sha256;

const PBKDF2_ITERATIONS: u32 = 100_000;

pub fn derive_key(password: &str, salt: &[u8; 32]) -> [u8; 32] {
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, PBKDF2_ITERATIONS, &mut key);
    key
}

pub fn generate_salt() -> [u8; 32] {
    rand::thread_rng().gen()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_key_deterministic() {
        let salt = [0u8; 32];
        let key1 = derive_key("password", &salt);
        let key2 = derive_key("password", &salt);
        assert_eq!(key1, key2);
    }

    #[test]
    fn test_different_passwords_different_keys() {
        let salt = [0u8; 32];
        let key1 = derive_key("password1", &salt);
        let key2 = derive_key("password2", &salt);
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_key_is_32_bytes() {
        let key = derive_key("test", &[1u8; 32]);
        assert_eq!(key.len(), 32);
    }

    #[test]
    fn test_generate_salt_is_32_bytes() {
        let salt = generate_salt();
        assert_eq!(salt.len(), 32);
    }
}
```

- [ ] **Step 5: Create `auth/oauth.rs`** — move from `src/oauth.rs` (rename `derive_key_from_oauth` to `derive_key`, `get_user_id_from_token` to `extract_user_id`)

```rust
use argon2::{Argon2, Params};
use jsonwebtoken::{decode, Algorithm, Validation};
use serde::Deserialize;
use std::env;

#[derive(Debug, Deserialize)]
pub struct GoogleIdToken {
    pub sub: String,
}

fn get_app_secret() -> String {
    let secret = env::var("LATCH_OAUTH_SECRET")
        .unwrap_or_else(|_| "test-secret-for-development-only-32b".to_string());

    if secret.len() < 32 {
        panic!(
            "LATCH_OAUTH_SECRET must be at least 32 bytes for security. Current length: {}",
            secret.len()
        )
    }

    secret
}

pub fn derive_key(user_id: &str) -> Result<[u8; 32], String> {
    let app_secret = get_app_secret();

    let params =
        Params::new(65536, 3, 4, Some(32)).map_err(|e| format!("Invalid Argon2 params: {}", e))?;

    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);

    let salt = format!("latch-vault-oauth-{}", user_id);
    let salt_bytes = salt.as_bytes();

    let mut key = [0u8; 32];
    argon2
        .hash_password_into(app_secret.as_bytes(), salt_bytes, &mut key)
        .map_err(|e| format!("Argon2 hashing failed: {}", e))?;

    Ok(key)
}

pub fn decode_id_token(id_token: &str) -> Result<GoogleIdToken, String> {
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

pub fn extract_user_id(id_token: &str) -> Result<String, String> {
    let claims = decode_id_token(id_token)?;
    Ok(claims.sub)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_key_returns_32_bytes() {
        let key = derive_key("test-user-id-123").unwrap();
        assert_eq!(key.len(), 32);
    }

    #[test]
    fn test_derive_key_different_users() {
        let key1 = derive_key("user-1").unwrap();
        let key2 = derive_key("user-2").unwrap();
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_decode_id_token_empty() {
        assert!(decode_id_token("").is_err());
    }
}
```

- [ ] **Step 6: Update `lib.rs` references**

In `lib.rs`:
- Add `mod auth;` to module declarations
- Remove `mod oauth;` and `mod password;` (moved to auth)
- Change `use oauth::get_user_id_from_token;` to `use auth::oauth::extract_user_id;`
- Remove the inline `AuthAttemptState` struct and `AuthState` struct (move to use `auth::lockout::AuthAttemptState`)
- Update `validate_entry_fields` to keep it in lib.rs for now (or move to commands later)

- [ ] **Step 7: Delete old files**

Delete `frontend/src-tauri/src/password.rs` and `frontend/src-tauri/src/oauth.rs`.

- [ ] **Step 8: Verify compilation and all auth tests**

Run: `cargo test -p latch auth` — Expected: all tests pass.

- [ ] **Step 9: Verify full test suite still passes**

Run: `cargo test -p latch` — Expected: all existing tests pass.

- [ ] **Step 10: Commit**

```bash
git add frontend/src-tauri/src/auth/ frontend/src-tauri/src/lib.rs
git add -u frontend/src-tauri/src/password.rs frontend/src-tauri/src/oauth.rs
git commit -m "refactor: extract auth module with method, lockout, password, and oauth"
```

---

## Task 4: Extract VaultHealth BreachChecker Trait

**Files:**
- Modify: `frontend/src-tauri/src/vault_health.rs` (refactor to use trait)
- Create: `frontend/src-tauri/src/vault_health/breach_checker.rs` (trait + PwnedPasswordsApi adapter)

**Wait** — per the spec, vault_health should become a directory. Let me create the submodule structure.

- [ ] **Step 1: Create `vault_health/mod.rs`** — move existing code, rename `crate::vault::Entry` to `crate::vault::Credential` eventually, but for now keep `Entry`:

```rust
pub mod audit;
pub mod breach_checker;
```

- [ ] **Step 2: Move existing vault_health logic to `vault_health/audit.rs`** — move the functions `check_weak_passwords`, `check_reused_passwords`, `check_vault_health`, `calculate_vault_health_score` and all their types (WeakPassword, ReusedPassword, BreachedCredential, VaultHealthReport, ReusedEntry). Keep `check_single_breach` private, it will call the injected trait.

- [ ] **Step 3: Create `vault_health/breach_checker.rs`** with a trait and real adapter:

```rust
use std::future::Future;
use std::pin::Pin;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BreachResult {
    pub hash_suffix: String,
    pub count: u32,
}

pub trait BreachChecker: Send + Sync {
    fn check(&self, password: &str) -> Pin<Box<dyn Future<Output = Option<BreachResult>> + Send + '_>>;
}

pub struct PwnedPasswordsApi;

impl BreachChecker for PwnedPasswordsApi {
    fn check(&self, password: &str) -> Pin<Box<dyn Future<Output = Option<BreachResult>> + Send + '_>> {
        let password = password.to_string();
        Box::pin(async move {
            use sha1::{Digest, Sha1};
            let hash = Sha1::digest(password.as_bytes());
            let hash_hex = format!("{:x}", hash);
            let hash_upper = hash_hex.to_uppercase();
            let prefix = &hash_upper[..5];
            let suffix = &hash_upper[5..];

            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .ok()?;

            let response = client
                .get(format!("https://api.pwnedpasswords.com/range/{}", prefix))
                .header("User-Agent", "Latch-Password-Manager")
                .send()
                .await
                .ok()?;

            let body = response.text().await.ok()?;

            for line in body.lines() {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() == 2 && parts[0].eq_ignore_ascii_case(suffix) {
                    let count: u32 = parts[1].trim().parse().unwrap_or(0);
                    return Some(BreachResult {
                        hash_suffix: suffix.to_string(),
                        count,
                    });
                }
            }

            None
        })
    }
}

pub struct StubBreachChecker {
    pub results: Vec<(String, u32)>,
}

impl BreachChecker for StubBreachChecker {
    fn check(&self, password: &str) -> Pin<Box<dyn Future<Output = Option<BreachResult>> + Send + '_>> {
        let password = password.to_string();
        let results = self.results.clone();
        Box::pin(async move {
            for (pwd, count) in &results {
                if pwd == &password {
                    return Some(BreachResult {
                        hash_suffix: String::new(),
                        count: *count,
                    });
                }
            }
            None
        })
    }
}
```

- [ ] **Step 4: Update `check_breach_status` in `audit.rs`** to accept a `&dyn BreachChecker` parameter instead of calling HTTP directly:

```rust
pub async fn check_breach_status(
    entries: &[Entry],
    checker: &dyn BreachChecker,
) -> Vec<BreachedCredential> {
    let mut breached = Vec::new();
    for entry in entries {
        if let Some(result) = checker.check(&entry.password).await {
            if result.count > 0 {
                breached.push(BreachedCredential {
                    entry_id: entry.id.clone(),
                    title: entry.title.clone(),
                    username: entry.username.clone(),
                    breach_count: result.count,
                });
            }
        }
    }
    breached.sort_by(|a, b| b.breach_count.cmp(&a.breach_count));
    breached
}
```

- [ ] **Step 5: Update `check_vault_health`** to also accept the checker:

```rust
pub async fn check_vault_health(
    entries: &[Entry],
    checker: &dyn BreachChecker,
) -> VaultHealthReport { /* ... */ }
```

- [ ] **Step 6: Delete the old `vault_health.rs` file** after confirming the new directory structure works.

- [ ] **Step 7: Update `lib.rs`** — change `mod vault_health;` to reference the new module path. Update the `check_vault_health` command to use `PwnedPasswordsApi`.

- [ ] **Step 8: Verify compilation and tests**

Run: `cargo test -p latch vault_health` — Expected: tests pass (network test still `#[ignore]`).

- [ ] **Step 9: Add an offline test using StubBreachChecker**

```rust
#[tokio::test]
async fn test_stub_breach_checker() {
    let checker = StubBreachChecker {
        results: vec![("password123".to_string(), 42000)],
    };
    let entries = vec![
        crate::vault::Entry {
            id: "1".into(),
            title: "Test".into(),
            username: "user".into(),
            password: "password123".into(),
            url: None,
            icon_url: None,
        },
    ];
    let breached = check_breach_status(&entries, &checker).await;
    assert_eq!(breached.len(), 1);
    assert_eq!(breached[0].breach_count, 42000);
}
```

- [ ] **Step 10: Commit**

```bash
git add frontend/src-tauri/src/vault_health/ frontend/src-tauri/src/lib.rs
git commit -m "refactor: extract breach checker trait with stub for offline testing"
```

---

## Task 5: Decompose Vault into Sub-Modules

**Files:**
- Create: `frontend/src-tauri/src/vault/mod.rs`
- Create: `frontend/src-tauri/src/vault/storage.rs`
- Create: `frontend/src-tauri/src/vault/workspace.rs`
- Create: `frontend/src-tauri/src/vault/provision.rs`
- Create: `frontend/src-tauri/src/vault/access.rs`
- Create: `frontend/src-tauri/src/vault/rotate.rs`
- Create: `frontend/src-tauri/src/vault/entries.rs`
- Create: `frontend/src-tauri/src/vault/search.rs`
- Delete: `frontend/src-tauri/src/vault.rs` (replaced by directory)
- Modify: `frontend/src-tauri/src/lib.rs`

- [ ] **Step 1: Create `vault/mod.rs`**

Re-export all public types. Define `Entry` and `EntryPreview` (keeping the name `Entry` for now — rename to `Credential` happens as a separate task if desired). Define the `EncryptedVault` and `VaultData` structs.

```rust
pub mod access;
pub mod entries;
pub mod provision;
pub mod rotate;
pub mod search;
pub mod storage;
pub mod workspace;

use serde::{Deserialize, Serialize};

pub const SESSION_TIMEOUT_SECS: u64 = 30 * 60;

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
    pub data: crate::crypto::aead::EncryptedData,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VaultData {
    pub entries: Vec<Entry>,
}
```

- [ ] **Step 2: Create `vault/storage.rs`** — atomic file I/O, vault path resolution

```rust
use std::path::PathBuf;
use std::fs;

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
        let content = fs::read_to_string(&self.path)
            .map_err(|e| format!("Failed to read vault: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse vault: {}", e))
    }

    pub fn write(&self, vault: &EncryptedVault) -> Result<(), String> {
        let json = serde_json::to_string_pretty(vault)
            .map_err(|e| format!("Failed to serialize vault: {}", e))?;

        let tmp_path = self.path.with_extension("enc.tmp");
        fs::write(&tmp_path, &json)
            .map_err(|e| format!("Failed to write vault: {}", e))?;
        fs::rename(&tmp_path, &self.path)
            .map_err(|e| format!("Failed to rename vault: {}", e))?;
        Ok(())
    }
}

fn get_vault_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .map(|p| if cfg!(target_os = "linux") { p.join("latch") } else { p.join("Latch") })
        .ok_or("Failed to get config dir")?;
    Ok(config_dir.join("vault.enc"))
}
```

- [ ] **Step 3: Create `vault/workspace.rs`** — in-memory state

```rust
use std::time::SystemTime;
use zeroize::Zeroize;
use super::{Entry, SESSION_TIMEOUT_SECS};

pub struct Workspace {
    pub credentials: Vec<Entry>,
    pub session_key: Option<zeroize::Zeroizing<[u8; 32]>>,
    pub session_start: Option<SystemTime>,
}

impl Workspace {
    pub fn new() -> Self {
        Self {
            credentials: Vec::new(),
            session_key: None,
            session_start: None,
        }
    }

    pub fn is_unlocked(&self) -> bool {
        self.session_key.is_some()
    }

    pub fn check_session(&mut self) -> Result<(), String> {
        if self.session_key.is_none() {
            return Err("Vault is locked".to_string());
        }
        if let Some(start) = self.session_start {
            let elapsed = start.elapsed()
                .map_err(|e| format!("Failed to get elapsed time: {}", e))?
                .as_secs();
            if elapsed > SESSION_TIMEOUT_SECS {
                self.lock();
                return Err("Session expired".to_string());
            }
        } else {
            return Err("Invalid session".to_string());
        }
        Ok(())
    }

    pub fn refresh(&mut self) {
        self.session_start = Some(SystemTime::now());
    }

    pub fn lock(&mut self) {
        if let Some(ref mut key) = self.session_key {
            key.zeroize();
        }
        self.session_key = None;
        self.session_start = None;
        self.credentials.clear();
    }

    pub fn start(&mut self, key: [u8; 32]) {
        self.session_key = Some(zeroize::Zeroizing::new(key));
        self.session_start = Some(SystemTime::now());
    }
}
```

- [ ] **Step 4: Create `vault/provision.rs`** — create a new vault

```rust
use crate::auth::method::AuthMethod;
use crate::crypto::aead;
use super::{storage::VaultStorage, workspace::Workspace, EncryptedVault, VaultData};

pub fn provision(
    storage: &VaultStorage,
    workspace: &mut Workspace,
    key: &[u8; 32],
    method: AuthMethod,
    salt: &str,
) -> Result<(), String> {
    if storage.exists() {
        return Err("Vault already exists".to_string());
    }

    let vault_data = VaultData { entries: Vec::new() };
    let json = serde_json::to_string(&vault_data)
        .map_err(|e| format!("Failed to serialize vault data: {}", e))?;

    let encrypted = aead::encrypt(key, &json)?;

    let vault = EncryptedVault {
        version: "2".to_string(),
        kdf: method.vault_tag().to_string(),
        salt: salt.to_string(),
        data: encrypted,
    };

    storage.write(&vault)?;
    workspace.start(*key);

    Ok(())
}
```

- [ ] **Step 5: Create `vault/access.rs`** — unlock existing vault

```rust
use crate::crypto::aead;
use super::{storage::VaultStorage, workspace::Workspace, VaultData};

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
```

- [ ] **Step 6: Create `vault/rotate.rs`** — re-encrypt

```rust
use crate::auth::method::AuthMethod;
use crate::crypto::aead;
use super::{storage::VaultStorage, workspace::Workspace, EncryptedVault, VaultData};

pub fn rotate(
    storage: &VaultStorage,
    workspace: &mut Workspace,
    new_key: &[u8; 32],
    new_method: AuthMethod,
    new_salt: &str,
) -> Result<(), String> {
    workspace.check_session()?;

    let vault_data = VaultData {
        entries: workspace.credentials.clone(),
    };
    let json = serde_json::to_string(&vault_data)
        .map_err(|e| format!("Failed to serialize vault data: {}", e))?;
    let encrypted = aead::encrypt(new_key, &json)?;

    let vault = EncryptedVault {
        version: "2".to_string(),
        kdf: new_method.vault_tag().to_string(),
        salt: new_salt.to_string(),
        data: encrypted,
    };

    storage.write(&vault)?;
    workspace.start(*new_key);

    Ok(())
}
```

- [ ] **Step 7: Create `vault/entries.rs`** — CRUD

```rust
use super::{workspace::Workspace, storage::VaultStorage, Entry, VaultData, EncryptedVault};
use crate::crypto::aead;

pub fn add(workspace: &mut Workspace, entry: Entry) -> Result<(), String> {
    if !workspace.is_unlocked() {
        return Err("Vault is locked".to_string());
    }
    workspace.credentials.push(entry);
    Ok(())
}

pub fn get_full(workspace: &Workspace, id: &str) -> Result<Entry, String> {
    if !workspace.is_unlocked() {
        return Err("Vault is locked".to_string());
    }
    workspace.credentials.iter()
        .find(|e| e.id == id)
        .cloned()
        .ok_or_else(|| format!("Credential '{}' not found", id))
}

pub fn update(workspace: &mut Workspace, entry: Entry) -> Result<(), String> {
    if !workspace.is_unlocked() {
        return Err("Vault is locked".to_string());
    }
    let idx = workspace.credentials.iter()
        .position(|e| e.id == entry.id)
        .ok_or_else(|| format!("Credential '{}' not found", entry.id))?;
    workspace.credentials[idx] = entry;
    Ok(())
}

pub fn delete(
    workspace: &mut Workspace,
    storage: &VaultStorage,
    id: &str,
) -> Result<(), String> {
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
    let entry = workspace.credentials.iter()
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
    let vault_data = VaultData { entries: workspace.credentials.clone() };
    let json = serde_json::to_string(&vault_data)
        .map_err(|e| format!("Failed to serialize: {}", e))?;
    let encrypted = aead::encrypt(key, &json)?;

    let mut vault = storage.read()?;
    vault.data = encrypted;
    storage.write(&vault)
}
```

- [ ] **Step 8: Create `vault/search.rs`** — fuzzy search

```rust
use fuzzy_matcher::skim::SkimMatcherV2;
use fuzzy_matcher::FuzzyMatcher;
use super::{workspace::Workspace, EntryPreview};

pub fn search(workspace: &mut Workspace, query: &str) -> Result<Vec<EntryPreview>, String> {
    workspace.check_session()?;
    workspace.refresh();

    let matcher = SkimMatcherV2::default();
    let mut scored: Vec<(i64, EntryPreview)> = workspace.credentials.iter()
        .filter_map(|entry| {
            if query.is_empty() {
                return Some((0, entry.clone().into()));
            }
            let t = matcher.fuzzy_match(&entry.title, query).unwrap_or(0);
            let u = matcher.fuzzy_match(&entry.username, query).unwrap_or(0);
            let best = t.max(u);
            if best >= 50 { Some((best, entry.clone().into())) } else { None }
        })
        .collect();

    scored.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(scored.into_iter().map(|(_, p)| p).collect())
}
```

- [ ] **Step 9: Update `lib.rs`** — change existing references. All commands that referenced `vault.some_method()` now call the module-level functions with `vault::storage::VaultStorage` and `vault::workspace::Workspace`.

- [ ] **Step 10: Delete old `vault.rs`**.

- [ ] **Step 11: Verify compilation and all tests pass**

Run: `cargo test -p latch` — Expected: all tests pass.

- [ ] **Step 12: Commit**

```bash
git add frontend/src-tauri/src/vault/ frontend/src-tauri/src/lib.rs
git commit -m "refactor: decompose vault into storage, workspace, provision, access, rotate, entries, search"
```

---

## Task 6: Create Tauri Commands Module + Slim lib.rs

**Files:**
- Create: `frontend/src-tauri/src/commands/mod.rs`
- Create: `frontend/src-tauri/src/commands/vault.rs`
- Create: `frontend/src-tauri/src/commands/credential.rs`
- Create: `frontend/src-tauri/src/commands/generator.rs`
- Create: `frontend/src-tauri/src/commands/health.rs`
- Create: `frontend/src-tauri/src/commands/session.rs`
- Modify: `frontend/src-tauri/src/lib.rs` (remove inline commands, wire up commands module)

- [ ] **Step 1: Create `commands/mod.rs`** with a helper to reduce boilerplate:

```rust
pub mod credential;
pub mod generator;
pub mod health;
pub mod session;
pub mod vault;

use std::sync::{Arc, Mutex};
use crate::vault::{storage::VaultStorage, workspace::Workspace};

pub struct VaultState(pub Arc<Mutex<(VaultStorage, Workspace)>>);

impl VaultState {
    pub fn new(storage: VaultStorage, workspace: Workspace) -> Self {
        Self(Arc::new(Mutex::new((storage, workspace))))
    }

    pub fn lock<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&VaultStorage, &mut Workspace) -> Result<T, String>,
    {
        let mut guard = self.0.lock().map_err(|_| "Vault is temporarily unavailable")?;
        let (ref storage, ref mut workspace) = *guard;
        f(storage, workspace)
    }
}
```

- [ ] **Step 2: Create `commands/vault.rs`** — Provision, Access, Rotate, vault_status, get_vault_auth_method, migrate_to_oauth

Each command uses `VaultState::lock()` instead of the 4-line pattern. Example for Provision:

```rust
#[tauri::command]
pub async fn provision_vault_password(
    password: String,
    state: tauri::State<'_, crate::commands::VaultState>,
) -> Result<String, String> {
    let salt = crate::auth::password::generate_salt();
    let key = crate::auth::password::derive_key(&password, &salt);

    state.lock(|storage, workspace| {
        crate::vault::provision::provision(
            storage,
            workspace,
            &key,
            crate::auth::method::AuthMethod::Password,
            &hex::encode(salt),
        )
    })?;

    Ok(serde_json::json!({"status": "success"}).to_string())
}
```

- [ ] **Step 3: Create `commands/credential.rs`** — search_entries, add_entry, get_full_entry, update_entry, delete_entry, request_secret

- [ ] **Step 4: Create `commands/generator.rs`** — generate_password, analyze_password_strength

- [ ] **Step 5: Create `commands/health.rs`** — check_vault_health

- [ ] **Step 6: Create `commands/session.rs`** — lock_vault, get_auth_preferences

- [ ] **Step 7: Slim `lib.rs`** to ~80 lines — keep only:
  - Module declarations
  - `run()` function with Tauri builder setup
  - `setup_system_tray()`
  - `spawn_session_timer()`
  - `validate_entry_fields()` (or move to `credential.rs`)
  - AuthState for lockout
  - `generate_handler![]` listing all commands from the commands module

- [ ] **Step 8: Verify compilation and all tests**

Run: `cargo build` and `cargo test -p latch` — Expected: compile + all tests pass.

- [ ] **Step 9: Run clippy**

Run: `cargo clippy --all-targets --all-features -- -D warnings` — Expected: no warnings.

- [ ] **Step 10: Commit**

```bash
git add frontend/src-tauri/src/commands/ frontend/src-tauri/src/lib.rs
git commit -m "refactor: extract Tauri commands into commands module, slim lib.rs"
```

---

## Task 7: Install Tailwind v4 + shadcn/ui

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/index.css` (Tailwind entry)
- Modify: `frontend/vite.config.ts` (add Tailwind plugin)
- Modify: `frontend/src/main.tsx` (import index.css instead of styles.css)

- [ ] **Step 1: Install Tailwind v4 + plugins**

```bash
cd frontend
bun add tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Update `vite.config.ts`** to add the Tailwind plugin

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
}));
```

- [ ] **Step 3: Create `frontend/src/index.css`** with Tailwind directives and neo-brutalist design tokens:

```css
@import "tailwindcss";

@theme {
  --color-brutal-black: #000000;
  --color-brutal-white: #ffffff;
  --color-brutal-yellow: #ffd700;
  --color-brutal-red: #ff4444;
  --color-brutal-green: #44ff44;
  --color-brutal-blue: #4444ff;
  --color-brutal-gray: #888888;
  --color-brutal-light: #f5f5f5;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}

* {
  box-sizing: border-box;
}

body {
  font-family: var(--font-mono);
  background-color: var(--color-brutal-black);
  color: var(--color-brutal-white);
  margin: 0;
  padding: 0;
  overflow: hidden;
}
```

- [ ] **Step 4: Update `frontend/src/main.tsx`** — change CSS import from `./styles.css` to `./index.css`

- [ ] **Step 5: Run `bun run dev`** to verify Vite starts without errors

- [ ] **Step 6: Initialize shadcn/ui**

```bash
cd frontend
bunx shadcn@latest init
```

When prompted:
- Style: New York
- Base color: Neutral
- CSS variables: No (we use Tailwind v4)

- [ ] **Step 7: Add shadcn/ui primitives**

```bash
bunx shadcn@latest add button input dialog card badge separator
```

- [ ] **Step 8: Verify components are created in `frontend/src/components/ui/`**

- [ ] **Step 9: Commit**

```bash
git add frontend/package.json frontend/vite.config.ts frontend/src/index.css frontend/src/main.tsx frontend/src/components/ui/
git commit -m "chore: install Tailwind v4 and shadcn/ui primitives"
```

---

## Task 8: Create Frontend API Client + Shared Types

**Files:**
- Create: `frontend/src/api/types.ts`
- Create: `frontend/src/api/client.ts`

- [ ] **Step 1: Create `frontend/src/api/types.ts`** — all shared Zod schemas and inferred TS types:

```typescript
import { z } from 'zod'

export const CredentialSchema = z.object({
  id: z.string(),
  title: z.string(),
  username: z.string(),
  password: z.string(),
  url: z.string().optional(),
  icon_url: z.string().optional(),
})
export type Credential = z.infer<typeof CredentialSchema>

export const CredentialPreviewSchema = CredentialSchema.omit({ password: true })
export type CredentialPreview = z.infer<typeof CredentialPreviewSchema>

export const SuccessResponseSchema = z.object({
  status: z.literal('success'),
  message: z.string().optional(),
})

export const ErrorResponseSchema = z.object({
  status: z.literal('error'),
  message: z.string(),
})

export const ResponseSchema = z.discriminatedUnion('status', [
  SuccessResponseSchema,
  ErrorResponseSchema,
])

export const SecretResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('success'), value: z.string() }),
  z.object({ status: z.literal('error'), message: z.string() }),
])

export const AuthMethodResponseSchema = z.object({
  status: z.string(),
  auth_method: z.string(),
})

export const PasswordOptionsSchema = z.object({
  length: z.number().min(8).max(128),
  uppercase: z.boolean(),
  lowercase: z.boolean(),
  numbers: z.boolean(),
  symbols: z.boolean(),
  exclude_ambiguous: z.boolean(),
})
export type PasswordOptions = z.infer<typeof PasswordOptionsSchema>

export const StrengthReportSchema = z.object({
  score: z.number(),
  entropy: z.number(),
  label: z.string(),
  warnings: z.array(z.string()),
  suggestions: z.array(z.string()),
})
export type StrengthReport = z.infer<typeof StrengthReportSchema>

export const VaultHealthReportSchema = z.object({
  overall_score: z.number(),
  weak_passwords: z.array(z.any()),
  reused_passwords: z.array(z.any()),
  breached_credentials: z.array(z.any()),
  total_entries: z.number(),
  strong_passwords: z.number(),
  average_entropy: z.number(),
})
export type VaultHealthReport = z.infer<typeof VaultHealthReportSchema>
```

- [ ] **Step 2: Create `frontend/src/api/client.ts`** — typed wrapper around Tauri invoke:

```typescript
import { invoke } from '@tauri-apps/api/core'
import {
  CredentialPreviewSchema,
  CredentialSchema,
  SecretResponseSchema,
  ResponseSchema,
  AuthMethodResponseSchema,
  PasswordOptionsSchema,
  StrengthReportSchema,
  VaultHealthReportSchema,
  type Credential,
  type CredentialPreview,
  type PasswordOptions,
  type StrengthReport,
  type VaultHealthReport,
} from './types'

function parse<T>(result: unknown, schema: { parse: (v: unknown) => T }): T {
  return schema.parse(JSON.parse(result as string))
}

export const api = {
  // Vault lifecycle
  async provisionPassword(password: string): Promise<void> {
    const result = await invoke('provision_vault_password', { password })
    parse(result, ResponseSchema)
  },

  async provisionOAuth(idToken: string): Promise<void> {
    const result = await invoke('provision_vault_oauth', { idToken })
    parse(result, ResponseSchema)
  },

  async accessPassword(password: string): Promise<void> {
    const result = await invoke('access_vault_password', { password })
    parse(result, ResponseSchema)
  },

  async accessOAuth(idToken: string): Promise<void> {
    const result = await invoke('access_vault_oauth', { idToken })
    parse(result, ResponseSchema)
  },

  async accessKey(keyHex: string): Promise<void> {
    const result = await invoke('access_vault_key', { keyHex })
    parse(result, ResponseSchema)
  },

  async lockVault(): Promise<void> {
    await invoke('lock_vault')
  },

  async vaultStatus(): Promise<{ has_vault: boolean; is_unlocked: boolean }> {
    const result = await invoke('vault_status')
    return JSON.parse(result as string)
  },

  async getAuthMethod(): Promise<string> {
    const result = await invoke('get_vault_auth_method')
    return AuthMethodResponseSchema.parse(JSON.parse(result as string)).auth_method
  },

  // Credentials
  async searchEntries(query: string): Promise<CredentialPreview[]> {
    const result = await invoke('search_entries', { query })
    return CredentialPreviewSchema.array().parse(JSON.parse(result as string))
  },

  async copyField(entryId: string, field: 'password' | 'username'): Promise<string> {
    const result = await invoke('request_secret', { entryId, field })
    const parsed = SecretResponseSchema.parse(JSON.parse(result as string))
    if (parsed.status === 'success') return parsed.value
    throw new Error(parsed.message)
  },

  async getFullEntry(entryId: string): Promise<Credential> {
    const result = await invoke('get_full_entry', { entryId })
    return CredentialSchema.parse(JSON.parse(result as string))
  },

  async addEntry(entry: {
    title: string; username: string; password: string;
    url?: string; iconUrl?: string;
  }): Promise<string> {
    const result = await invoke('add_entry', entry)
    const parsed = ResponseSchema.parse(JSON.parse(result as string))
    return JSON.parse(result as string).id
  },

  async updateEntry(entry: {
    id: string; title: string; username: string;
    password: string; url?: string; iconUrl?: string;
  }): Promise<void> {
    const result = await invoke('update_entry', entry)
    parse(result, ResponseSchema)
  },

  async deleteEntry(entryId: string): Promise<void> {
    const result = await invoke('delete_entry', { entryId })
    parse(result, ResponseSchema)
  },

  // Password generator
  async generatePassword(options: PasswordOptions): Promise<string> {
    const result = await invoke('generate_password', { options })
    return JSON.parse(result as string).password
  },

  async analyzePassword(password: string): Promise<StrengthReport> {
    const result = await invoke('analyze_password_strength', { password })
    return JSON.parse(result as string).report as StrengthReport
  },

  // Vault health
  async checkVaultHealth(): Promise<VaultHealthReport> {
    const result = await invoke('check_vault_health')
    return VaultHealthReportSchema.parse(JSON.parse(result as string).report)
  },

  // Auth preferences
  async getAuthPreferences(): Promise<{
    auth_method: string; session_valid: boolean; session_remaining_seconds: number
  }> {
    const result = await invoke('get_auth_preferences')
    return JSON.parse(result as string)
  },
}
```

- [ ] **Step 3: Verify typecheck**

Run: `bun run typecheck` — Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/
git commit -m "feat: add typed API client and shared Zod schemas"
```

---

## Task 9: Create useClipboardGuard Hook

**Files:**
- Create: `frontend/src/hooks/useClipboardGuard.ts`

- [ ] **Step 1: Create `useClipboardGuard.ts`**

```typescript
import { useRef, useCallback } from 'react'

const DEFAULT_DURATION_MS = 30_000

export function useClipboardGuard(durationMs: number = DEFAULT_DURATION_MS) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text)

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = window.setTimeout(async () => {
      try {
        const currentText = await navigator.clipboard.readText()
        if (currentText === text) {
          await navigator.clipboard.writeText('')
        }
      } catch {
        // clipboard read may be denied by OS/browser
      }
    }, durationMs)
  }, [durationMs])

  const cancel = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  return { copy, cancel }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `bun run typecheck` — Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useClipboardGuard.ts
git commit -m "feat: add useClipboardGuard hook for 30s clipboard clearing"
```

---

## Task 10: Decompose CommandPalette into Mode Components

**Files:**
- Create: `frontend/src/components/modes/SearchMode.tsx`
- Create: `frontend/src/components/modes/EntryActions.tsx`
- Create: `frontend/src/components/modes/AddCredential.tsx`
- Create: `frontend/src/components/modes/DeleteConfirm.tsx`
- Modify: `frontend/src/components/CommandPalette.tsx` (thin router)
- Update: All mode components use `api/client.ts` instead of bare `invoke`

- [ ] **Step 1: Create `SearchMode.tsx`** — search bar + results list, handles Enter key to transition to actions or add-entry

- [ ] **Step 2: Create `EntryActions.tsx`** — action list for a selected credential (copy password, copy username, edit, delete, back, lock)

- [ ] **Step 3: Create `AddCredential.tsx`** — form for add/edit credential

- [ ] **Step 4: Create `DeleteConfirm.tsx`** — confirmation dialog for deletion

- [ ] **Step 5: Rewrite `CommandPalette.tsx`** as a thin router (~100 lines). Move all inline handlers to their respective mode components. Each mode component receives `onModeChange` and `onCredentialsChanged` callbacks.

- [ ] **Step 6: Update `useSearch.ts`** to use `api.searchEntries()` instead of bare `invoke('search_entries', ...)`

- [ ] **Step 7: Verify typecheck and build**

Run: `bun run typecheck && bun run build` — Expected: no errors, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/modes/ frontend/src/components/CommandPalette.tsx frontend/src/hooks/useSearch.ts
git commit -m "refactor: decompose CommandPalette into mode-specific components"
```

---

## Task 11: Migrate Components to Tailwind + shadcn/ui

**Files:**
- Modify: All components in `frontend/src/components/` (replace className strings with Tailwind classes)
- Modify: `frontend/src/components/palette/PaletteInput.tsx` (use shadcn Input)
- Modify: `frontend/src/components/palette/PaletteList.tsx` (use Tailwind styling)
- Delete: `frontend/src/styles.css` (replaced by index.css + Tailwind)

- [ ] **Step 1: Migrate `PaletteInput.tsx`** to use shadcn Input with neo-brutalist Tailwind classes (thick black border, hard shadow, mono font)

- [ ] **Step 2: Migrate `PaletteList.tsx`** to Tailwind (list items with hover states, selected states, keyboard nav highlighting)

- [ ] **Step 3: Migrate `CommandPalette.tsx`** container to Tailwind (centered card, thick border, shadow)

- [ ] **Step 4: Migrate all mode components** — `SearchMode`, `EntryActions`, `AddCredential`, `DeleteConfirm` — to Tailwind

- [ ] **Step 5: Migrate remaining components** — `AuthSelector`, `OAuthSignIn`, `BiometricSignIn`, `SetupVault`, `UnlockVault`, `MigrateVault`, `Settings`, `PasswordGenerator`, `StrengthMeter`, `VaultHealth`, `ConfirmationModal`, `LockButton`, health sub-components

- [ ] **Step 6: Delete `frontend/src/styles.css`**

- [ ] **Step 7: Verify typecheck and build**

Run: `bun run typecheck && bun run build` — Expected: no errors, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/
git commit -m "refactor: migrate all components to Tailwind v4 + shadcn/ui"
```

---

## Task 12: Final Verification — Full CI Check

- [ ] **Step 1: Rust backend CI checks**

```bash
cd frontend/src-tauri
cargo fmt --all
cargo check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
```

- [ ] **Step 2: Frontend CI checks**

```bash
cd frontend
bun run typecheck
bun run lint
bun run test
bun run build
```

- [ ] **Step 3: Fix any failures until all pass**

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: final CI fixes"
```

---

## Execution Order

Tasks 1 (cleanup), 2 (crypto), 3 (auth), and 4 (breach checker) can run in parallel since they touch independent files.

Tasks 5 (vault decomposition) depends on 2 (crypto).

Task 6 (commands) depends on 3 (auth) and 5 (vault).

Tasks 7 (Tailwind/shadcn install) is independent and can run in parallel with backend work.

Tasks 8 (API client) is independent of backend tasks.

Task 9 (useClipboardGuard) is independent.

Task 10 (CommandPalette decomposition) depends on 8 (API client) and 9 (useClipboardGuard).

Task 11 (Tailwind migration) depends on 7 (Tailwind install) and 10 (component decomposition).

Task 12 (final verification) depends on everything.
