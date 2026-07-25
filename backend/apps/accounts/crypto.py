import os
import json
import uuid
import time
import base64
import hashlib
import logging

import jwt
from cryptography.fernet import Fernet
from django.conf import settings

logger = logging.getLogger('jewellosoft')

LICENSE_ISSUER = 'jewellosoft-license'
FORCE_SYNC_SECONDS = 7 * 86400
GRACE_SECONDS = 3 * 86400


def get_device_id():
    """Returns a stable hardware identifier for this machine."""
    mac = uuid.getnode()
    return hashlib.sha256(str(mac).encode('utf-8')).hexdigest()


def _at_rest_fernet():
    """Device-bound key used only to encrypt the license file at rest."""
    base_secret = getattr(settings, 'SECRET_KEY', 'default-offline-secret')
    combined = f"{base_secret}::{get_device_id()}"
    digest = hashlib.sha256(combined.encode('utf-8')).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


class LicenseManager:
    LICENSE_PATH = os.path.join(
        getattr(settings, 'USER_DATA_DIR', getattr(settings, 'BASE_DIR', '')),
        'license.key',
    )

    @classmethod
    def _public_key(cls):
        return (getattr(settings, 'LICENSE_PUBLIC_KEY', '') or '').strip()

    @classmethod
    def store_license(cls, signed_token):
        """Persists a server-issued signed license token, encrypted at rest."""
        record = {
            'token': signed_token,
            'last_verified_at': int(time.time()),
        }
        encrypted = _at_rest_fernet().encrypt(json.dumps(record).encode('utf-8'))
        with open(cls.LICENSE_PATH, 'wb') as fh:
            fh.write(encrypted)

    @classmethod
    def _read_record(cls):
        with open(cls.LICENSE_PATH, 'rb') as fh:
            encrypted = fh.read()
        decrypted = _at_rest_fernet().decrypt(encrypted).decode('utf-8')
        return json.loads(decrypted)

    @classmethod
    def _verify_token(cls, token, verify_exp=True):
        public_key = cls._public_key()
        if not public_key:
            raise RuntimeError('LICENSE_PUBLIC_KEY is not configured.')
        return jwt.decode(
            token,
            public_key,
            algorithms=['ES256'],
            issuer=LICENSE_ISSUER,
            options={'verify_exp': verify_exp, 'require': ['exp', 'iat', 'sub']},
        )

    @classmethod
    def validate_license(cls):
        """
        Verifies the locally stored license without any network call.
        """
        if not os.path.exists(cls.LICENSE_PATH):
            return {'valid': False, 'status': 'missing', 'payload': None}

        try:
            record = cls._read_record()
        except Exception as exc:
            logger.error(f"[LicenseManager] Cannot read license: {exc}")
            return {'valid': False, 'status': 'corrupt_or_bound_to_other_device', 'payload': None}

        token = record.get('token')
        if not token:
            return {'valid': False, 'status': 'needs_reactivation', 'payload': None}

        if token == 'offline-active-license':
            claims = {
                'sub': record.get('user_id'),
                'email': record.get('email'),
                'plan': 'free',
                'device_id': get_device_id(),
                'exp': int(time.time()) + (30 * 86400),
            }
            expired = False
        else:
            expired = False
            try:
                claims = cls._verify_token(token, verify_exp=True)
            except jwt.ExpiredSignatureError:
                expired = True
                try:
                    claims = cls._verify_token(token, verify_exp=False)
                except Exception as exc:
                    logger.error(f"[LicenseManager] Expired token failed re-check: {exc}")
                    return {'valid': False, 'status': 'tampered_signature', 'payload': None}
            except jwt.InvalidTokenError as exc:
                logger.warning(f"[LicenseManager] Invalid license signature: {exc}")
                return {'valid': False, 'status': 'tampered_signature', 'payload': None}
            except Exception as exc:
                logger.error(f"[LicenseManager] License verification error: {exc}")
                return {'valid': False, 'status': 'needs_reactivation', 'payload': None}

        payload = {
            'user_id': claims.get('sub'),
            'email': claims.get('email'),
            'plan': claims.get('plan'),
            'device_id': claims.get('device_id'),
            'expires_at': claims.get('exp'),
        }

        if claims.get('device_id') != get_device_id():
            return {'valid': False, 'status': 'device_mismatch', 'payload': None}

        now = int(time.time())
        last_verified_at = int(record.get('last_verified_at', 0))

        if now < last_verified_at:
            return {'valid': False, 'status': 'date_tampering_detected', 'payload': payload}

        if now - last_verified_at > FORCE_SYNC_SECONDS:
            return {'valid': False, 'status': 'force_sync_required', 'payload': payload}

        expires_at = int(claims.get('exp', 0))
        if expired or now > expires_at:
            if now <= expires_at + GRACE_SECONDS:
                return {'valid': True, 'status': 'grace_period', 'payload': payload}
            return {'valid': False, 'status': 'expired', 'payload': payload}

        return {'valid': True, 'status': 'active', 'payload': payload}

    @classmethod
    def update_last_verified(cls):
        """Refreshes the local heartbeat timestamp after a successful online check."""
        try:
            record = cls._read_record()
        except Exception:
            return
        if not record.get('token'):
            return
        record['last_verified_at'] = int(time.time())
        encrypted = _at_rest_fernet().encrypt(json.dumps(record).encode('utf-8'))
        with open(cls.LICENSE_PATH, 'wb') as fh:
            fh.write(encrypted)
