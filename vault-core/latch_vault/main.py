import sys
import json
from typing import Optional
from pydantic import BaseModel


class EntryPreview(BaseModel):
    id: str
    title: str
    username: str


def cli() -> None:
    """Main CLI entry point for vault-core."""
    if len(sys.argv) < 2:
        print("Usage: latch-vault <command> [args]", file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]

    if command == "search":
        query = sys.argv[2] if len(sys.argv) > 2 else ""
        search_entries(query)
    elif command == "request-secret":
        entry_id = sys.argv[2] if len(sys.argv) > 2 else ""
        field = sys.argv[3] if len(sys.argv) > 3 else "password"
        request_secret(entry_id, field)
    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        sys.exit(1)


def search_entries(query: str) -> None:
    """Search vault entries."""
    entries: list[EntryPreview] = [
        EntryPreview(id="gmail.com", title="Gmail", username="user@gmail.com"),
        EntryPreview(id="github.com", title="GitHub", username="myusername"),
    ]

    filtered = [
        e
        for e in entries
        if query.lower() in e.title.lower() or query.lower() in e.id.lower()
    ]

    result = [e.model_dump() for e in filtered]
    print(json.dumps(result))


def request_secret(entry_id: str, field: str) -> None:
    """Request a secret from the vault."""
    result = {"status": "error", "message": "Not implemented"}
    print(json.dumps(result))


if __name__ == "__main__":
    cli()
