# AGENTS.md

This file provides guidelines for AI agents working on Latch Password Manager codebase.

## Build, Lint, and Test Commands

### Frontend (TypeScript/React/Tauri)
```bash
cd frontend && bun run tauri dev    # Development server (includes Rust)
cd frontend && bun run build        # Build frontend (Vite only)
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

## Code Style Guidelines

### Architecture Principles

1. **Strict Layer Separation**: Frontend=UI, Rust backend=crypto/storage/auth
2. **Tauri State Pattern**: Vault instance stored in `VaultState(Mutex<Vault>)`, shared via Tauri State
3. **Master Password Security**: Password never stored, only used for key derivation via Argon2id KDF
4. **Session-Only Keys**: Decrypted vault key lives in memory only, cleared on lock or 30min timeout

### TypeScript/React

**Imports**: Standard lib → third-party → local
```typescript
import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import SetupVault from './components/SetupVault'
```

**Components**: Functional with hooks, PascalCase, named exports
```typescript
function MyComponent({ prop }: Props) { ... }
export default MyComponent
```

**Types**: Interfaces for all data structures
```typescript
interface Entry { id: string; title: string; username: string }
interface VaultStatus { status: string; has_vault: boolean; is_unlocked: boolean }
```

**State**: `const [data, setData] = useState<Type[]>([])`
**Error**: `try { await invoke() } catch (error) { console.error('Error:', error) }`
**Naming**: camelCase vars/funcs, PascalCase components, className for CSS
**CSS**: kebab-case, system font stack, #1a1a1a dark base

### Rust (Tauri)

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

## Authentication Flow

### Vault Initialization
1. User sets master password → `invoke('init_vault', { password })`
2. Password → Argon2id KDF → 256-bit encryption key
3. Salt + key encrypts empty vault with AES-256-GCM
4. Encrypted vault stored in OS-specific config directory

### Vault Unlock
1. User enters password → `invoke('unlock_vault', { password })`
2. Password + stored salt → Argon2id → decryption key
3. Key decrypts vault data → session key stored in memory
4. Success: vault accessible; Failure: "Invalid password" error

### Security
- **Key derivation**: Argon2id (memory_cost=65536, time_cost=3, parallelism=4)
- **Encryption**: AES-256-GCM with 12-byte nonce
- **Storage**: Windows: APPDATA/Latch, macOS: ~/Library/Application Support/Latch, Linux: ~/.config/latch
- **Password**: Never stored, only used for key derivation
