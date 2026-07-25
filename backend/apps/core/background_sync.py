import os
import django
import threading
import time
import requests
import logging

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.crypto import LicenseManager

logger = logging.getLogger('jewellosoft')

LICENSE_HEARTBEAT_SECONDS = 6 * 3600

def check_internet():
    try:
        requests.get("https://api.supabase.com", timeout=3)
        return True
    except (requests.ConnectionError, requests.Timeout):
        return False

def sync_worker_loop():
    logger.info("[SyncWorker] Background sync thread started.")
    last_heartbeat = 0
    while True:
        try:
            val = LicenseManager.validate_license()
            if val.get('valid'):
                now = int(time.time())
                if now - last_heartbeat > LICENSE_HEARTBEAT_SECONDS and check_internet():
                    logger.info("[SyncWorker] Refreshing local license heartbeat.")
                    LicenseManager.update_last_verified()
                    last_heartbeat = now

        except Exception as e:
            logger.error(f"[SyncWorker] Unhandled exception in loop: {e}")

        time.sleep(60)

def start_background_sync():
    thread = threading.Thread(target=sync_worker_loop, daemon=True)
    thread.start()
    return thread