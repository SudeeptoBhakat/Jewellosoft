import os
import sys
import json
import logging
from pathlib import Path

logger = logging.getLogger('jewellosoft')

def load_config():
    """
    Load configuration from config.json.
    Supports PyInstaller packaged apps using sys._MEIPASS.
    Raises ValueError if required keys are missing.
    """
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        # Running in a PyInstaller bundle
        config_path = Path(sys._MEIPASS) / "config.json"
        
        # Override bundled config with user-provided config if it exists alongside the exe
        exe_dir_config = Path(sys.executable).parent / "config.json"
        if exe_dir_config.exists():
            config_path = exe_dir_config
    else:
        # Development mode
        backend_dir = Path(__file__).resolve().parent.parent
        config_path = backend_dir / "config.json"
        
        # Fallback to absolute project root if not found in backend
        if not config_path.exists():
            config_path = backend_dir.parent / "config.json"

    if not config_path.exists():
        msg = f"CRITICAL: Configuration file not found at {config_path}"
        logger.error(msg)
        raise FileNotFoundError(msg)

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        msg = f"CRITICAL: Failed to parse config.json: {e}"
        logger.error(msg)
        raise ValueError(msg)

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
