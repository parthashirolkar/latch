# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

Latch is a secure cross-platform password manager built with Tauri and Rust:

```
[ TypeScript / React ]  ← UI Shell (frontend/src/)
            ↓
[ Rust / Tauri ]        ← Vault Service (frontend/src-tauri/src/)
```

- **Frontend**: React + TypeScript UI that calls Tauri commands
- **Backend**: Pure Rust vault module for crypto, storage, and session management
- **Communication**: In-memory via Tauri State, no IPC/process spawning

### Key Architecture Constraints

1. **Layer Separation**: Frontend handles UI only. All crypto operations happen in Rust via the `Vault` struct.
2. **State Management**: Vault instance stored in `VaultState(Mutex<Vault>)` and shared across all Tauri commands.
3. **Master Password Security**: Password is never stored. Only used for key derivation via Argon2id KDF.
4. **Session-Only Keys**: Decrypted vault key lives in memory only, cleared on lock or after 30min timeout.

### Component Interaction Flow

1. Frontend → Tauri command invocation via `invoke('command_name', { params })`
2. Tauri command handler → Acquires lock on `VaultState`
3. Vault method → Performs crypto/storage operation
4. Result → Serialized to JSON, returned to frontend

## Development Commands

### Initial Setup
```bash
./scripts/dev.sh           # Install dependencies (bun, check cargo)
```

**Note**: Do NOT use `bun run dev` - that only starts Vite without Tauri APIs.

### Building
```bash
./scripts/build.sh         # Linux/macOS build
.\scripts\build.ps1        # Windows production build
```

Artifacts output to `dist/`.

### Type Checking
```bash
cd frontend
bun run typecheck         # TypeScript type check only
```

## Code Structure

### Frontend (TypeScript/React)
- **`App.tsx`**: Main component, handles vault state and routing between SetupVault/UnlockVault/Dashboard
- **`components/SetupVault.tsx`**: Initial vault creation form
- **`components/UnlockVault.tsx`**: Vault unlock form
- **`components/LockButton.tsx`**: Manual vault lock button

### Backend (Rust - `frontend/src-tauri/src/`)
- **`lib.rs`**: Tauri command handlers (`init_vault`, `unlock_vault`, `lock_vault`, `vault_status`, `search_entries`, `request_secret`)
- **`vault.rs`**: Core vault implementation
  - `Vault` struct: Manages entries, session key, vault file
  - `Entry` struct: Password entry with id, title, username, password, url, notes
  - `EntryPreview` struct: Search results (id, title, username only)
  - Key derivation: Argon2id (m=65536, t=3, p=4)
  - Encryption: AES-256-GCM with 12-byte nonce

### Tauri Command Pattern
All commands follow this pattern:
```rust
#[tauri::command]
async fn command_name(param: String, state: State<'_, VaultState>) -> Result<String, String> {
    let vault = &mut state.0.lock().unwrap();
    let result = vault.method_name(&param)?;
    Ok(json!({"status": "success", ...}).to_string())
}
```

Response format must include `status` field (typically `"success"`) for frontend compatibility.

## Code Style Conventions

### TypeScript/React
- camelCase for variables and functions
- PascalCase for components and types
- Functional components with hooks
- `const [data, setData] = useState<Type[]>([])` for state
- Interfaces for all data structures
- Use `invoke()` from `@tauri-apps/api/core` for all backend calls

### Rust
- `#[tauri::command]` for exported commands
- `async fn name(param: String, state: State<'_, VaultState>) -> Result<String, String>`
- `?` operator for error propagation
- `json!()` macro for JSON responses
- Return `Err(String)` for all error cases

## Security Implementation

### Key Derivation & Encryption
- **KDF**: Argon2id with memory_cost=65536, time_cost=3, parallelism=4
- **Encryption**: AES-256-GCM with 12-byte nonce
- **Salt**: Random 16-byte salt generated on vault init, stored with vault

### Vault Storage (OS-specific)
- Windows: `%APPDATA%\Latch\vault.enc`
- macOS: `~/Library/Application Support/Latch/vault.enc`
- Linux: `~/.config/latch/vault.enc`

Vault file format:
```json
{
  "version": "1",
  "kdf": "argon2id",
  "salt": "<hex-encoded salt>",
  "data": {
    "nonce": "<hex-encoded nonce>",
    "ciphertext": "<hex-encoded encrypted vault data>"
  }
}
```

### Session Management
- Session timeout: 30 minutes of inactivity
- Session key stored as `Option<[u8; 32]>` in memory
- `check_session()` validates timeout before operations
- `refresh_session()` updates `session_start` timestamp

### Authentication Flow
1. **Init**: Password → Argon2id KDF → 256-bit key → encrypt empty vault → write to disk
2. **Unlock**: Password + stored salt → Argon2id → decrypt vault → store key in memory
3. **Lock**: Clear `session_key`, `session_start`, and `entries` from memory

## Important Notes

- **No Password Recovery**: Forgotten master password = lost data (by design)
- **Cross-Platform**: Same vault file works across Windows/macOS/Linux
- **DO NOT** run:
```bash
cd frontend
bun run tauri dev         # Starts Vite + Tauri app with Rust backend
```
unless explicitly asked.