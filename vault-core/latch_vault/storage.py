import os
import json
import platform
from pathlib import Path
from typing import Optional, Dict, Any


class VaultStorage:
    def __init__(self):
        self.config_dir = self._get_config_dir()
        self.vault_file = self.config_dir / "vault.enc"
        self.config_dir.mkdir(parents=True, exist_ok=True)

    def _get_config_dir(self) -> Path:
        system = platform.system()
        if system == "Windows":
            appdata = os.environ.get("APPDATA")
            if appdata:
                return Path(appdata) / "Latch"
            local_appdata = os.environ.get("LOCALAPPDATA")
            if local_appdata:
                return Path(local_appdata) / "Latch"
            return Path.home() / ".config" / "latch"
        elif system == "Darwin":
            return Path.home() / "Library" / "Application Support" / "Latch"
        else:
            xdg_config = os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")
            return Path(xdg_config) / "latch"

    def vault_exists(self) -> bool:
        return self.vault_file.exists()

    def create_vault(self, salt: str, encrypted_data: Dict[str, str]) -> None:
        vault_data = {
            "version": "1",
            "kdf": "argon2id",
            "salt": salt,
            "data": encrypted_data,
        }
        with open(self.vault_file, "w") as f:
            json.dump(vault_data, f)

    def read_vault(self) -> Optional[Dict[str, Any]]:
        if not self.vault_exists():
            return None
        with open(self.vault_file, "r") as f:
            return json.load(f)

    def update_vault(self, salt: str, encrypted_data: Dict[str, str]) -> None:
        vault_data = {
            "version": "1",
            "kdf": "argon2id",
            "salt": salt,
            "data": encrypted_data,
        }
        with open(self.vault_file, "w") as f:
            json.dump(vault_data, f)
