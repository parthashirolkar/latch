# Latch Password Manager

A secure cross-platform password manager built with Tauri and Rust.

## Architecture

```mermaid
graph TD
    A[TypeScript / React] -->|UI| B[Rust / Tauri]
    B -->|Vault Service| C[Crypto]
    B -->|Vault Service| D[Storage]
    B -->|Vault Service| E[Auth]
    style A fill:#61dafb
    style B fill:#dea584
    style C fill:#f9f9f9
    style D fill:#f9f9f9
    style E fill:#f9f9f9
```

## Features

- **Master Password Authentication**: Secure Argon2id key derivation with AES-256-GCM encryption
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Session Management**: Automatic 30-minute vault lock after inactivity
- **Local Storage**: Vault stored encrypted in OS-specific directories
- **Zero-Knowledge**: Master password never stored, only used for key derivation

## Prerequisites

- **Bun** for frontend dependencies
- **Rust + Cargo** (for Tauri)

## Development Setup

```bash
./scripts/dev.sh
```

## Building

### Windows

```powershell
.\scripts\build.ps1
```

### Linux/macOS

```bash
./scripts/build.sh
```

Artifacts are output to `dist/`.

## Running

```bash
cd frontend
bun run tauri dev
```

## Project Structure

```
latch/
├── frontend/          # Tauri + React + TypeScript UI
│   ├── src/
│   │   ├── components/
│   │   └── App.tsx
│   └── src-tauri/
│       ├── src/
│       │   ├── lib.rs      # Tauri commands
│       │   └── vault.rs    # Vault implementation
│       └── Cargo.toml
├── scripts/
│   ├── build.sh       # Linux/macOS build
│   ├── build.ps1      # Windows build
│   └── dev.sh         # Development setup
└── build.toml         # Build configuration
```

## Security

### Encryption
- **Key Derivation**: Argon2id with m=65536, t=3, p=4
- **Encryption**: AES-256-GCM with 12-byte nonce
- **Vault Storage**: OS-specific directories encrypted with master password

### Session Management
- Vault automatically locks after 30 minutes of inactivity
- Session key stored in memory only (never on disk)

### Important Notes
- **No Password Recovery**: Forgotten master password = lost data

## License

TBD
