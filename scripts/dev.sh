#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Setting up Latch development environment"
echo "Project root: ${PROJECT_ROOT}"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check bun
if ! command -v bun &> /dev/null; then
    echo "  ✗ bun not found. Install from: https://bun.sh"
    echo "    curl -fsSL https://bun.sh/install | bash"
    exit 1
fi
echo "  ✓ bun installed"

# Check node
if ! command -v node &> /dev/null; then
    echo "  ✗ node not found. Install from: https://nodejs.org"
    exit 1
fi
echo "  ✓ node installed"

# Check cargo
if ! command -v cargo &> /dev/null; then
    echo "  ✗ cargo not found. Install Rust from: https://rustup.rs"
    echo "    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi
echo "  ✓ Rust/Cargo installed"

echo ""

# Setup Tauri frontend
echo "⚛️  Setting up Tauri frontend..."
cd "${PROJECT_ROOT}/frontend"

if [ -f "package.json" ]; then
    bun install
    echo "  ✓ Bun dependencies installed"
else
    echo "  ⚠️  No package.json found, skipping frontend setup"
fi

echo ""
echo "✅ Development environment setup complete!"
echo ""
echo "Development commands:"
echo "  cd frontend && bun run dev    → Start development server"
echo ""
echo "Build commands:"
echo "  scripts/build.sh              → Build for current platform"
echo "  scripts/build.ps1             → Build Windows installer (run on Windows)"
