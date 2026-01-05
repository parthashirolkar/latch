@echo off
cd /d "%~dp0\..\..\..\vault-core"
uv run python -m latch_vault.main %*
