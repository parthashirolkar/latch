param(
    [switch]$SkipCache,
    [switch]$Clean,
    [string]$OutputFormat = $null
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BuildDir = Join-Path $ProjectRoot "dist"

Write-Host "🏗️  Building Latch Password Manager (Windows)" -ForegroundColor Cyan
Write-Host "Project root: $ProjectRoot" -ForegroundColor Gray

# Clean build directory if requested
if ($Clean) {
    Write-Host ""
    Write-Host "🧹 Cleaning build directory..." -ForegroundColor Yellow
    if (Test-Path $BuildDir) {
        Remove-Item -Recurse -Force $BuildDir
    }
}
New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null

# Build Tauri frontend
Write-Host ""
Write-Host "⚛️  Building Tauri frontend..." -ForegroundColor Cyan
$FrontendDir = Join-Path $ProjectRoot "frontend"

Push-Location $FrontendDir

if (Test-Path "package.json") {
    Write-Host "  Using bun to install dependencies" -ForegroundColor Gray
    bun install

    Write-Host "  Building with Tauri..." -ForegroundColor Gray

    if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
        Write-Host "  ✗ Rust/Cargo not found. Please install Rust from: https://rustup.rs" -ForegroundColor Red
        Write-Host "  Run: winget install Rustlang.Rustup" -ForegroundColor Gray
        exit 1
    }

    if (Test-Path "src-tauri") {
        bun run tauri build

        $TauriBuildDir = Join-Path $FrontendDir "src-tauri/target/release/bundle/nsis"
        if (Test-Path "$TauriBuildDir/*.exe") {
            $InstallerPath = Get-ChildItem "$TauriBuildDir/*.exe" | Select-Object -First 1
            Copy-Item $InstallerPath.FullName $BuildDir
            Write-Host "  ✓ Tauri installer built successfully" -ForegroundColor Green
        } else {
            Write-Host "  ✗ Tauri build failed" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  ⚠️  No src-tauri directory found" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠️  No package.json found, skipping Tauri build" -ForegroundColor Yellow
}

Pop-Location

# Create portable zip
Write-Host ""
Write-Host "📦 Creating portable zip..." -ForegroundColor Cyan

$ZipPath = Join-Path $BuildDir "Latch-portable.zip"
$PortableDir = Join-Path $BuildDir "portable"
New-Item -ItemType Directory -Force -Path $PortableDir | Out-Null

$TauriReleaseDir = Join-Path $FrontendDir "src-tauri/target/release"
if (Test-Path "$TauriReleaseDir/Latch.exe") {
    Copy-Item "$TauriReleaseDir/Latch.exe" $PortableDir
}

Compress-Archive -Path "$PortableDir/*" -DestinationPath $ZipPath -Force
Write-Host "  ✓ Portable zip created at: $ZipPath" -ForegroundColor Green

Write-Host ""
Write-Host "✅ Build complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Output directory: $BuildDir" -ForegroundColor Gray
Write-Host "Artifacts:" -ForegroundColor Gray
Get-ChildItem $BuildDir -File | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor White }
