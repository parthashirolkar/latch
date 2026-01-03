#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="${PROJECT_ROOT}/dist"

echo "🏗️  Building Latch Password Manager"
echo "Project root: ${PROJECT_ROOT}"

# Parse build configuration
if [ -f "${PROJECT_ROOT}/build.toml" ]; then
    echo "✓ Found build.toml"
else
    echo "✗ build.toml not found, using defaults"
fi

# Clean and create build directory
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

# Build Python vault-core
echo ""
echo "🐍 Building Python vault-core..."
cd "${PROJECT_ROOT}/vault-core"

if [ -f "pyproject.toml" ]; then
    echo "  Using uv to build Python component"
    uv sync
    echo "  ✓ Python dependencies installed"
    echo "  ⚠️  Note: Full exe build requires Windows. In WSL, Python scripts will be used."
else
    echo "  ⚠️  No pyproject.toml found, skipping Python build"
fi

# Build C# auth-helper (Windows only)
echo ""
echo "🔷 C# auth-helper build skipped (Windows only)"

# Build Tauri frontend
echo ""
echo "⚛️  Building Tauri frontend..."
cd "${PROJECT_ROOT}/frontend"

if [ -f "package.json" ]; then
    echo "  Using bun to install dependencies"
    bun install
    echo "  ✓ Dependencies installed"
    
    if [ -d "src-tauri" ]; then
        echo "  ✓ Tauri project found"
        echo "  ⚠️  Note: Full Tauri build requires Windows. In WSL, dev mode only."
        echo "  To build for Windows, run build.ps1 on Windows."
    else
        echo "  ⚠️  No src-tauri directory found"
    fi
else
    echo "  ⚠️  No package.json found, skipping Tauri build"
fi

echo ""
echo "✅ WSL development setup complete!"
echo ""
echo "Next steps:"
echo "  1. Copy project to Windows filesystem"
echo "  2. On Windows, run: scripts\\build.ps1"
echo "  3. Or run: scripts\\dev.ps1 for development mode"
