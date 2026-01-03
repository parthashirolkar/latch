# Latch Password Manager

A secure password manager built with a multi-layered architecture.

## Architecture

```
[ TypeScript / Tauri / React ]  ← UI Shell
            ↓
[ Python / uv ]                 ← Vault Service (Crypto, Storage, Policies)
            ↓
[ C# / .NET 8 ]                 ← Auth Broker (Windows Hello)
```

## Prerequisites

### Development
- **Python 3.12+** with [uv](https://github.com/astral-sh/uv)
- **Bun** for frontend dependencies
- **.NET 8 SDK** (for auth-helper on Windows)
- **Rust + Cargo** (for Tauri)

### Production
- Windows 10/11 for Windows Hello integration

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

This prepares dependencies but does not build Windows executables (requires Windows).

### Windows (Production)

```powershell
.\scripts\build.ps1
```

This builds:
- Python vault-core → `vault-core.exe` (Nuitka)
- C# auth-helper → `auth-helper.exe` (self-contained)
- Tauri frontend → Installer + portable zip

Artifacts are output to `dist/`.

## Python Dependencies (vault-core)

Run in `vault-core/`:

```bash
uv sync
```

You'll need to add these packages (or your preferred alternatives):

- `cryptography` - Crypto operations
- `pydantic` - Data validation
- `sqlalchemy` - Database ORM (if using SQLite)

Add with:
```bash
uv add cryptography pydantic sqlalchemy
```

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

### Auth Helper (Windows only)

```bash
cd auth-helper
dotnet run
```

## CI/CD

Builds are triggered on:
- Push to `main` branch
- Pull requests merged to `main`

GitHub Actions will:
- Build all components on Windows
- Cache dependencies for faster builds
- Upload artifacts (installer + portable zip)
- Retain artifacts for 7 days

## Project Structure

```
latch/
├── frontend/          # Tauri + React + TypeScript UI
│   ├── package.json
│   └── src/
├── vault-core/        # Python vault service
│   ├── pyproject.toml
│   └── latch_vault/
│       └── main.py
├── auth-helper/       # C# Windows Hello auth
│   ├── auth-helper.csproj
│   └── Program.cs
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

## License

TBD
