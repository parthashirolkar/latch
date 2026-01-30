# AGENTS.md

This file provides guidelines for AI agents working on Latch Password Manager codebase.

## Build, Lint, and Test Commands

### Frontend (TypeScript/React/Tauri v2)
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
5. **Command Palette UI**: Raycast-style single-window interface with mode-based navigation

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

- **Main Component**: `CommandPalette` with modes: `setup`, `locked`, `search`, `actions`, `add-entry`
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
invoke('unlock_vault', { password: string })
invoke('lock_vault')
```

### Entry Operations
```typescript
invoke('search_entries', { query: string }) // Returns EntryPreview[]
invoke('request_secret', { entryId: string, field: string }) // field: 'password' | 'username' | 'url' | 'notes'
invoke('add_entry', { title, username, password, url?, notes? })
```

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
- **Key derivation**: Argon2id (memory_cost=32768, time_cost=2, parallelism=2)
- **Encryption**: AES-256-GCM with 12-byte nonce
- **Storage**: 
  - Windows: `%APPDATA%\Latch` (e.g., `C:\Users\%USERNAME%\AppData\Roaming\Latch`)
  - macOS: `~/Library/Application Support/Latch`
  - Linux: `~/.config/latch`
- **Password**: Never stored, only used for key derivation
