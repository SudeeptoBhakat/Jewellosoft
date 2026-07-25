"""
Cloud access layer

Production clients never hold the Supabase service-role key. All privileged
operations are performed by the activate edge function, which is called here
with the end user's own Supabase JWT. A service-role client is only available
in explicit developer mode and is never bundled into a release.
"""
import logging

import requests
from django.conf import settings

logger = logging.getLogger('jewellosoft')

_DEFAULT_TIMEOUT = 15


def get_functions_base_url():
    base = (getattr(settings, 'EDGE_FUNCTIONS_URL', '') or '').strip()
    if base:
        return base.rstrip('/')
    supabase_url = (getattr(settings, 'SUPABASE_URL', '') or '').strip().rstrip('/')
    if not supabase_url:
        return ''
    return f"{supabase_url}/functions/v1"


def call_edge_function(name, user_jwt, payload=None, timeout=_DEFAULT_TIMEOUT):
    base = get_functions_base_url()
    if not base:
        raise RuntimeError('EDGE_FUNCTIONS_URL / SUPABASE_URL is not configured.')

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f"Bearer {user_jwt}",
    }
    anon_key = (getattr(settings, 'SUPABASE_ANON_KEY', '') or '').strip()
    if anon_key:
        headers['apikey'] = anon_key

    response = requests.post(
        f"{base}/{name}",
        json=payload or {},
        headers=headers,
        timeout=timeout,
    )
    try:
        body = response.json()
    except ValueError:
        body = {'detail': response.text}
    return response.status_code, body


def get_dev_service_client():
    if not getattr(settings, 'ALLOW_SERVICE_ROLE', False):
        return None
    service_key = (getattr(settings, 'SUPABASE_SERVICE_ROLE_KEY', '') or '').strip()
    supabase_url = (getattr(settings, 'SUPABASE_URL', '') or '').strip()
    if not service_key or not supabase_url:
        return None
    try:
        from supabase import create_client
    except ImportError:
        logger.warning('supabase package not installed; dev service client unavailable.')
        return None
    logger.warning('[Supabase] Using DEVELOPER service-role client. Do not ship this build.')
    return create_client(supabase_url, service_key)
