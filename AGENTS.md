# AGENTS.md

This file provides guidelines for AI agents working on Latch Password Manager codebase.

## Build, Lint, and Test Commands

### Frontend (TypeScript/React/Tauri)
```bash
cd frontend && bun run dev         # Development server
cd frontend && bun run build        # Build frontend
cd frontend && bun run typecheck    # TypeScript type check
cd frontend && bun run tauri dev    # Tauri development mode (includes Rust)
cd frontend/src-tauri && cargo check    # Rust compilation check
```

### Vault Core (Python)
```bash
cd vault-core && uv sync                    # Install deps
cd vault-core && uv run python -m latch_vault.main  # Run CLI
cd vault-core && uv run pytest              # Run all tests
cd vault-core && uv run pytest -k test_cli_status  # Run single test
cd vault-core && uv run pytest --cov=latch_vault  # Coverage report
cd vault-core && uv run pytest tests/test_main.py::test_cli_init  # Specific test
```

### Full Project
```bash
./scripts/dev.sh         # Dev setup
./scripts/build.sh        # Linux/WSL build
.\scripts\build.ps1       # Windows production build
```

## Code Style Guidelines

### Architecture Principles

1. **Strict Layer Separation**: Frontend=UI, Vault Core=crypto/storage/auth
2. **Intent-Based Communication**: Frontend uses `invoke('command', { params })`, never passes secrets directly
3. **JSON IPC**: All cross-process uses JSON (Python: `json.dumps()`, TS: `JSON.parse()`)
4. **Master Password Security**: Password never stored, only derived keys via Argon2id KDF

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

### Python

**Imports**: Standard lib → third-party → local
```python
import sys
import json
from typing import Optional
from pydantic import BaseModel
from latch_vault.crypto import derive_key
```

**Types**: All functions have hints, use `list[Type]` not `List[Type]`
```python
def search(query: str) -> list[Entry]: ...
```

**Data Models**: Use pydantic BaseModel
```python
class Entry(BaseModel): id: str; title: str
class VaultStatus(BaseModel): status: str; has_vault: bool
```

**Output**: stdout=JSON data, stderr=errors
```python
print(json.dumps(result))
print("Error message", file=sys.stderr)
sys.exit(1)
```

**Error**: `try/except Exception as e: sys.exit(1)`
**Naming**: snake_case vars/funcs, PascalCase classes, `cli()` entry point

### Rust (Tauri)

**Imports**: `use tauri_plugin_shell::ShellExt; use tauri::command;`
**Commands**: `#[tauri::command] async fn name(param: String, app: tauri::AppHandle) -> Result<String, String>`
**Sidecar Pattern**: Use `app.shell().sidecar("vault-core")` NOT `std::process::Command`
**Error**: `.map_err()`, `.await` for async, check `output.status.success()`
**Naming**: snake_case vars/funcs, PascalCase types, `cfg!` for platform code

## Conventions Summary

| Language | Vars/Funcs | Classes/Types | Files | Comments |
|-----------|---------------|---------------|--------|----------|
| TypeScript | camelCase | PascalCase | PascalCase | No comments |
| Python | snake_case | PascalCase | snake_case | Docstrings only |
| Rust | snake_case | PascalCase | snake_case | No comments |

## Important Notes

1. **Never commit secrets** - Check .gitignore
2. **Security boundaries** - Never blur layer responsibilities
3. **JSON IPC** - All cross-process must be JSON
4. **Exit codes** - 0=success, 1=failure for CLI
5. **Stderr usage** - Errors to stderr, data to stdout
6. **Session management** - Vault auto-locks after 30 minutes
7. **Tauri sidecars** - Always use `app.shell().sidecar()` to invoke vault-core
8. **Dev mode** - Python wrappers use `uv run python` for faster development

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
