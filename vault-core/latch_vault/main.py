import sys
import json
import os
import time
from typing import Optional
from pydantic import BaseModel
from latch_vault.crypto import derive_key, encrypt_data, decrypt_data
from latch_vault.storage import VaultStorage


class EntryPreview(BaseModel):
    id: str
    title: str
    username: str


storage = VaultStorage()
session_key: Optional[bytes] = None
session_start_time: Optional[float] = None
SESSION_TIMEOUT_MINUTES = 30


class SessionError(Exception):
    pass


def check_session() -> None:
    global session_key, session_start_time

    if session_key is None:
        raise SessionError("Vault is locked")

    if session_start_time is None:
        raise SessionError("Invalid session")

    elapsed_minutes = (time.time() - session_start_time) / 60
    if elapsed_minutes > SESSION_TIMEOUT_MINUTES:
        session_key = None
        session_start_time = None
        raise SessionError("Session expired")


def refresh_session() -> None:
    global session_start_time
    session_start_time = time.time()


def cli() -> None:
    """Main CLI entry point for vault-core."""
    if len(sys.argv) < 2:
        print("Usage: latch-vault <command> [args]", file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]

    if command == "init":
        if len(sys.argv) < 3:
            print("Usage: latch-vault init <password>", file=sys.stderr)
            sys.exit(1)
        init_vault(sys.argv[2])
    elif command == "unlock":
        if len(sys.argv) < 3:
            print("Usage: latch-vault unlock <password>", file=sys.stderr)
            sys.exit(1)
        unlock_vault(sys.argv[2])
    elif command == "lock":
        lock_vault()
    elif command == "status":
        vault_status()
    elif command == "search":
        try:
            check_session()
            refresh_session()
            query = sys.argv[2] if len(sys.argv) > 2 else ""
            search_entries(query)
        except SessionError as e:
            result = {"status": "error", "message": str(e)}
            print(json.dumps(result))
            sys.exit(1)
    elif command == "request-secret":
        try:
            check_session()
            refresh_session()
            entry_id = sys.argv[2] if len(sys.argv) > 2 else ""
            field = sys.argv[3] if len(sys.argv) > 3 else "password"
            request_secret(entry_id, field)
        except SessionError as e:
            result = {"status": "error", "message": str(e)}
            print(json.dumps(result))
            sys.exit(1)
    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        sys.exit(1)


def init_vault(password: str) -> None:
    """Initialize a new vault with master password."""
    global session_key, session_start_time

    if storage.vault_exists():
        print(json.dumps({"status": "error", "message": "Vault already exists"}))
        sys.exit(1)

    salt = os.urandom(16)
    key = derive_key(password, salt)

    vault_data = {"entries": []}
    encrypted_data = encrypt_data(key, json.dumps(vault_data))

    storage.create_vault(salt.hex(), encrypted_data)

    session_key = key
    session_start_time = time.time()

    result = {"status": "success", "message": "Vault initialized"}
    print(json.dumps(result))


def unlock_vault(password: str) -> None:
    """Unlock vault with master password."""
    global session_key, session_start_time

    vault_data = storage.read_vault()
    if vault_data is None:
        print(json.dumps({"status": "error", "message": "Vault not found"}))
        sys.exit(1)

    try:
        salt = bytes.fromhex(vault_data["salt"])
        key = derive_key(password, salt)

        decrypted = decrypt_data(key, vault_data["data"])
        json.loads(decrypted)

        session_key = key
        session_start_time = time.time()

        result = {"status": "success", "message": "Vault unlocked"}
        print(json.dumps(result))
    except Exception:
        print(json.dumps({"status": "error", "message": "Invalid password"}))
        sys.exit(1)


def lock_vault() -> None:
    """Lock vault and clear session."""
    global session_key, session_start_time

    session_key = None
    session_start_time = None

    result = {"status": "success", "message": "Vault locked"}
    print(json.dumps(result))


def vault_status() -> None:
    """Get vault status."""
    has_vault = storage.vault_exists()
    is_unlocked = session_key is not None

    result = {"status": "success", "has_vault": has_vault, "is_unlocked": is_unlocked}
    print(json.dumps(result))


def search_entries(query: str) -> None:
    """Search vault entries."""
    vault_data = storage.read_vault()
    if vault_data is None:
        print(json.dumps({"status": "error", "message": "Vault not found"}))
        sys.exit(1)

    try:
        key = session_key
        if key is None:
            raise SessionError("No session key")
        decrypted = decrypt_data(key, vault_data["data"])
        data = json.loads(decrypted)
        entries: list[EntryPreview] = [
            EntryPreview(id=e["id"], title=e["title"], username=e["username"])
            for e in data["entries"]
        ]

        filtered = [
            e
            for e in entries
            if query.lower() in e.title.lower() or query.lower() in e.id.lower()
        ]

        result = [e.model_dump() for e in filtered]
        print(json.dumps(result))
    except Exception:
        print(json.dumps({"status": "error", "message": "Failed to decrypt vault"}))
        sys.exit(1)


def request_secret(entry_id: str, field: str) -> None:
    """Request a secret from vault."""
    vault_data = storage.read_vault()
    if vault_data is None:
        print(json.dumps({"status": "error", "message": "Vault not found"}))
        sys.exit(1)

    try:
        key = session_key
        if key is None:
            raise SessionError("No session key")
        decrypted = decrypt_data(key, vault_data["data"])
        data = json.loads(decrypted)

        entry = None
        for e in data["entries"]:
            if e["id"] == entry_id:
                entry = e
                break

        if entry is None:
            print(json.dumps({"status": "error", "message": "Entry not found"}))
            sys.exit(1)

        if field not in entry:
            print(
                json.dumps({"status": "error", "message": f"Field '{field}' not found"})
            )
            sys.exit(1)

        result = {"status": "success", "value": entry[field]}
        print(json.dumps(result))
    except Exception:
        print(json.dumps({"status": "error", "message": "Failed to decrypt vault"}))
        sys.exit(1)


if __name__ == "__main__":
    cli()
