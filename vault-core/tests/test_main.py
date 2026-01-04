import sys
import os
import shutil
import tempfile
import subprocess
import json

TEST_DIR = os.path.dirname(os.path.abspath(__file__))


def test_cli_status():
    """Test CLI status command."""
    result = subprocess.run(
        ["uv", "run", "python", "-m", "latch_vault.main", "status"],
        capture_output=True,
        text=True,
        cwd=TEST_DIR,
    )

    assert result.returncode == 0, "Status command should succeed"
    output = json.loads(result.stdout)
    assert "status" in output, "Output should have status field"
    assert "has_vault" in output, "Output should have has_vault field"
    assert "is_unlocked" in output, "Output should have is_unlocked field"
    print("✓ test_cli_status passed")


def test_cli_status_no_vault():
    """Test CLI status when no vault exists."""
    shutil.rmtree(os.path.expanduser("~/.config/latch"), ignore_errors=True)

    result = subprocess.run(
        ["uv", "run", "python", "-m", "latch_vault.main", "status"],
        capture_output=True,
        text=True,
        cwd=TEST_DIR,
    )

    assert result.returncode == 0, "Status command should succeed"
    output = json.loads(result.stdout)
    assert output["has_vault"] == False, "Should report no vault exists"
    print("✓ test_cli_status_no_vault passed")


def test_cli_init():
    """Test CLI init command."""
    shutil.rmtree(os.path.expanduser("~/.config/latch"), ignore_errors=True)

    result = subprocess.run(
        ["uv", "run", "python", "-m", "latch_vault.main", "init", "testpassword123"],
        capture_output=True,
        text=True,
        cwd=TEST_DIR,
    )

    assert result.returncode == 0, "Init command should succeed"
    output = json.loads(result.stdout)
    assert output["status"] == "success", "Init should return success"
    print("✓ test_cli_init passed")


def test_cli_init_existing_vault():
    """Test CLI init with existing vault fails."""
    result = subprocess.run(
        ["uv", "run", "python", "-m", "latch_vault.main", "init", "testpassword456"],
        capture_output=True,
        text=True,
        cwd=TEST_DIR,
    )

    assert result.returncode == 1, "Init with existing vault should fail"
    output = json.loads(result.stdout)
    assert output["status"] == "error", "Should return error status"
    assert "already exists" in output["message"], (
        "Error message should mention vault exists"
    )
    print("✓ test_cli_init_existing_vault passed")


def test_cli_unlock():
    """Test CLI unlock command."""
    result = subprocess.run(
        ["uv", "run", "python", "-m", "latch_vault.main", "unlock", "testpassword123"],
        capture_output=True,
        text=True,
        cwd=TEST_DIR,
    )

    assert result.returncode == 0, "Unlock command should succeed with correct password"
    output = json.loads(result.stdout)
    assert output["status"] == "success", "Unlock should return success"
    print("✓ test_cli_unlock passed")


def test_cli_unlock_wrong_password():
    """Test CLI unlock with wrong password fails."""
    result = subprocess.run(
        ["uv", "run", "python", "-m", "latch_vault.main", "unlock", "wrongpassword"],
        capture_output=True,
        text=True,
        cwd=TEST_DIR,
    )

    assert result.returncode == 1, "Unlock should fail with wrong password"
    output = json.loads(result.stdout)
    assert output["status"] == "error", "Should return error status"
    assert "Invalid password" in output["message"], (
        "Error message should mention invalid password"
    )
    print("✓ test_cli_unlock_wrong_password passed")


def test_cli_lock():
    """Test CLI lock command."""
    subprocess.run(
        ["uv", "run", "python", "-m", "latch_vault.main", "unlock", "testpassword123"],
        capture_output=True,
        text=True,
        cwd=TEST_DIR,
    )

    result = subprocess.run(
        ["uv", "run", "python", "-m", "latch_vault.main", "lock"],
        capture_output=True,
        text=True,
        cwd=TEST_DIR,
    )

    assert result.returncode == 0, "Lock command should succeed"
    output = json.loads(result.stdout)
    assert output["status"] == "success", "Lock should return success"
    print("✓ test_cli_lock passed")


def test_cli_search_locked():
    """Test CLI search when vault is locked."""
    result = subprocess.run(
        ["uv", "run", "python", "-m", "latch_vault.main", "search", "test"],
        capture_output=True,
        text=True,
        cwd=TEST_DIR,
    )

    assert result.returncode == 1, "Search should fail when vault is locked"
    output = json.loads(result.stdout)
    assert output["status"] == "error", "Should return error status"
    assert "locked" in output["message"].lower(), (
        "Error message should mention locked vault"
    )
    print("✓ test_cli_search_locked passed")


if __name__ == "__main__":
    test_cli_status_no_vault()
    test_cli_init()
    test_cli_status()
    test_cli_init_existing_vault()
    test_cli_unlock()
    test_cli_unlock_wrong_password()
    test_cli_lock()
    test_cli_search_locked()
    print("\n✅ All CLI tests passed!")
