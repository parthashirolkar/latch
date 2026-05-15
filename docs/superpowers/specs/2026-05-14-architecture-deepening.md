# Codebase Architecture Deepening

> **Date:** 2026-05-14
> **Status:** Approved

## Goal

Restructure Latch Password Manager's Rust backend and TypeScript frontend to fix scattered code, shallow modules, and monolithic files. Replace the custom CSS with Tailwind v4 + shadcn/ui. Clean up unwanted files.

## Domain Language

See `CONTEXT.md` for the full glossary. Key renames:
- **Entry** → **Credential** (Rust struct, TypeScript type, filenames)
- **vault init** → **Provision**
- **vault unlock** → **Access**
- **vault reencrypt** → **Rotate**
- **AuthMethod** is a domain enum (`Password`, `OAuth`, `Biometric`), not KDF string tags

## Rust Backend Restructuring

### Current Problems
- `lib.rs` (844 lines): app setup + 24 Tauri commands + auth rate limiting + session timer + tray + shortcuts. No internal seams.
- `vault.rs` (610 lines): crypto + file I/O + session management + entry CRUD + fuzzy search + auth methods. Three responsibilities tangled.
- `vault_health.rs` (309 lines): HTTP client constructed inline, no test seam for breach checking.
- Flat module structure with no subdirectories.

### Target Structure
```
src/
  main.rs
  lib.rs                           (~80 lines — app setup, tray, shortcuts, plugins)
  auth/
    mod.rs, method.rs              (AuthMethod enum, KDF mappings)
    lockout.rs                     (AuthAttemptState, exponential backoff)
    password.rs                    (PBKDF2 derivation, salt gen — moved from src/password.rs)
    oauth.rs                       (JWT decode, Argon2id derivation — moved from src/oauth.rs)
  crypto/
    mod.rs, aead.rs                (encrypt_data, decrypt_data — pure functions)
  vault/
    mod.rs, storage.rs             (atomic file I/O, vault path)
    workspace.rs                   (in-memory credentials + session key)
    provision.rs                   (create new Vault)
    access.rs                      (unlock existing Vault)
    rotate.rs                      (re-encrypt)
    entries.rs                     (CRUD on credentials)
    search.rs                      (fuzzy search)
  vault_health/
    mod.rs, audit.rs               (weak/reused/breached detection)
    breach_checker.rs              (BreachChecker trait + PwnedPasswordsApi adapter)
  commands/
    mod.rs, vault.rs, credential.rs, generator.rs, health.rs, session.rs
```

### Key Design Decisions
- `crypto/aead.rs` has zero filesystem dependency. Tests run without disk setup.
- `vault/storage.rs` owns atomic tmp+rename pattern. Only file I/O lives here.
- `vault/workspace.rs` holds session key (zeroize on drop) and credentials vec.
- `breach_checker.rs` trait allows offline testing with a stub adapter.
- `commands/` are thin wrappers. Mutex lock boilerplate is centralized in `commands/mod.rs`.

## TypeScript Frontend Restructuring

### Current Problems
- `CommandPalette.tsx` (699 lines): 18-mode state machine with inline invoke, JSON.parse, Zod, clipboard logic, form state.
- Every component calls `invoke` directly with inline Zod parsing.
- Schemas duplicated across files (EntrySchema in CommandPalette, EntryPreviewSchema in useSearch).
- `styles.css` is 2,779 lines of monolithic custom CSS.

### Target Structure
```
src/
  api/
    client.ts                      (typed Tauri invoke wrapper)
    types.ts                       (shared Zod schemas + inferred TS types)
  hooks/
    useClipboardGuard.ts           (copy + 30s auto-clear)
    useSearch.ts, useDebounce.ts, useKeyboardNav.ts, useKeyboardShortcuts.ts, useTheme.ts, useWindowAutoResize.ts
  components/
    palette/
      CommandPalette.tsx           (~100 lines — thin mode router)
      PaletteInput.tsx, PaletteList.tsx, PaletteFooter.tsx
    modes/
      SearchMode.tsx, EntryActions.tsx, AddCredential.tsx, DeleteConfirm.tsx,
      PasswordGenerator.tsx, VaultHealth.tsx, Settings.tsx, HealthLists.tsx,
      AuthSelector.tsx, OAuthSignIn.tsx, BiometricSignIn.tsx, MigrateVault.tsx
    ui/                            (shadcn/ui primitives)
    StrengthMeter.tsx, LockButton.tsx, ConfirmationModal.tsx, ErrorBoundary.tsx
```

### Key Design Decisions
- `api/client.ts` exposes typed functions. Components never call invoke, JSON.parse, or Zod directly.
- `api/types.ts` centralizes all Zod schemas. TS types are derived via `z.infer<>` — no dual maintenance.
- `CommandPalette.tsx` becomes a thin mode router: `const Component = MODE_COMPONENTS[mode]`.
- shadcn/ui components provide Button, Input, Dialog, Card, Badge primitives.
- Tailwind v4 preserves the neo-brutalist aesthetic via config (thick borders, hard shadows, bold typography).
- Bun as package manager, Vite 7 as bundler. Bun-native bundling is deferred to a future pass.

## File Cleanup

Delete: `.cursorignore`, `GEMINI.md`, `CLAUDE.md`, `.agent/skills/`, `dist/`. Add `dist/` to `.gitignore`.

## ADRs

- `docs/adr/0001-aes-256-gcm.md` — Why AES-GCM over XChaCha20-Poly1305.
- `docs/adr/0002-kdf-per-auth-method.md` — Why different KDFs per AuthMethod.

## Out of Scope

- Bun-native bundling (deferred)
- Cloud sync / remote storage backend
- Import/export features
