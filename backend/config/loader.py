#
# JewelloSoft Community Edition
# Copyright (c) 2026 Sudeepta Bhakat
# Licensed under the JewelloSoft Community License.
#
import os
import sys
import json
import logging
from pathlib import Path

logger = logging.getLogger('jewellosoft')


def _resolve_config_paths():
    """
    Returns a list of (directory, prefix) tuples to search for config files.
    Supports PyInstaller packaged apps using sys._MEIPASS.
    """
    candidates = []

    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        # Running in a PyInstaller bundle
        candidates.append(Path(sys._MEIPASS))
        # Override bundled config with user-provided config alongside the exe
        candidates.insert(0, Path(sys.executable).parent)
    else:
        # Development mode
        backend_dir = Path(__file__).resolve().parent.parent
        candidates.append(backend_dir)
        # Fallback to project root
        candidates.append(backend_dir.parent)

    return candidates


def _try_load_encrypted(config_path):
    """
    Attempt to load and decrypt an encrypted config file.
    Returns parsed dict or None.
    """
    try:
        from cryptography.fernet import Fernet
    except ImportError:
        logger.warning("cryptography package not installed — cannot decrypt config")
        return None

    # The encryption key is embedded at build time via environment variable
    # For development, fall back to plain config.json instead
    key = os.environ.get("CONFIG_ENCRYPTION_KEY")
    if not key:
        # Try a hardcoded key file that might sit alongside the encrypted config
        key_file = config_path.parent / ".config_key"
        if key_file.exists():
            key = key_file.read_text(encoding="utf-8").strip()

    if not key:
        return None

    try:
        fernet = Fernet(key.encode("utf-8"))
        with open(config_path, "rb") as f:
            encrypted_data = f.read()
        decrypted = fernet.decrypt(encrypted_data).decode("utf-8")
        return json.loads(decrypted)
    except Exception as e:
        logger.error(f"Failed to decrypt config: {e}")
        raise ValueError(f"CRITICAL: Failed to decrypt config.json.enc: {e}")


def load_config():
    """
    Load configuration from config.json.enc (encrypted) or config.json (plain).
    Supports PyInstaller packaged apps using sys._MEIPASS.
    Raises ValueError if required keys are missing.
    """
    search_dirs = _resolve_config_paths()
    config = None

    # Priority 1: Try encrypted config
    for directory in search_dirs:
        enc_path = directory / "config.json.enc"
        if enc_path.exists():
            config = _try_load_encrypted(enc_path)
            if config is not None:
                logger.info(f"Loaded encrypted config from {enc_path}")
                break

    # Priority 2: Fall back to plain config (development mode)
    if config is None:
        for directory in search_dirs:
            plain_path = directory / "config.json"
            if plain_path.exists():
                try:
                    with open(plain_path, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                    logger.info(f"Loaded plain config from {plain_path}")
                    break
                except json.JSONDecodeError as e:
                    msg = f"CRITICAL: Failed to parse config.json: {e}"
                    logger.error(msg)
                    raise ValueError(msg)

    if config is None:
        searched = [str(d) for d in search_dirs]
        msg = f"CRITICAL: Configuration file not found. Searched: {', '.join(searched)}"
        logger.error(msg)
        raise FileNotFoundError(msg)

    # Validate required keys
    required_keys = [
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_JWT_SECRET"
    ]

    missing_keys = [key for key in required_keys if not config.get(key)]
    if missing_keys:
        msg = f"CRITICAL: Missing required configuration keys in config.json: {', '.join(missing_keys)}"
        logger.error(msg)
        raise ValueError(msg)

    return config
