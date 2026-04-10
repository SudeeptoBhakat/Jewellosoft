"""
─── Supabase Auth Middleware ──────────────────────────────────────
Extracts and verifies the Supabase JWT from the Authorization header.
Attaches `request.supabase_user` = {"id": ..., "email": ...} on success.

Non-blocking:
  • If no token / invalid token → request.supabase_user = None
  • Views decide their own permission policy.
────────────────────────────────────────────────────────────────────
"""

import logging
import jwt
from django.conf import settings
from django.http import JsonResponse
from apps.accounts.crypto import LicenseManager

logger = logging.getLogger('jewellosoft')

class SupabaseAuthMiddleware:
    """
    Django middleware for offline-first licensing and online authentication.
    
    Flow:
    1. Check LicenseManager. If valid, set request.supabase_user to local user.
    2. If an explicit Bearer token is passed, verify it (used during initial login).
    3. Block requests if license is invalid and trying to access core endpoints.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self._secret = getattr(settings, 'SUPABASE_JWT_SECRET', '')

    def __call__(self, request):
        request.supabase_user = None
        
        # 1. Parse incoming Bearer token (mostly for activation flow)
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            request.supabase_user = self._verify_jwt(token)
            
        # 2. Check local offline license
        license_info = LicenseManager.validate_license()
        
        # If no JWT user is found yet but we have a valid offline license, use local user data
        if not request.supabase_user and license_info.get('valid'):
            payload = license_info.get('payload', {})
            if payload:
                request.supabase_user = {
                    'id': payload.get('user_id'),
                    'email': payload.get('email')
                }

        # 3. Block access to non-auth/health endpoints if no valid session/license exists
        path = request.path_info
        if not (path.startswith('/api/accounts/auth/') or 
                path.startswith('/api/accounts/license/') or 
                path.startswith('/api/health') or 
                path.startswith('/admin')):
                
            if not request.supabase_user:
                return JsonResponse({
                    "detail": "License invalid, expired, or missing.",
                    "license_status": license_info.get('status')
                }, status=401)

        return self.get_response(request)

    # Symmetric algorithms (verified with JWT secret)
    _SYMMETRIC_ALGS = {'HS256', 'HS384', 'HS512'}
    # Asymmetric algorithms (verified with JWKS public key)
    _ASYMMETRIC_ALGS = {'RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512', 'EdDSA'}
    _ALL_ALLOWED = _SYMMETRIC_ALGS | _ASYMMETRIC_ALGS

    _jwks_client = None  # Cached JWKS client (class-level singleton)

    @classmethod
    def _get_jwks_client(cls):
        """Lazily initialize the JWKS client for asymmetric key verification."""
        if cls._jwks_client is None:
            supabase_url = getattr(settings, 'SUPABASE_URL', '')
            if supabase_url:
                jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
                cls._jwks_client = jwt.PyJWKClient(jwks_url, cache_keys=True)
                logger.info(f'[SupabaseAuth] JWKS client initialized: {jwks_url}')
        return cls._jwks_client

    def _verify_jwt(self, token):
        """
        Decode and verify the Supabase JWT.
        
        Strategy:
          - HS256/HS384/HS512 → verify with SUPABASE_JWT_SECRET (symmetric)
          - ES256/RS256/etc.  → verify with JWKS public key from Supabase (asymmetric)
        
        Returns dict {id, email} or None.
        """
        # 1. Read the token header to determine the signing algorithm
        try:
            header = jwt.get_unverified_header(token)
        except Exception as exc:
            logger.warning(f'[SupabaseAuth] Malformed JWT header: {exc}')
            return None

        alg = header.get('alg')
        if alg not in self._ALL_ALLOWED:
            logger.warning(f'[SupabaseAuth] Rejected JWT with unknown algorithm: {alg}')
            return None

        # 2. Resolve the correct verification key
        try:
            if alg in self._SYMMETRIC_ALGS:
                # Symmetric: use the JWT secret from config.json
                if not self._secret:
                    logger.error('[SupabaseAuth] SUPABASE_JWT_SECRET missing for HS* verification.')
                    return None
                key = self._secret
            else:
                # Asymmetric: fetch public key from Supabase JWKS endpoint
                jwks_client = self._get_jwks_client()
                if not jwks_client:
                    logger.error('[SupabaseAuth] JWKS client unavailable (SUPABASE_URL missing?).')
                    return None
                signing_key = jwks_client.get_signing_key_from_jwt(token)
                key = signing_key.key

            # 3. Decode and verify
            payload = jwt.decode(
                token,
                key,
                algorithms=[alg],
                options={"verify_aud": False},
            )
            return {
                'id': payload.get('sub'),
                'email': payload.get('email'),
            }

        except jwt.ExpiredSignatureError:
            logger.info('[SupabaseAuth] JWT has expired.')
            return None
        except jwt.InvalidSignatureError:
            logger.warning('[SupabaseAuth] JWT signature verification failed.')
            return None
        except Exception as exc:
            logger.warning(f'[SupabaseAuth] JWT decode error: {exc}')
            return None

