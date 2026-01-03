# AGENTS.md

This file provides guidelines for AI agents working on Latch Password Manager codebase.

## Build, Lint, and Test Commands

### Frontend (TypeScript/React/Tauri)
```bash
cd frontend && bun run dev         # Development server
cd frontend && bun run build        # Build frontend
cd frontend && tsc --noEmit       # Type check
```

### Vault Core (Python)
```bash
cd vault-core && uv sync                        # Install deps
cd vault-core && uv run python -m latch_vault.main  # Run CLI
cd vault-core && uv add <package>                 # Add deps
```

### Auth Helper (C# - Windows only)
```bash
cd auth-helper && dotnet run                            # Dev
cd auth-helper && dotnet build -c Release                 # Build
cd auth-helper && dotnet publish -c Release -r win-x64 --self-contained  # Publish
```

### Full Project
```bash
./scripts/dev.sh         # Dev setup
./scripts/build.sh        # Linux/WSL build
.\scripts\build.ps1       # Windows production build
.\scripts\build.ps1 -Clean   # Clean build
```

## Code Style Guidelines

### Architecture Principles

1. **Strict Layer Separation**: Frontend=UI, Vault Core=crypto/storage, Auth Helper=Windows Hello only
2. **Intent-Based Communication**: Frontend uses `invoke('command', { params })`, never passes secrets directly
3. **JSON IPC**: All cross-process uses JSON (Python: `json.dumps()`, TS: `JSON.parse()`)

### TypeScript/React

**Imports**: Standard lib → third-party → local
```typescript
import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import App from './App'
```

**Components**: Functional with hooks, PascalCase, named exports
```typescript
function MyComponent() { ... }
export default MyComponent
```

**Types**: Interfaces for all data structures
```typescript
interface Entry { id: string; title: string; username: string }
```

**State**: `const [data, setData] = useState<Type[]>([])`
**Error**: `try { await invoke() } catch (e) { console.error(e) }`
**Naming**: camelCase vars/funcs, PascalCase components, className for CSS, no comments
**CSS**: kebab-case, system font stack, #1a1a1a dark base

### Python

**Imports**: Standard lib → third-party → local
```python
import sys
import json
from pydantic import BaseModel
```

**Types**: All functions have hints, use `list[Type]` not `List[Type]`
```python
def search(query: str) -> list[Entry]: ...
```

**Data Models**: Use pydantic BaseModel
```python
class Entry(BaseModel): id: str; title: str
```

**Output**: stdout=JSON data, stderr=errors
```python
print(json.dumps(result))
print("Error", file=sys.stderr)
```

**Error**: `try/except Exception as e: sys.exit(1)`
**Naming**: snake_case vars/funcs, PascalCase classes, `cli()` entry point, `if __name__ == "__main__"`

### Rust (Tauri)

**Imports**: `use std::...; use tauri::command;`
**Commands**: `#[tauri::command] fn name(param: String) -> Result<String, String>`
**Error**: `match { Ok(_) => { if success { Ok(_) } else { Err(_) } } Err(_) => Err(_) }`
**Naming**: snake_case vars/funcs, PascalCase types, `cfg!` for platform code

### C# (Auth Helper)

**Imports**: `using System; using Windows.Security.Credentials.UI;`
**Structure**: Namespace at file level, single class, exit codes 0=success/1=failure
**Error**: `try { } catch (Exception ex) { return 1; }`
**Naming**: PascalCase classes/methods, camelCase params/locals, switch expressions
**Output**: stdout=minimal, stderr=errors

## Conventions Summary

| Language | Vars/Funcs | Classes/Types | Files | Comments |
|-----------|---------------|---------------|--------|----------|
| TypeScript | camelCase | PascalCase | PascalCase | No comments |
| Python | snake_case | PascalCase | snake_case | Docstrings only |
| Rust | snake_case | PascalCase | snake_case | No comments |
| C# | camelCase | PascalCase | PascalCase | No comments |

## Important Notes

1. **Never commit secrets** - Check .gitignore
2. **Security boundaries** - Never blur layer responsibilities
3. **JSON IPC** - All cross-process must be JSON
4. **Exit codes** - 0=success, 1=failure for CLI
5. **Stderr usage** - Errors to stderr, data to stdout
6. **No Windows Hello in WSL** - Only test auth-helper on native Windows
