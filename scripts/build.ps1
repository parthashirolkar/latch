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

# Parse build configuration
$ConfigFile = Join-Path $ProjectRoot "build.toml"
if (Test-Path $ConfigFile) {
    Write-Host "✓ Found build.toml" -ForegroundColor Green
} else {
    Write-Host "✗ build.toml not found, using defaults" -ForegroundColor Yellow
}

# Clean build directory if requested
if ($Clean) {
    Write-Host ""
    Write-Host "🧹 Cleaning build directory..." -ForegroundColor Yellow
    if (Test-Path $BuildDir) {
        Remove-Item -Recurse -Force $BuildDir
    }
}
New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null

# Build Python vault-core
Write-Host ""
Write-Host "🐍 Building Python vault-core with Nuitka..." -ForegroundColor Cyan
$PythonDir = Join-Path $ProjectRoot "vault-core"
$PythonBuildDir = Join-Path $PythonDir "build"
$PythonDistDir = Join-Path $PythonDir "dist"

Push-Location $PythonDir

if (Test-Path "pyproject.toml") {
    Write-Host "  Using uv to install Python dependencies" -ForegroundColor Gray
    uv sync
    
    Write-Host "  Building standalone executable with Nuitka..." -ForegroundColor Gray
    
    # Nuitka command to build standalone exe
    $NuitkaCmd = @(
        "uvx --from nuitka nuitka"
        "--standalone"
        "--onefile"
        "--output-dir=dist"
        "latch_vault/main.py"
    ) -join " "
    
    Invoke-Expression $NuitkaCmd
    
    if (Test-Path "$PythonDistDir/main.exe") {
        Copy-Item "$PythonDistDir/main.exe" "$BuildDir/vault-core.exe"
        Write-Host "  ✓ vault-core.exe built successfully" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Nuitka build failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  ⚠️  No pyproject.toml found, skipping Python build" -ForegroundColor Yellow
}

Pop-Location

# Build C# auth-helper
Write-Host ""
Write-Host "🔷 Building C# auth-helper..." -ForegroundColor Cyan
$CSharpDir = Join-Path $ProjectRoot "auth-helper"
$CSharpBuildDir = Join-Path $CSharpDir "bin/Release/net8.0"

Push-Location $CSharpDir

if (Test-Path "*.csproj") {
    Write-Host "  Building self-contained executable..." -ForegroundColor Gray
    
    dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true
    
    if (Test-Path "$CSharpBuildDir/*.exe") {
        Copy-Item "$CSharpBuildDir/*.exe" "$BuildDir/auth-helper.exe"
        Write-Host "  ✓ auth-helper.exe built successfully" -ForegroundColor Green
    } else {
        Write-Host "  ✗ C# build failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  ⚠️  No .csproj found, skipping C# build" -ForegroundColor Yellow
}

Pop-Location

# Build Tauri frontend
Write-Host ""
Write-Host "⚛️  Building Tauri frontend..." -ForegroundColor Cyan
$FrontendDir = Join-Path $ProjectRoot "frontend"

Push-Location $FrontendDir

if (Test-Path "package.json") {
    Write-Host "  Using bun to install dependencies" -ForegroundColor Gray
    bun install
    
    Write-Host "  Building with Tauri..." -ForegroundColor Gray
    
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

# Copy all executables to portable directory
Copy-Item "$BuildDir/vault-core.exe" $PortableDir -ErrorAction SilentlyContinue
Copy-Item "$BuildDir/auth-helper.exe" $PortableDir -ErrorAction SilentlyContinue
Copy-Item "$BuildDir/*.exe" $PortableDir -Exclude "*.nsi" -ErrorAction SilentlyContinue

Compress-Archive -Path "$PortableDir/*" -DestinationPath $ZipPath -Force
Write-Host "  ✓ Portable zip created at: $ZipPath" -ForegroundColor Green

Write-Host ""
Write-Host "✅ Build complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Output directory: $BuildDir" -ForegroundColor Gray
Write-Host "Artifacts:" -ForegroundColor Gray
Get-ChildItem $BuildDir -File | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor White }
