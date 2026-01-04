@echo off
rem Dev-mode wrapper for vault-core Python backend
rem This allows running without Nuitka bundling for faster development

setlocal

rem Get the directory of this script
set "SCRIPT_DIR=%~dp0"

rem Navigate to vault-core directory (3 levels up from binaries/)
cd /d "%SCRIPT_DIR%..\..\..\vault-core"

rem Run Python module via uv
uv run python -m latch_vault.main %*
