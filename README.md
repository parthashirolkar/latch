# Latch Password Manager

A secure password manager built with a multi-layered architecture.

## Architecture

```
[ TypeScript / Tauri / React ]  ← UI Shell
            ↓
[ Python / uv ]                 ← Vault Service (Crypto, Storage, Auth)
```

## Features

- **Master Password Authentication**: Secure Argon2id key derivation with AES-256-GCM encryption
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Session Management**: Automatic 30-minute vault lock after inactivity
- **Local Storage**: Vault stored encrypted in OS-specific directories
- **Zero-Knowledge**: Master password never stored, only used for key derivation

## Prerequisites

### Development
- **Python 3.12+** with [uv](https://github.com/astral-sh/uv)
- **Bun** for frontend dependencies
- **Rust + Cargo** (for Tauri)

### Production
- Works on Windows 10/11, macOS 10.15+, and Linux

## Development Setup

Run the setup script to configure your environment:

```bash
./scripts/dev.sh
```

This will:
- Install Python dependencies with `uv`
- Install frontend dependencies with `bun`
- Check for required tooling

## Building

### Linux/WSL (Development)

```bash
./scripts/build.sh
```

### Windows (Production)

```powershell
.\scripts\build.ps1
```

This builds:
- Python vault-core → `vault-core.exe` (Nuitka)
- Tauri frontend → Installer + portable zip

### macOS (Production)

```bash
./scripts/build.sh
```

Artifacts are output to `dist/`.

## Python Dependencies (vault-core)

Run in `vault-core/`:

```bash
uv sync
```

Current dependencies:
- `argon2-cffi` - Password-based key derivation
- `cryptography` - AES-256-GCM encryption
- `pydantic` - Data validation

## Running Components

### Frontend (Development)

```bash
cd frontend
bun run dev
```

### Vault Core

```bash
cd vault-core
uv run python -m latch_vault.main
```

Available commands:
- `init <password>` - Initialize new vault with master password
- `unlock <password>` - Unlock vault with master password
- `lock` - Lock vault (clear session from memory)
- `status` - Check if vault is initialized and unlocked
- `search <query>` - Search for entries (requires unlock)
- `request-secret <id> <field>` - Copy secret from entry (requires unlock)

## CI/CD

Builds are triggered on:
- Push to `main` branch
- Pull requests merged to `main`

GitHub Actions will:
- Build all components
- Cache dependencies for faster builds
- Upload artifacts (installer + portable zip)
- Retain artifacts for 7 days

## Project Structure

```
latch/
├── frontend/          # Tauri + React + TypeScript UI
│   ├── package.json
│   └── src/
│       ├── components/
│       │   ├── SetupVault.tsx
│       │   ├── UnlockVault.tsx
│       │   └── LockButton.tsx
│       └── App.tsx
├── vault-core/        # Python vault service
│   ├── pyproject.toml
│   ├── latch_vault/
│   │   ├── main.py     # CLI commands and session management
│   │   ├── crypto.py   # Argon2id KDF and AES-256-GCM
│   │   └── storage.py  # Vault storage with OS-specific paths
│   └── tests/          # Unit tests
├── scripts/
│   ├── build.sh       # Linux/WSL build
│   ├── build.ps1      # Windows production build
│   └── dev.sh         # Development setup
├── .github/
│   └── workflows/
│       └── build.yml  # GitHub Actions CI
└── build.toml         # Build configuration
```

## Configuration

Edit `build.toml` to adjust:
- Output formats (installer/zip/both)
- Python bundler (Nuitka)
- Component build settings

## Security

### Encryption
- **Key Derivation**: Argon2id with memory_cost=65536, time_cost=3, parallelism=4
- **Encryption**: AES-256-GCM with 12-byte nonce
- **Vault Storage**: OS-specific directories encrypted with master password

### Session Management
- Vault automatically locks after 30 minutes of inactivity
- Session key stored in memory only (never on disk)
- Manual lock via lock button available at any time

### Important Notes
- **Forgotten Password**: There is no password recovery. If you forget your master password, your vault data cannot be recovered.
- **Password Strength**: Choose a strong master password. It is the only key to your vault.

## License

TBD
