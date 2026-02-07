# Authentication System Redesign: Parallel OAuth & Biometric Flows

**Status**: Planning Phase  
**Author**: AI Assistant  
**Date**: 2025-02-07  
**Target Branch**: TBD (feature/parallel-auth-flows)

---

## Table of Contents
1. [Current State](#current-state)
2. [Problem Statement](#problem-statement)
3. [Vision](#vision)
4. [Technical Implementation Plan](#technical-implementation-plan)
5. [Security Considerations](#security-considerations)
6. [Migration Strategy](#migration-strategy)
7. [Testing Plan](#testing-plan)
8. [Rollout Checklist](#rollout-checklist)

---

## Current State

### Existing Authentication Architecture

**Current Implementation (OAuth-first with Biometric Convenience):**

1. **OAuth Flow**:
   - User signs in with Google OAuth
   - Backend: `vault.init_with_oauth(user_id)` derives encryption key from Google user_id via PBKDF2
   - Vault metadata stores `kdf: "oauth-pbkdf2"` and `salt: user_id`
   - Session: `session_key` stored in memory, 30-minute timeout

2. **Biometric Flow (Convenience Layer)**:
   - Requires vault to be unlocked via OAuth FIRST
   - User enables biometric in Settings
   - `enable_biometric_unlock()` extracts `vault.get_encryption_key()` (256-bit session key)
   - Key stored in `BiometricState.vault_key: Option<[u8; 32]>` (in-memory only, NOT persisted)
   - On unlock: `unlock_with_biometric_key()` uses cached key to decrypt vault
   - Biometric key CLEARED on vault lock

3. **Key Files**:
   - `frontend/src-tauri/src/vault.rs` (394 lines): Vault struct, encryption logic, OAuth key derivation
   - `frontend/src-tauri/src/biometric.rs` (34 lines): BiometricState, temporary key caching
   - `frontend/src-tauri/src/lib.rs` (340 lines): Tauri commands, state management
   - `frontend/src/components/OAuthSignIn.tsx` (132 lines): OAuth + biometric UI
   - `frontend/src/components/CommandPalette.tsx` (623 lines): Main app flow, modes
   - `frontend/src/components/Settings.tsx` (199 lines): Auth preferences UI

### Current Problems

1. **Tight Coupling**: Biometric is a convenience layer ON TOP of OAuth, not an independent auth method
2. **Awkward UX**: Users must use OAuth first, then opt-in to biometric convenience
3. **Vault Dependency**: Biometric-only users cannot exist; vault is always encrypted with OAuth-derived keys
4. **Key Management**: Biometric key is ephemeral (cleared on lock), not persisted
5. **No Method Switching**: Cannot switch from OAuth to Biometric or vice versa without re-encrypting vault manually

---

## Problem Statement

The current authentication system forces users into an OAuth-first workflow with biometric as an optional add-on. This creates friction for users who prefer biometric-only authentication and makes the biometric feature feel like an afterthought rather than a first-class authentication method.

**User Experience Issues:**
- New users must create Google OAuth vault before biometric is even available
- Biometric unlock button only appears AFTER OAuth setup AND successful login
- Switching authentication methods requires manual vault re-encryption
- UI shows biometric as "secondary" to OAuth

---

## Vision

### Goal: Parallel, Independent Authentication Methods

**Core Principles:**
1. **Choice at Setup**: Users pick OAuth OR Biometric during first-time setup
2. **Independent Flows**: Each method is a complete, standalone authentication path
3. **Single Active Method**: Vault configured with ONE auth method at a time
4. **Seamless Switching**: Users can switch methods in Settings with guided flow
5. **No Recovery**: Lost access to chosen method = lost vault (by design, local-first security)

### User Flow Examples

**Scenario A: OAuth User**
1. Launch app → Sees "Sign in with Google" button ONLY
2. Click → Google OAuth popup → authorize → vault unlocked
3. Settings shows "Current method: Google OAuth" with "Switch to Biometric" option

**Scenario B: Biometric User**
1. Launch app → Sees "Unlock with Windows Hello" button ONLY
2. Click → Windows Hello prompt → authenticate → vault unlocked
3. Settings shows "Current method: Windows Hello" with "Switch to Google OAuth" option

**Scenario C: Switching OAuth → Biometric**
1. User in Settings, clicks "Switch to Biometric"
2. App: Locks vault, prompts "Unlock with Google to continue" (OAuth auth)
3. User: Authorizes with Google, vault temporarily unlocked
4. App: "Set up Windows Hello" → Windows Hello prompt
5. App: Re-encrypts vault with biometric key
6. App: "Switch complete!" → unlocks vault with new method
7. Next launch: Shows biometric button only

**Scenario D: Switching Biometric → OAuth**
1. User in Settings, clicks "Switch to Google OAuth"
2. App: Locks vault, prompts "Authenticate with Windows Hello to continue" (Biometric auth)
3. User: Windows Hello prompt, vault temporarily unlocked
4. App: "Sign in with Google" → Google OAuth popup
5. App: Re-encrypts vault with OAuth-derived key
6. App: "Switch complete!" → unlocks vault with new method
7. Next launch: Shows OAuth button only

---

## Technical Implementation Plan

### Phase 1: Vault Metadata & Storage Changes

**Objective**: Enable vault to track and support both authentication methods independently.

#### 1.1 Update Vault Metadata Structure

**File**: `frontend/src-tauri/src/vault.rs`

**Changes**:
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptedVault {
    pub version: String,
    pub kdf: String,  // Now: "oauth-pbkdf2" | "biometric-aes256"
    pub salt: String,  // OAuth: user_id, Biometric: hex-encoded public key
    pub data: EncryptedData,
}
```

**New KDF Types**:
- `"oauth-pbkdf2"`: OAuth-derived key (existing)
- `"biometric-aes256"`: Biometric-protected key (new)

#### 1.2 Implement Biometric Key Generation & Storage

**File**: `frontend/src-tauri/src/biometric.rs` (expand from 34 lines ~100 lines)

**New Functions**:
```rust
// Generate biometric-protected key pair
pub fn generate_biometric_key() -> Result<[u8; 32], String> {
    // Generate 256-bit random key
    // Use Windows Hello / Touch ID / Android Biometric to encrypt key
    // Return encrypted key blob
}

// Decrypt biometric key (called during unlock)
pub fn decrypt_biometric_key(encrypted_key: &[u8]) -> Result<[u8; 32], String> {
    // Use biometric prompt to decrypt key blob
    // Return raw 256-bit encryption key
}

// Check if vault is biometric-encrypted
pub fn is_vault_biometric(vault: &Vault) -> bool {
    // Read vault file, check kdf == "biometric-aes256"
}
```

**Key Storage Strategy**:
- Biometric key encrypted by platform secure enclave (Windows Hello/Touch ID)
- Encrypted key blob stored in `vault.salt` field (hex-encoded)
- Raw vault encryption key NEVER stored, only derived via biometric auth

#### 1.3 Add Vault Initialization Methods

**File**: `frontend/src-tauri/src/vault.rs`

**New Methods**:
```rust
impl Vault {
    // OAuth init (existing, renamed)
    pub fn init_with_oauth(&mut self, user_id: &str) -> Result<(), String> { ... }

    // Biometric init (NEW)
    pub fn init_with_biometric(&mut self) -> Result<(), String> {
        // 1. Generate biometric-protected key
        let encrypted_key = generate_biometric_key()?;
        
        // 2. Generate vault encryption key
        // Option A: Derive from biometric key (reproducible)
        // Option B: Random, then encrypted with biometric key
        
        // 3. Create empty vault with biometric key
        // 4. Store encrypted key in vault.salt
    }

    // Get current auth method
    pub fn get_auth_method(&self) -> Option<String> {
        // Read vault file, return kdf field
    }
}
```

---

### Phase 2: Tauri Commands (Backend)

**File**: `frontend/src-tauri/src/lib.rs`

#### 2.1 New Commands

```rust
// Biometric-only vault initialization
#[tauri::command]
async fn init_vault_biometric(
    state: State<'_, VaultState>
) -> Result<String, String> {
    let vault = &mut state.0.lock().unwrap();
    vault.init_with_biometric()?;
    Ok(json!({"status": "success"}).to_string())
}

// Biometric-only vault unlock
#[tauri::command]
async fn unlock_vault_biometric(
    state: State<'_, VaultState>
) -> Result<String, String> {
    let vault = &mut state.0.lock().unwrap();
    
    // Check if vault is biometric
    if vault.get_auth_method() != Some("biometric-aes256".to_string()) {
        return Err("Vault is not configured for biometric authentication".to_string());
    }
    
    // Decrypt biometric key
    let encrypted_key = vault.get_biometric_key_blob()?; // Read from salt
    let vault_key = decrypt_biometric_key(&encrypted_key)?;
    
    // Unlock vault
    vault.unlock_with_key(&vault_key)?;
    
    Ok(json!({"status": "success"}).to_string())
}

// Switch auth method (OAuth → Biometric)
#[tauri::command]
async fn switch_to_biometric(
    state: State<'_, VaultState>
) -> Result<String, String> {
    let vault = &mut state.0.lock().unwrap();
    
    // 1. Ensure vault is unlocked (authenticated with current method)
    if !vault.is_unlocked() {
        return Err("Vault must be unlocked before switching authentication methods".to_string());
    }
    
    // 2. Get current vault encryption key
    let current_key = vault.get_encryption_key()?;
    
    // 3. Generate new biometric key
    let new_biometric_blob = generate_biometric_key()?;
    
    // 4. Re-encrypt vault with new key
    // (This requires decrypting with current key, encrypting with new key)
    
    // 5. Update vault metadata: kdf = "biometric-aes256", salt = new_biometric_blob
    
    Ok(json!({"status": "success"}).to_string())
}

// Switch auth method (Biometric → OAuth)
#[tauri::command]
async fn switch_to_oauth(
    id_token: String,
    state: State<'_, VaultState>
) -> Result<String, String> {
    // Similar flow: vault unlocked → derive OAuth key → re-encrypt → update metadata
}

// Get vault auth method
#[tauri::command]
async fn get_vault_auth_method(
    state: State<'_, VaultState>
) -> Result<String, String> {
    let vault = state.0.lock().unwrap();
    let method = vault.get_auth_method().unwrap_or("none".to_string());
    
    Ok(json!({
        "status": "success",
        "auth_method": method  // "oauth-pbkdf2" | "biometric-aes256" | "none"
    }).to_string())
}
```

#### 2.2 Updated Commands

```rust
// Update get_auth_preferences to include auth_method
#[tauri::command]
async fn get_auth_preferences(
    state: State<'_, VaultState>,
) -> Result<String, String> {
    let vault = state.0.lock().unwrap();
    let auth_method = vault.get_auth_method().unwrap_or("none".to_string());
    let is_unlocked = vault.is_unlocked();
    
    Ok(json!({
        "status": "success",
        "auth_method": auth_method,
        "session_valid": is_unlocked,
        "session_remaining_seconds": 0  // Deprecated for OAuth
    }).to_string())
}
```

---

### Phase 3: Frontend Components

#### 3.1 New Component: `AuthSelector.tsx`

**File**: `frontend/src/components/AuthSelector.tsx` (NEW, ~150 lines)

**Purpose**: Setup screen with two side-by-side auth options

**Props**:
```typescript
interface AuthSelectorProps {
  mode: 'setup'
  onOAuthSelect: () => void
  onBiometricSelect: () => void
}
```

**UI Structure**:
```
┌─────────────────────────────────────────────┐
│         Welcome to Latch                     │
│   Choose your authentication method:        │
│                                             │
│  ┌──────────────────────┐  ┌──────────────┐│
│  │   Sign in with       │  │  Use Windows ││
│  │     Google           │  │     Hello    ││
│  │                      │  │              ││
│  │   [Chrome icon]      │  │[Fingerprint]││
│  └──────────────────────┘  └──────────────┘│
│                                             │
│  Your vault will be encrypted and stored    │
│  locally on this device. No backup available.│
└─────────────────────────────────────────────┘
```

#### 3.2 Updated Component: `BiometricSignIn.tsx` (NEW)

**File**: `frontend/src/components/BiometricSignIn.tsx` (~100 lines)

**Purpose**: Biometric-only authentication flow

**Props**:
```typescript
interface BiometricSignInProps {
  mode: 'setup' | 'login'
  onSuccess: () => void
  onError?: (error: string) => void
}
```

**UI Structure**:
```
┌─────────────────────────────────────────────┐
│  Setup: "Use Windows Hello"                 │
│  Login: "Unlock Latch"                       │
│                                             │
│  [Unlock with Biometric]                    │
│  (Fingerprint icon + "Authenticate...")     │
│                                             │
│  Your vault is protected by Windows Hello   │
└─────────────────────────────────────────────┘
```

#### 3.3 Updated Component: `OAuthSignIn.tsx`

**File**: `frontend/src/components/OAuthSignIn.tsx` (MODIFY)

**Changes**:
- Remove `biometricEnabled` prop (no longer shows biometric button)
- Remove biometric button from UI (lines 82-106)
- Keep only "Sign in with Google" button
- Simplify logic (no biometric conditional rendering)

#### 3.4 Updated Component: `Settings.tsx`

**File**: `frontend/src/components/Settings.tsx` (MODIFY)

**Changes**:
- Add `authMethod` state (fetched from `get_vault_auth_method`)
- Display current method: "Authentication: Google OAuth" or "Authentication: Windows Hello"
- Add "Switch to [other method]" button
- Implement switching flow:

```typescript
const handleSwitchAuthMethod = async () => {
  // 1. Lock vault
  await invoke('lock_vault')
  
  // 2. Prompt for current method auth
  if (currentMethod === 'oauth-pbkdf2') {
    // Show OAuthSignIn in "switch" mode
    setSwitchMode('oauth-authenticate')
  } else {
    // Show BiometricSignIn in "switch" mode
    setSwitchMode('biometric-authenticate')
  }
  
  // 3. After current auth succeeds, prompt for NEW method setup
  // 4. Call switch_to_biometric or switch_to_oauth
  // 5. Unlock vault with new method
}
```

#### 3.5 Updated Component: `CommandPalette.tsx`

**File**: `frontend/src/components/CommandPalette.tsx` (MODIFY)

**Changes**:
- Add new mode: `'auth-selector'` for setup screen
- Update `'oauth-setup'` mode: route to `auth-selector` first
- Add new mode: `'biometric-setup'` for biometric-only setup
- Add new mode: `'biometric-login'` for biometric-only unlock
- Update `'oauth-login'` to check vault auth method first

**Mode Flow**:
```typescript
// App startup
useEffect(() => {
  const checkVault = async () => {
    const status = await invoke('vault_status')
    
    if (!status.has_vault) {
      setMode('auth-selector')  // NEW: Show both options
    } else if (!status.is_unlocked) {
      // Check which auth method
      const auth = await invoke('get_vault_auth_method')
      
      if (auth.auth_method === 'oauth-pbkdf2') {
        setMode('oauth-login')
      } else if (auth.auth_method === 'biometric-aes256') {
        setMode('biometric-login')  // NEW: Biometric-only
      }
    }
  }
}, [])
```

**Render Logic** (lines 504-617):
```typescript
{mode === 'auth-selector' && (
  <AuthSelector 
    onOAuthSelect={() => setMode('oauth-setup')}
    onBiometricSelect={() => setMode('biometric-setup')}
  />
)}

{mode === 'biometric-setup' && (
  <BiometricSignIn 
    mode="setup" 
    onSuccess={handleBiometricSuccess} 
  />
)}

{mode === 'biometric-login' && (
  <BiometricSignIn 
    mode="login" 
    onSuccess={handleBiometricSuccess} 
  />
)}

{mode === 'oauth-setup' && (
  <OAuthSignIn 
    mode="setup" 
    onSuccess={handleOAuthSuccess} 
  />
)}

{mode === 'oauth-login' && (
  <OAuthSignIn 
    mode="login" 
    onSuccess={handleOAuthSuccess} 
  />
)}
```

---

### Phase 4: Biometric Plugin Integration

**Current Plugin**: `@choochmeque/tauri-plugin-biometry-api`

**Required Capabilities**:
1. **Key Generation**: Generate random key protected by biometric auth
2. **Key Storage**: Store encrypted key in platform secure enclave
3. **Key Decryption**: Prompt for biometric auth to decrypt key
4. **Key Deletion**: Clear key when switching auth methods

**API Methods Needed**:
```typescript
import { authenticate, generateKey, getKey, deleteKey } from '@choochmeque/tauri-plugin-biometry-api'

// During biometric setup
const encryptedKey = await generateKey({
  prompt: 'Set up Windows Hello for Latch',
  keyData: random256BitKey
})

// During biometric unlock
const decryptedKey = await getKey({
  prompt: 'Unlock Latch'
})

// When switching away from biometric
await deleteKey()
```

**Note**: Verify plugin supports these operations. May need alternative if current plugin is insufficient.

---

## Security Considerations

### Key Management

**OAuth Flow** (Existing):
- Encryption key derived from Google `user_id` via PBKDF2
- Salt stored in `vault.salt` (hex-encoded user_id)
- Key derivation reproducible (same user_id = same key)

**Biometric Flow** (New):
- Vault encryption key randomly generated (256-bit)
- Key encrypted by platform secure enclave (Windows Hello/Touch ID)
- Encrypted key blob stored in `vault.salt`
- Raw encryption key NEVER persisted, only derived via biometric prompt
- If secure enclave is cleared, vault is permanently inaccessible

### Attack Vector Analysis

**OAuth Risks**:
- ✅ Google account compromise → attacker can derive vault key
- ✅ No offline protection (Google auth requires internet)

**Biometric Risks**:
- ✅ Device theft + biometric spoof (harder than password theft)
- ✅ Secure enclave wipe → vault lost (by design)
- ✅ No cross-device sync

**Mitigation**:
- Vault encrypted with AES-256-GCM (authenticated encryption)
- 30-minute session timeout (same for both methods)
- Lock vault when app hidden/closed
- No backup/recovery (accept as tradeoff for simplicity)

### Data-at-Rest Encryption

Both methods use identical encryption:
- Algorithm: AES-256-GCM
- Nonce: 12-byte random (per encryption)
- Key derivation: 
  - OAuth: PBKDF2-HMAC-SHA256 (user_id as salt)
  - Biometric: Random 256-bit key, encrypted by secure enclave
- Vault format unchanged (compatible with existing vaults)

---

## Migration Strategy

### Existing Users (OAuth-only vaults)

**No migration needed!**
- Existing vaults with `kdf: "oauth-pbkdf2"` continue working
- Users can opt-in to biometric via Settings → "Switch to Biometric"
- Switching flow handles re-encryption transparently

### New Users

- See `AuthSelector` on first launch
- Choose OAuth OR Biometric
- Vault created with chosen method
- Can switch anytime in Settings

### Rollback Plan

If critical bugs found:
1. Revert to OAuth-only flow (hide biometric option)
2. Keep vault metadata changes backward compatible
3. Users on biometric can switch back to OAuth

---

## Testing Plan

### Unit Tests (Rust)

**File**: `frontend/src-tauri/src/vault.rs` tests

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_init_vault_biometric() {
        let mut vault = Vault::new().unwrap();
        assert!(!vault.vault_exists());
        
        vault.init_with_biometric().unwrap();
        assert!(vault.vault_exists());
        assert_eq!(vault.get_auth_method(), Some("biometric-aes256".to_string()));
    }
    
    #[test]
    fn test_unlock_vault_biometric() {
        let mut vault = Vault::new().unwrap();
        vault.init_with_biometric().unwrap();
        
        vault.unlock_with_biometric().unwrap();
        assert!(vault.is_unlocked());
    }
    
    #[test]
    fn test_switch_oauth_to_biometric() {
        let mut vault = Vault::new().unwrap();
        vault.init_with_oauth("test_user").unwrap();
        vault.unlock_with_oauth("test_user").unwrap();
        
        vault.switch_to_biometric().unwrap();
        assert_eq!(vault.get_auth_method(), Some("biometric-aes256".to_string()));
    }
    
    #[test]
    fn test_switch_biometric_to_oauth() {
        let mut vault = Vault::new().unwrap();
        vault.init_with_biometric().unwrap();
        vault.unlock_with_biometric().unwrap();
        
        vault.switch_to_oauth("test_user").unwrap();
        assert_eq!(vault.get_auth_method(), Some("oauth-pbkdf2".to_string()));
    }
}
```

### Integration Tests (Tauri Commands)

**Test Cases**:
1. Create vault with OAuth → verify `kdf` field
2. Create vault with Biometric → verify `kdf` field
3. Unlock OAuth vault with correct token → success
4. Unlock OAuth vault with wrong token → failure
5. Unlock Biometric vault with Windows Hello → success
6. Switch OAuth → Biometric → verify vault unlockable with new method
7. Switch Biometric → OAuth → verify vault unlockable with new method
8. Switch methods without vault unlocked → error

### E2E Tests (Frontend)

**Manual Test Scenarios**:
1. Fresh install → see auth selector → choose OAuth → vault created
2. Fresh install → see auth selector → choose Biometric → vault created
3. OAuth user unlock → see only Google button
4. Biometric user unlock → see only biometric button
5. Settings: OAuth user → click "Switch to Biometric" → follow flow → vault switches
6. Settings: Biometric user → click "Switch to OAuth" → follow flow → vault switches
7. Biometric user: Break Windows Hello (disable in settings) → attempt unlock → failure (expected)
8. OAuth user: Lock vault → attempt biometric unlock → error "Vault not configured for biometric"

### Platform Testing

- **Windows 10/11**: Windows Hello (fingerprint, face recognition)
- **macOS**: Touch ID (if plugin supports)
- **Android**: Fingerprint/Face unlock (if plugin supports)

---

## Rollout Checklist

### Pre-Implementation
- [ ] Verify `@choochmeque/tauri-plugin-biometry-api` supports key generation/storage
- [ ] Research alternative biometric plugins if current one insufficient
- [ ] Document vault file format changes (backward compatible?)
- [ ] Create feature branch from `main`

### Implementation
- [ ] Phase 1: Vault metadata changes (Rust)
  - [ ] Update `EncryptedVault` struct
  - [ ] Implement `generate_biometric_key()`, `decrypt_biometric_key()`
  - [ ] Add `init_with_biometric()`, `get_auth_method()` to Vault
  - [ ] Write unit tests
- [ ] Phase 2: Tauri commands (Rust)
  - [ ] `init_vault_biometric`, `unlock_vault_biometric`
  - [ ] `switch_to_biometric`, `switch_to_oauth`
  - [ ] `get_vault_auth_method`
  - [ ] Update `get_auth_preferences`
  - [ ] Write integration tests
- [ ] Phase 3: Frontend components (TypeScript/React)
  - [ ] Create `AuthSelector.tsx`
  - [ ] Create `BiometricSignIn.tsx`
  - [ ] Update `OAuthSignIn.tsx` (remove biometric button)
  - [ ] Update `Settings.tsx` (add switching UI)
  - [ ] Update `CommandPalette.tsx` (new modes)
- [ ] Phase 4: Biometric plugin integration
  - [ ] Test key generation/decryption on Windows
  - [ ] Test secure enclave storage
  - [ ] Handle plugin errors gracefully

### Testing
- [ ] Run Rust unit tests: `cargo test`
- [ ] Run TypeScript typecheck: `bun run typecheck`
- [ ] Run E2E tests on Windows with Windows Hello
- [ ] Test switching OAuth ↔ Biometric multiple times
- [ ] Test edge cases (biometric disabled, wrong account, etc.)
- [ ] Run CI: `act -j backend --container-architecture linux/amd64`
- [ ] Run CI: `act -j frontend --container-architecture linux/amd64`

### Documentation
- [ ] Update AGENTS.md with new auth flow
- [ ] Update README.md (if user-facing docs exist)
- [ ] Document vault file format
- [ ] Create migration guide for existing users (if needed)

### Deployment
- [ ] Create pull request with comprehensive description
- [ ] Peer review (security focus)
- [ ] Merge to `main`
- [ ] Tag release (e.g., `v2.0.0-auth-redesign`)
- [ ] Monitor for bug reports
- [ ] Prepare rollback plan if critical issues found

---

## Open Questions & Risks

### Questions
1. **Biometric Plugin Capabilities**: Does `@choochmeque/tauri-plugin-biometry-api` support persistent key storage, or only transient authentication? If only transient, we need a different approach (e.g., platform keyring).
2. **Key Rotation**: If biometric key is corrupted/lost, is vault permanently inaccessible? (Yes, by design, but need to communicate to users clearly).
3. **Cross-Platform**: Does biometric flow work identically on Windows, macOS, Android, iOS? If not, fallback to OAuth?

### Risks
1. **Plugin Dependency**: Third-party biometric plugin may be abandoned or have bugs
   - **Mitigation**: Evaluate plugin quality, consider forking or writing own plugin
2. **User Data Loss**: Users who switch to biometric then lose device access lose vault
   - **Mitigation**: Clear warnings in UI, "No backup available" message
3. **Platform Differences**: Windows Hello, Touch ID, Android Biometric have different APIs
   - **Mitigation**: Abstraction layer in Rust, fallback to OAuth if biometric unavailable
4. **Migration Complexity**: Switching auth methods requires unlocking vault first, then re-encrypting
   - **Mitigation**: Guided flow in Settings, clear error messages if steps fail

---

## Success Metrics

**Functional Requirements**:
- [ ] New users can create OAuth-only vault
- [ ] New users can create Biometric-only vault
- [ ] Existing OAuth users unaffected
- [ ] Users can switch between methods seamlessly
- [ ] Vault encryption strength unchanged (AES-256-GCM)
- [ ] Session timeout works for both methods (30 minutes)

**UX Requirements**:
- [ ] Setup screen shows both options clearly
- [ ] Unlock screen shows ONLY active method
- [ ] Switching flow is intuitive (max 3-4 steps)
- [ ] Error messages are clear and actionable
- [ ] No performance regression (unlock time < 2 seconds)

**Security Requirements**:
- [ ] No encryption keys stored in plaintext
- [ ] Biometric keys protected by platform secure enclave
- [ ] OAuth keys derived via PBKDF2 (no weaker KDF)
- [ ] Vault file format backward compatible
- [ ] No auth bypass vulnerabilities

---

## Timeline Estimate

**Phase 1 (Vault & Backend)**: 6-8 hours
- Vault metadata changes: 2h
- Biometric key generation/decryption: 3h
- Tauri commands: 2h
- Testing: 1h

**Phase 2 (Frontend Components)**: 8-10 hours
- AuthSelector component: 2h
- BiometricSignIn component: 3h
- Settings updates: 2h
- CommandPalette updates: 2h
- Testing: 1h

**Phase 3 (Integration & Polish)**: 4-6 hours
- Plugin integration testing: 2h
- E2E testing: 2h
- Bug fixes: 2h

**Total**: ~18-24 hours of development work

---

## Next Steps

1. **Peer Review**: Share this document with team for feedback
2. **Plugin Research**: Verify biometric plugin capabilities before starting
3. **Prototype**: Build minimal biometric key generation proof-of-concept
4. **Approval**: Get sign-off on architecture and security approach
5. **Implementation**: Start with Phase 1 (Backend changes)

---

**Document Version**: 1.0  
**Last Updated**: 2025-02-07  
**Status**: Ready for Peer Review
