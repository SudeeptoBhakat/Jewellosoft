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

logger = logging.getLogger('jewellosoft')


class SupabaseAuthMiddleware:
    """
    Django middleware that verifies Supabase JWTs on every request.

    Configuration required in settings:
        SUPABASE_JWT_SECRET = os.getenv('SUPABASE_JWT_SECRET', '')
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self._secret = getattr(settings, 'SUPABASE_JWT_SECRET', '')
        if not self._secret:
            logger.warning(
                '[SupabaseAuth] SUPABASE_JWT_SECRET is not configured. '
                'JWT verification is DISABLED — falling back to header-based identity (dev only).'
            )

    def __call__(self, request):
        request.supabase_user = None
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')

        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            request.supabase_user = self._verify_jwt(token)

        # Fallback: X-User-ID / X-User-Email headers (dev/testing ONLY)
        if request.supabase_user is None and not self._secret:
            user_id = request.META.get('HTTP_X_USER_ID', '')
            user_email = request.META.get('HTTP_X_USER_EMAIL', '')
            if user_id or user_email:
                request.supabase_user = {
                    'id': user_id or None,
                    'email': user_email or None,
                }
                logger.debug(
                    '[SupabaseAuth] Dev fallback identity: id=%s email=%s',
                    user_id, user_email,
                )

        return self.get_response(request)

    def _verify_jwt(self, token):
        """Decode and verify the Supabase JWT. Returns dict or None."""
        if not self._secret:
            # No secret configured — attempt decode WITHOUT verification (dev only)
            try:
                payload = jwt.decode(token, options={'verify_signature': False})
                identity = {
                    'id': payload.get('sub'),
                    'email': payload.get('email'),
                }
                logger.debug(
                    '[SupabaseAuth] JWT decoded (UNVERIFIED): sub=%s email=%s',
                    identity['id'], identity['email'],
                )
                return identity
            except Exception as exc:
                logger.warning('[SupabaseAuth] JWT decode failed (no secret): %s', exc)
                return None

        # ── Production path: cryptographic verification ───────────
        try:
            payload = jwt.decode(
                token,
                self._secret,
                algorithms=['HS256'],
                audience='authenticated',
            )
            identity = {
                'id': payload.get('sub'),
                'email': payload.get('email'),
            }
            logger.debug(
                '[SupabaseAuth] JWT verified: sub=%s email=%s',
                identity['id'], identity['email'],
            )
            return identity
        except jwt.ExpiredSignatureError:
            logger.info('[SupabaseAuth] JWT expired')
        except jwt.InvalidAudienceError:
            logger.warning('[SupabaseAuth] JWT audience mismatch')
        except jwt.InvalidTokenError as exc:
            logger.warning('[SupabaseAuth] JWT invalid: %s', exc)
        except Exception as exc:
            logger.error('[SupabaseAuth] Unexpected JWT error: %s', exc)

        return None
