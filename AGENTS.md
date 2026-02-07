# AGENTS.md

This file provides guidelines for AI agents working on Latch Password Manager codebase.

## Build, Lint, and Test Commands

### Frontend (TypeScript/React/Tauri v2)
```bash
cd frontend && bun run tauri dev    # Development server (includes Rust)
cd frontend && bun run build        # Build frontend (Vite only), NEVER run this unless prompted otherwise.
cd frontend && bun run typecheck    # TypeScript type check
cd frontend/src-tauri && cargo check   # Rust compilation check
cd frontend/src-tauri && cargo test     # Run Rust tests
cd frontend/src-tauri && cargo test vault::tests::test_name  # Run single test
```

### Full Project
```bash
./scripts/dev.sh         # Dev setup (install deps, check prereqs)
./scripts/build.sh        # Linux/macOS production build
.\scripts\build.ps1       # Windows production build
```

**Note**: Do NOT use `bun run dev` - only starts Vite without Tauri APIs. Use `bun run tauri dev`.

### CI/CD Local Testing
**Before pushing any feature, run GitHub Actions locally to ensure CI passes:**
```bash
act -j frontend --container-architecture linux/amd64 -P ubuntu-latest=catthehacker/ubuntu:act-latest
act -j backend --container-architecture linux/amd64 -P ubuntu-latest=catthehacker/ubuntu:act-latest
act --container-architecture linux/amd64 -P ubuntu-latest=catthehacker/ubuntu:act-latest
```

**Available jobs:**
- `frontend`: TypeScript typecheck, ESLint, and Vite build
- `backend`: Rust fmt check, compile check, tests, and clippy
- `cargo-audit`: Security vulnerability scan (runs automatically in full workflow)

**Best practice**: Run `act` before pushing to catch CI failures early and avoid round-trip debugging.

### Pre-PR CI Preparation Checklist

**MANDATORY: Run these commands before creating any PR to ensure CI passes:**

#### Backend (Rust)
```bash
cd frontend/src-tauri

# 1. Format code (CI will fail if not formatted)
cargo fmt --all

# 2. Check compilation
cargo check

# 3. Run clippy with strict warnings (CI uses: -D warnings)
cargo clippy --all-targets --all-features -- -D warnings

# 4. Run all tests
cargo test
```

#### Frontend (TypeScript)
```bash
cd frontend

# 1. Type check
bun run typecheck

# 2. Build (catches import errors, missing deps)
bun run build
```

#### Full CI Verification (Recommended)
```bash
# Run complete CI suite locally with act (requires Docker)
act --container-architecture linux/amd64 -P ubuntu-latest=catthehacker/ubuntu:act-latest
```

**Common CI Failures to Avoid:**
- ❌ `cargo fmt` not run → Formatting errors
- ❌ Dead code (unused functions/variables) → Clippy `-D warnings` fails
- ❌ Missing `mut` or extra `mut` → Compiler errors
- ❌ Import errors → TypeScript build fails
- ❌ Test failures → `cargo test` fails

**Rule of Thumb**: If any command above fails locally, the CI will fail. Fix it before pushing.

## Code Style Guidelines

### Architecture Principles

1. **Strict Layer Separation**: Frontend=UI, Rust backend=crypto/storage/auth
2. **Tauri State Pattern**: Vault instance stored in `VaultState(Mutex<Vault>)`, shared via Tauri State
3. **Auth Method Flexibility**: Support multiple auth methods (OAuth, Biometric) with method switching
4. **Master Password Security**: For biometric vaults, key stored in OS keychain (Windows Credential Manager/macOS Keychain); for OAuth, derived from Google user_id
5. **Session-Only Keys**: Decrypted vault key lives in memory only, cleared on lock or 30min timeout
6. **Command Palette UI**: Raycast-style single-window interface with mode-based navigation

### TypeScript/React

**Imports**: Standard lib → third-party → local
```typescript
import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import CommandPalette from './components/CommandPalette'
```

**Components**: Functional with hooks, PascalCase, named exports
```typescript
function MyComponent({ prop }: Props) { ... }
export default MyComponent
```

**Types**: Interfaces for all data structures
```typescript
interface Entry { id: string; title: string; username: string }
interface EntryPreview { id: string; title: string; username: string }
interface VaultStatus { has_vault: boolean; is_unlocked: boolean }
```

**State**: `const [data, setData] = useState<Type[]>([])`
**Error**: `try { const result = await invoke(); const response = JSON.parse(result as string) } catch (error) { console.error('Error:', error) }`
**Naming**: camelCase vars/funcs, PascalCase components, className for CSS
**CSS**: CSS variables, electric green accent (#00ff9d), system font stack

### Rust (Tauri v2)

**Imports**: `use tauri::{State, Manager}; use serde_json::json; use std::sync::Mutex;`
**Commands**: `#[tauri::command] async fn name(param: String, state: State<'_, VaultState>) -> Result<String, String>`
**State Pattern**: Acquire lock on VaultState before operations
```rust
#[tauri::command]
async fn command_name(param: String, state: State<'_, VaultState>) -> Result<String, String> {
    let vault = &mut state.0.lock().unwrap();
    let result = vault.method(&param)?;
    Ok(json!({"status": "success"}).to_string())
}
```
**Error**: `.map_err()`, `?` operator for propagation, return `Err(String)`
**Naming**: snake_case vars/funcs, PascalCase types, `cfg!` for platform code
**Module Structure**: `lib.rs` contains commands and setup, `main.rs` calls `lib.rs::run()`, `vault.rs` contains Vault implementation

## Conventions Summary

| Language | Vars/Funcs | Classes/Types | Files | Comments |
|-----------|---------------|---------------|--------|----------|
| TypeScript | camelCase | PascalCase | PascalCase | No comments |
| Rust | snake_case | PascalCase | snake_case | No comments |

## Important Notes

1. **Never commit secrets** - Check .gitignore
2. **No sidecars** - Use Tauri State, not `app.shell().sidecar()`
3. **Status field** - JSON responses must include `status: "success"`
4. **Session management** - Vault auto-locks after 30 minutes
5. **No password recovery** - Forgotten master password = lost data (by design)
6. **Cross-platform** - Vault file format identical across Windows/macOS/Linux

## UI Architecture

### Command Palette Pattern
The app uses a Raycast-style single-window command palette interface with mode-based navigation:

- **Main Component**: `CommandPalette` with modes: `auth-selector`, `oauth-login`, `biometric-login`, `biometric-setup`, `search`, `actions`, `add-entry`
- **Sub-Components**:
  - `PaletteInput`: Reusable input field with icon support
  - `PaletteList`: Scrollable list with keyboard navigation
  - `PaletteActions`: Action menu for entry operations
  - `useKeyboardNav`: Custom hook for arrow key + Enter/Esc handling

### Window Behavior
- **Size**: 640x88 (auto-expands based on content)
- **Close**: Hides window instead of closing (Alt+Space or tray to show)
- **Always on Top**: Enabled for quick access
- **Decorations**: None (custom frameless UI)
- **Global Shortcut**: Alt+Space to show/focus window

### System Tray
- Menu items: "Show Latch", "Quit"
- Icon: Uses default window icon (password.ico)

## Available Tauri Commands

### Vault Management
```typescript
invoke('vault_status') // Returns { has_vault: boolean, is_unlocked: boolean }
invoke('init_vault', { password: string })
invoke('init_vault_with_key', { keyHex: string, kdf: string })  // For OAuth/biometric flows
invoke('unlock_vault', { password: string })
invoke('unlock_vault_with_key', { keyHex: string })  // For OAuth/biometric flows
invoke('lock_vault')
invoke('get_vault_auth_method') // Returns 'oauth-pbkdf2' | 'biometric-keychain' | 'none'
invoke('reencrypt_vault', { newKeyHex: string, newKdf: string, newSalt: string }) // Switch auth methods
```

### Entry Operations
```typescript
invoke('search_entries', { query: string }) // Returns EntryPreview[]
invoke('request_secret', { entryId: string, field: string }) // field: 'password' | 'username' | 'url' | 'notes'
invoke('add_entry', { title, username, password, url?, notes? })
```

## Authentication Flow

### First-Time Setup (Auth Selection)
1. New user → AuthSelector shows OAuth and Biometric options
2. OAuth path: Google Sign-In → derive key from user_id → `invoke('init_vault_with_key', { keyHex, kdf: 'oauth-pbkdf2' })`
3. Biometric path: Generate random key → biometric prompt → store in OS keychain → `invoke('init_vault_with_key', { keyHex, kdf: 'biometric-keychain' })`

### Vault Unlock (OAuth)
1. User clicks "Sign in with Google" → OAuth flow
2. Google returns user_id → derive key → `invoke('unlock_vault_with_key', { keyHex })`
3. Key decrypts vault data → session key stored in memory

### Vault Unlock (Biometric)
1. User clicks "Unlock with Biometric" → `getData()` triggers OS biometric prompt
2. OS returns stored key from keychain → `invoke('unlock_vault_with_key', { keyHex })`
3. Key decrypts vault data → session key stored in memory

### Auth Method Switching
1. User opens Settings → current method displayed
2. User chooses to switch → confirmation dialog
3. If switching to Biometric: generate new key → store in keychain → `invoke('reencrypt_vault', { newKeyHex, newKdf: 'biometric-keychain', newSalt: '' })`
4. If switching to OAuth: Google sign-in → derive key → `invoke('reencrypt_vault', { newKeyHex, newKdf: 'oauth-pbkdf2', newSalt: userId })` → clear stored key

### Security
- **Key derivation (OAuth)**: Argon2id (memory_cost=32768, time_cost=2, parallelism=2) with Google user_id as salt
- **Key generation (Biometric)**: cryptographically secure random 256-bit key, stored in OS keychain with biometric protection
- **Encryption**: AES-256-GCM with 12-byte nonce
- **Storage**: 
  - Windows: `%APPDATA%\Latch` (e.g., `C:\Users\%USERNAME%\AppData\Roaming\Latch`)
  - macOS: `~/Library/Application Support/Latch`
  - Linux: `~/.config/latch`
- **Biometric key storage**: Windows Credential Manager / macOS Keychain / Android Keystore
- **Atomic writes**: Vault updates written to temp file then renamed to prevent corruption
