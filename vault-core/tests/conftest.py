"""Test configuration and fixtures for pytest."""

import os
import sys
import shutil
import tempfile
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from latch_vault.storage import VaultStorage


@pytest.fixture
def clean_vault():
    """Fixture that provides a clean vault environment."""
    vault_path = os.path.expanduser("~/.config/latch/vault.enc")

    if os.path.exists(vault_path):
        os.remove(vault_path)

    yield

    if os.path.exists(vault_path):
        os.remove(vault_path)
