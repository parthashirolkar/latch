# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

Latch is a secure cross-platform password manager with strict layer separation:

```
[ TypeScript / Tauri / React ]  ← UI Shell (frontend/)
            ↓
[ Python / uv ]                 ← Vault Service (vault-core/)
```

- **Frontend**: Tauri + React + TypeScript UI shell
- **Backend**: Python vault service for crypto, storage, and authentication
- **Communication**: Tauri commands spawn `vault-core` process, JSON over stdin/stdout

### Key Architecture Constraints

1. **Strict Layer Separation**: Frontend handles UI only. Vault Core handles all crypto, storage, and auth. Never blur these boundaries.
2. **Intent-Based Communication**: Frontend uses `invoke('command', { params })`. Secrets are never passed directly between layers.
3. **JSON IPC**: All cross-process communication uses JSON (Python: `json.dumps()`, TS: `JSON.parse()`).
4. **Master Password Security**: Password is never stored. Only used for key derivation via Argon2id KDF.

### Component Interaction Flow

1. Frontend → Tauri command invocation via `invoke()`
2. Tauri → Spawns `vault-core` as external process
3. vault-core → Processes request, returns JSON on stdout
4. Tauri → Parses JSON, returns to Frontend

## Development Commands

### Project Setup
```bash
./scripts/dev.sh           # Install all dependencies, configure environment
```

### Building
```bash
./scripts/build.sh         # Linux/WSL build
.\scripts\build.ps1        # Windows production build
.\scripts\build.ps1 -Clean # Windows clean build
```

Artifacts output to `dist/` (installer + portable zip).

### Frontend (TypeScript/React/Tauri)
```bash
cd frontend
bun run dev                # Development server
bun run build              # Build for production
tsc --noEmit              # Type check only
```

### Vault Core (Python)
```bash
cd vault-core
uv sync                                    # Install dependencies
uv run python -m latch_vault.main          # Run CLI directly
uv add <package>                           # Add dependency
uv run pytest                              # Run all tests
uv run pytest tests/test_crypto.py         # Run single test file
uv run pytest --cov=latch_vault --cov-report=html  # HTML coverage report
```

### Python CLI Commands
```bash
latch-vault init <password>      # Initialize new vault
latch-vault unlock <password>    # Unlock vault
latch-vault lock                 # Lock vault
latch-vault status               # Check vault state
latch-vault search <query>       # Search entries (requires unlock)
latch-vault request-secret <id> <field>  # Copy secret (requires unlock)
```

## Code Style Conventions

### TypeScript/React
- camelCase for variables and functions
- PascalCase for components and types
- Functional components with hooks
- `const [data, setData] = useState<Type[]>([])` for state
- Interfaces for all data structures: `interface Entry { id: string; title: string }`
- CSS: kebab-case, system font stack, `#1a1a1a` dark base
- No inline comments

### Python
- snake_case for variables and functions
- PascalCase for classes
- Type hints required: `def search(query: str) -> list[Entry]:`
- Use pydantic BaseModel for data: `class Entry(BaseModel): id: str; title: str`
- stdout = JSON data, stderr = errors
- Docstrings only, no inline comments
- Exit codes: 0 = success, 1 = failure

### Rust (Tauri)
- `#[tauri::command]` for exported commands
- `fn name(param: String) -> Result<String, String>` signature pattern
- snake_case for variables/functions, PascalCase for types

## Security Implementation

### Key Derivation & Encryption
- **KDF**: Argon2id with memory_cost=65536, time_cost=3, parallelism=4
- **Encryption**: AES-256-GCM with 12-byte nonce
- **Vault Storage**: OS-specific directories encrypted with master password

### Vault Paths (OS-specific)
- Windows: `%APPDATA%\Latch`
- macOS: `~/Library/Application Support/Latch`
- Linux: `~/.config/latch`

### Session Management
- Vault auto-locks after 30 minutes of inactivity
- Session key stored in memory only (never on disk)
- Manual lock always available via LockButton component

### Authentication Flow
1. **Init**: Password → Argon2id KDF → 256-bit key → encrypt empty vault → store
2. **Unlock**: Password + stored salt → Argon2id → decrypt vault → store key in memory
3. **Lock**: Clear session key from memory, vault remains encrypted on disk

## Important Notes

- **No Password Recovery**: Forgotten master password = lost data (by design)
- **Cross-Platform**: Master password and vault work across Windows/macOS/Linux
- **Build Config**: Edit `build.toml` for output formats, bundler settings
