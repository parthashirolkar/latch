#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="${PROJECT_ROOT}/dist"

echo "🏗️  Building Latch Password Manager"
echo "Project root: ${PROJECT_ROOT}"

# Clean and create build directory
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

# Build Tauri frontend
echo ""
echo "⚛️  Building Tauri frontend..."
cd "${PROJECT_ROOT}/frontend"

if [ -f "package.json" ]; then
    echo "  Using bun to install dependencies"
    bun install
    echo "  ✓ Dependencies installed"

    if [ -d "src-tauri" ]; then
        echo "  Building with Tauri..."
        bun run tauri build
        echo "  ✓ Tauri build complete"

        # Copy platform-specific artifacts
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            if [ -d "src-tauri/target/release/bundle/dmg" ]; then
                cp src-tauri/target/release/bundle/dmg/*.app "${BUILD_DIR}/" 2>/dev/null || true
            fi
            if [ -d "src-tauri/target/release/bundle/macos" ]; then
                cp src-tauri/target/release/bundle/macos/*.app "${BUILD_DIR}/" 2>/dev/null || true
            fi
        else
            # Linux
            if [ -d "src-tauri/target/release/bundle/deb" ]; then
                cp src-tauri/target/release/bundle/deb/*.deb "${BUILD_DIR}/" 2>/dev/null || true
            fi
            if [ -d "src-tauri/target/release/bundle/appimage" ]; then
                cp src-tauri/target/release/bundle/appimage/*.AppImage "${BUILD_DIR}/" 2>/dev/null || true
            fi
        fi
    else
        echo "  ⚠️  No src-tauri directory found"
    fi
else
    echo "  ⚠️  No package.json found, skipping build"
fi

echo ""
echo "✅ Build complete!"
echo ""
echo "Output directory: ${BUILD_DIR}"
ls -la "${BUILD_DIR}"
