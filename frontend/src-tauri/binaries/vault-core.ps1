#!/usr/bin/env pwsh
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VaultCoreDir = Join-Path $ScriptDir "..\..\..\vault-core"
Push-Location $VaultCoreDir
try {
    uv run python -m latch_vault.main @Args
} finally {
    Pop-Location
}
