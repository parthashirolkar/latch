import sys
import os
import shutil
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from latch_vault.storage import VaultStorage
import json


def test_vault_storage_init():
    """Test VaultStorage initialization."""
    with tempfile.TemporaryDirectory() as tmpdir:
        storage = VaultStorage()
        assert storage.vault_file is not None, "Vault file path should be set"
        assert storage.config_dir is not None, "Config dir should be set"
        print("✓ test_vault_storage_init passed")


def test_vault_not_exists():
    """Test vault_exists returns False when vault doesn't exist."""
    storage = VaultStorage()
    if storage.vault_file.exists():
        os.remove(storage.vault_file)
    assert storage.vault_exists() == False, "Vault should not exist initially"
    print("✓ test_vault_not_exists passed")


def test_create_vault():
    """Test creating a vault."""
    with tempfile.TemporaryDirectory() as tmpdir:
        storage = VaultStorage()

        salt = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5"
        encrypted_data = {
            "nonce": "a1b2c3d4e5f6a7b8c9d0e1f2",
            "ciphertext": "encrypted123456",
        }

        storage.create_vault(salt, encrypted_data)

        assert storage.vault_exists(), "Vault should exist after creation"
        print("✓ test_create_vault passed")


def test_read_vault():
    """Test reading a vault."""
    with tempfile.TemporaryDirectory() as tmpdir:
        storage = VaultStorage()

        salt = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5"
        encrypted_data = {
            "nonce": "a1b2c3d4e5f6a7b8c9d0e1f2",
            "ciphertext": "encrypted123456",
        }

        storage.create_vault(salt, encrypted_data)
        vault_data = storage.read_vault()

        assert vault_data is not None, "Should be able to read vault"
        assert vault_data["salt"] == salt, "Salt should match"
        assert vault_data["data"] == encrypted_data, "Encrypted data should match"
        print("✓ test_read_vault passed")


def test_read_nonexistent_vault():
    """Test reading nonexistent vault returns None."""
    import os

    storage = VaultStorage()

    if storage.vault_file.exists():
        os.remove(storage.vault_file)

    vault_data = storage.read_vault()
    assert vault_data is None, "Nonexistent vault should return None"
    print("✓ test_read_nonexistent_vault passed")


def test_update_vault():
    """Test updating a vault."""
    with tempfile.TemporaryDirectory() as tmpdir:
        storage = VaultStorage()

        salt1 = "salt123456789abc"
        encrypted_data1 = {"nonce": "nonce1", "ciphertext": "ciphertext1"}

        storage.create_vault(salt1, encrypted_data1)

        salt2 = "newsalt987654321xyz"
        encrypted_data2 = {"nonce": "nonce2", "ciphertext": "ciphertext2"}

        storage.update_vault(salt2, encrypted_data2)

        vault_data = storage.read_vault()
        assert vault_data["salt"] == salt2, "Salt should be updated"
        assert vault_data["data"] == encrypted_data2, "Data should be updated"
        print("✓ test_update_vault passed")


def test_vault_structure():
    """Test that vault has correct structure."""
    with tempfile.TemporaryDirectory() as tmpdir:
        storage = VaultStorage()

        salt = "testsalt"
        encrypted_data = {"nonce": "n", "ciphertext": "c"}

        storage.create_vault(salt, encrypted_data)

        vault_data = storage.read_vault()
        assert "version" in vault_data, "Vault should have version"
        assert "kdf" in vault_data, "Vault should have kdf"
        assert "salt" in vault_data, "Vault should have salt"
        assert "data" in vault_data, "Vault should have data"
        assert vault_data["version"] == "1", "Version should be 1"
        assert vault_data["kdf"] == "argon2id", "KDF should be argon2id"
        print("✓ test_vault_structure passed")


if __name__ == "__main__":
    test_vault_storage_init()
    test_vault_not_exists()
    test_create_vault()
    test_read_vault()
    test_read_nonexistent_vault()
    test_update_vault()
    test_vault_structure()
    print("\n✅ All storage tests passed!")
