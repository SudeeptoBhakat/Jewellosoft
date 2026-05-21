"""
encrypt_config.py — Build-time config encryption for JewelloSoft

Usage (CI):
    python encrypt_config.py

Requires:
    - CONFIG_ENCRYPTION_KEY environment variable (a valid Fernet key)
    - config.json in the same directory

Produces:
    - config.json.enc (encrypted config)
    - Deletes the plain config.json after encryption
"""
import os
import sys
import json
from pathlib import Path

from cryptography.fernet import Fernet

BACKEND_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BACKEND_DIR / "config.json"
ENCRYPTED_PATH = BACKEND_DIR / "config.json.enc"


def main():
    # ── 1. Read or generate the encryption key ──────────────────────
    key = os.environ.get("CONFIG_ENCRYPTION_KEY")
    if not key:
        key = Fernet.generate_key().decode("utf-8")
        print("[OK] Generated ephemeral encryption key for this build.")

    # Validate the key is a proper Fernet key
    try:
        fernet = Fernet(key.encode("utf-8"))
    except Exception as e:
        print(f"ERROR: Invalid Fernet key: {e}")
        sys.exit(1)

    # ── 2. Read plain config.json ───────────────────────────────────
    if not CONFIG_PATH.exists():
        print(f"ERROR: {CONFIG_PATH} not found.")
        sys.exit(1)

    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config_data = f.read()

    # Validate it's proper JSON
    try:
        json.loads(config_data)
    except json.JSONDecodeError as e:
        print(f"ERROR: config.json is not valid JSON: {e}")
        sys.exit(1)

    # ── 3. Encrypt and write ────────────────────────────────────────
    encrypted = fernet.encrypt(config_data.encode("utf-8"))

    with open(ENCRYPTED_PATH, "wb") as f:
        f.write(encrypted)

    # Save the key alongside the encrypted config so PyInstaller can bundle it
    key_path = BACKEND_DIR / ".config_key"
    with open(key_path, "w", encoding="utf-8") as f:
        f.write(key)

    # ── 4. Remove the plain config ──────────────────────────────────
    CONFIG_PATH.unlink()

    print(f"[OK] Encrypted config written to {ENCRYPTED_PATH}")
    print(f"[OK] Encryption key written to {key_path}")
    print(f"[OK] Plain config.json deleted")


if __name__ == "__main__":
    main()
