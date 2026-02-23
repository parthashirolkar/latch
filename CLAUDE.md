# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


**Note**: Do NOT use `bun run dev` - that only starts Vite without Tauri APIs.

#### Frontend (TypeScript)
```bash
cd frontend

# 1. Type check
bun run typecheck
```

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

### Vault Storage
- Windows: `%APPDATA%\Latch\vault.enc`

## Important Notes
- **No Password/Key Recovery**: Lost credentials = lost data (by design)
- **Cross-Platform**: Same vault file works across Windows/macOS/Linux
- **Zero-Knowledge**: For OAuth, only user_id is exposed - Google never sees vault data
- **Dev vs Prod**: OAuth uses fallback secret in dev, requires `LATCH_OAUTH_SECRET` in production
- **System Integration**: App stays running in background (system tray), use global shortcut or tray icon to show
