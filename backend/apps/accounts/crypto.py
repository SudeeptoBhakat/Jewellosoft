import os
import json
import uuid
import hmac
import hashlib
import time
from datetime import datetime, timedelta
from cryptography.fernet import Fernet
from django.conf import settings
import logging

logger = logging.getLogger('jewellosoft')

def get_device_id():
    """Returns a unique hardware identifier for this machine."""
    # Getting the MAC address as a simple hardware identifier
    mac = uuid.getnode()
    return hashlib.sha256(str(mac).encode('utf-8')).hexdigest()

def get_secret_key():
    """Returns a stable 32-byte key for AES, derived from Django's SECRET_KEY and Device ID."""
    base_secret = getattr(settings, 'SECRET_KEY', 'default-offline-secret')
    device_id = get_device_id()
    combined = f"{base_secret}::{device_id}"
    # Generate 32 bytes and base64 encode for Fernet
    import base64
    digest = hashlib.sha256(combined.encode('utf-8')).digest()
    return base64.urlsafe_b64encode(digest)

def sign_payload(payload_str):
    """Generates HMAC-SHA256 signature for a payload."""
    secret = getattr(settings, 'SECRET_KEY', 'default').encode('utf-8')
    return hmac.new(secret, payload_str.encode('utf-8'), hashlib.sha256).hexdigest()

class LicenseManager:
    LICENSE_PATH = os.path.join(getattr(settings, 'USER_DATA_DIR', getattr(settings, 'BASE_DIR', '')), 'license.key')

    @classmethod
    def generate_license(cls, supabase_user, subscription_data):
        """Creates and encrypts a new license file."""
        now = int(time.time())
        # Default: valid for 30 days if no explicit date given
        expiry_days = subscription_data.get('days_valid', 30)
        expiry_ts = now + (expiry_days * 86400)
        
        payload = {
            'user_id': supabase_user.get('id'),
            'email': supabase_user.get('email'),
            'plan': subscription_data.get('plan', 'free_trial'),
            'issued_at': now,
            'expires_at': expiry_ts,
            'last_verified_at': now,
            'device_id': get_device_id()
        }
        
        payload_str = json.dumps(payload, sort_keys=True)
        signature = sign_payload(payload_str)
        
        final_data = {
            'payload': payload,
            'signature': signature
        }
        
        # Encrypt with device-bound AES key
        f = Fernet(get_secret_key())
        encrypted_data = f.encrypt(json.dumps(final_data).encode('utf-8'))
        
        with open(cls.LICENSE_PATH, 'wb') as file:
            file.write(encrypted_data)
            
        return payload

    @classmethod
    def validate_license(cls):
        """
        Reads, decrypts, and validates the license.
        Returns:
            dict: { 'valid': bool, 'status': str, 'payload': dict|None }
        """
        if not os.path.exists(cls.LICENSE_PATH):
            return {'valid': False, 'status': 'missing', 'payload': None}
            
        try:
            with open(cls.LICENSE_PATH, 'rb') as file:
                encrypted_data = file.read()
                
            f = Fernet(get_secret_key())
            decrypted_data = f.decrypt(encrypted_data).decode('utf-8')
            data = json.loads(decrypted_data)
        except Exception as e:
            logger.error(f"[LicenseManager] Decryption failed: {e}")
            return {'valid': False, 'status': 'corrupt_or_bound_to_other_device', 'payload': None}

        payload = data.get('payload', {})
        signature = data.get('signature')
        
        # 1. Signature Check
        payload_str = json.dumps(payload, sort_keys=True)
        expected_sig = sign_payload(payload_str)
        if not hmac.compare_digest(expected_sig, signature):
            return {'valid': False, 'status': 'tampered_signature', 'payload': None}
            
        # 2. Device Check
        if payload.get('device_id') != get_device_id():
            return {'valid': False, 'status': 'device_mismatch', 'payload': None}
            
        # 3. Expiry and Grace Period Check
        now = int(time.time())
        expires_at = payload.get('expires_at', 0)
        last_verified_at = payload.get('last_verified_at', 0)
        
        # Detect system date rollback
        if now < last_verified_at:
            return {'valid': False, 'status': 'date_tampering_detected', 'payload': payload}
            
        # Check Force Sync (> 7 days)
        if now - last_verified_at > (7 * 86400):
            return {'valid': False, 'status': 'force_sync_required', 'payload': payload}
            
        # Expiry Check (with 3-day grace period)
        if now > expires_at:
            grace_period_end = expires_at + (3 * 86400)
            if now <= grace_period_end:
                return {'valid': True, 'status': 'grace_period', 'payload': payload}
            else:
                return {'valid': False, 'status': 'expired', 'payload': payload}
                
        return {'valid': True, 'status': 'active', 'payload': payload}

    @classmethod
    def update_last_verified(cls):
        """Silently update the last_verified_at timestamp after successful online sync."""
        val = cls.validate_license()
        if val['payload']:
            payload = val['payload']
            payload['last_verified_at'] = int(time.time())
            
            payload_str = json.dumps(payload, sort_keys=True)
            signature = sign_payload(payload_str)
            final_data = {'payload': payload, 'signature': signature}
            
            f = Fernet(get_secret_key())
            encrypted_data = f.encrypt(json.dumps(final_data).encode('utf-8'))
            with open(cls.LICENSE_PATH, 'wb') as file:
                file.write(encrypted_data)
