import pytest
import os
from latch_vault.crypto import derive_key, encrypt_data, decrypt_data
import json


def test_derive_key():
    """Test key derivation with Argon2id."""
    password = "testpassword123"
    salt = os.urandom(16)

    key1 = derive_key(password, salt)
    key2 = derive_key(password, salt)

    assert len(key1) == 32
    assert key1 == key2


def test_derive_key_different_passwords():
    """Test that different passwords produce different keys."""
    password1 = "password1"
    password2 = "password2"
    salt = os.urandom(16)

    key1 = derive_key(password1, salt)
    key2 = derive_key(password2, salt)

    assert key1 != key2


def test_encrypt_decrypt():
    """Test AES-256-GCM encryption and decryption."""
    password = "testpassword123"
    salt = os.urandom(16)
    key = derive_key(password, salt)

    plaintext = json.dumps({"test": "data", "number": 42})
    encrypted = encrypt_data(key, plaintext)

    assert "nonce" in encrypted
    assert "ciphertext" in encrypted
    assert len(bytes.fromhex(encrypted["nonce"])) == 12


def test_encrypt_decrypt_roundtrip():
    """Test full encryption/decryption roundtrip."""
    password = "testpassword123"
    salt = os.urandom(16)
    key = derive_key(password, salt)

    original_data = {
        "entries": [
            {"id": "test1", "title": "Gmail", "username": "user@gmail.com"},
            {"id": "test2", "title": "GitHub", "username": "ghuser"}
        ]
    }
    plaintext = json.dumps(original_data)
    encrypted = encrypt_data(key, plaintext)
    decrypted = decrypt_data(key, encrypted)

    assert plaintext == decrypted
    assert json.loads(decrypted) == original_data


def test_wrong_password():
    """Test that wrong password cannot decrypt."""
    password1 = "correctpassword"
    password2 = "wrongpassword"
    salt = os.urandom(16)

    key1 = derive_key(password1, salt)
    key2 = derive_key(password2, salt)

    plaintext = "secret data"
    encrypted = encrypt_data(key1, plaintext)

    with pytest.raises(Exception):
        decrypt_data(key2, encrypted)
