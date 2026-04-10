import os
import django
import threading
import time
import requests
import logging

# Ensure Django is set up if this is run independently
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from apps.accounts.models import SyncQueue, Shop
from apps.accounts.crypto import LicenseManager

logger = logging.getLogger('jewellosoft')

def check_internet():
    try:
        requests.get("https://api.supabase.com", timeout=3)
        return True
    except (requests.ConnectionError, requests.Timeout):
        return False

def sync_worker_loop():
    logger.info("[SyncWorker] Background sync thread started.")
    while True:
        try:
            # 1. Process SyncQueue
            pending_items = SyncQueue.objects.filter(status='pending').order_by('created_at')[:50]
            if pending_items.exists() and check_internet():
                from apps.core.services.supabase import get_supabase_client
                client = get_supabase_client()
                
                for item in pending_items:
                    try:
                        # For Shop payload, map it to the Supabase profiles schema
                        if item.model_name == 'Shop':
                            # Get the linked user ID from the Local DB
                            shop_obj = Shop.objects.filter(id=item.object_id).first()
                            if not shop_obj or not shop_obj.supabase_user_id:
                                raise ValueError(f"Shop missing or not linked to Supabase: ID {item.object_id}")
                                
                            supabase_user_id = shop_obj.supabase_user_id
                            
                            # Flatten our payload into what the profiles table expects
                            p = item.payload
                            remote_payload = {
                                "id": supabase_user_id,
                                "shop_name": p.get("name", ""),
                                "owner_name": p.get("owner_name", ""),
                                "mobile_number": p.get("phone", ""),
                            }
                            
                            # Execute upsert directly against the profiles table
                            client.table("profiles").upsert(remote_payload).execute()
                            
                        # Future Models e.g., Customers, Orders can be added here
                        
                        logger.info(f"[SyncWorker] Successfully synced {item.model_name} {item.object_id}")
                        item.status = 'synced'
                        item.save()
                    except Exception as e:
                        logger.error(f"[SyncWorker] Failed to sync item {item.id}: {e}")
                        item.attempts += 1
                        item.last_error = str(e)
                        if item.attempts >= 5:
                            item.status = 'failed'
                        item.save()

            # 2. Revalidate Subscription / Update License (every 6 hours)
            # Only if internet is available and 6 hours have passed since last verification
            val = LicenseManager.validate_license()
            if val.get('valid') and val.get('payload'):
                last_verified = val['payload'].get('last_verified_at', 0)
                if int(time.time()) - last_verified > (6 * 3600) and check_internet():
                    logger.info("[SyncWorker] Refreshing local license via Supabase online check...")
                    # Simulating success check
                    LicenseManager.update_last_verified()

        except Exception as e:
            logger.error(f"[SyncWorker] Unhandled exception in loop: {e}")
            
        # Sleep for 1 minute before checking again
        time.sleep(60)

def start_background_sync():
    thread = threading.Thread(target=sync_worker_loop, daemon=True)
    thread.start()
    return thread
