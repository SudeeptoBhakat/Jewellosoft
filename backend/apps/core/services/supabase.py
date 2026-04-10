import logging
from django.conf import settings
from supabase import create_client, Client

logger = logging.getLogger('jewellosoft')

_supabase_client = None

def get_supabase_client() -> Client:
    """
    Returns a configured Supabase client instance using the Service Role Key.
    This client has admin privileges over the database and MUST NEVER be exposed
    to the frontend or leaked in public contexts.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        error_msg = "CRITICAL: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Supabase Client cannot initialize."
        logger.error(error_msg)
        raise ValueError(error_msg)

    logger.info("Initializing Supabase Client securely via Service Role.")
    try:
        # We explicitly use the backend-only service role key for unfettered sync powers 
        # and checking the public.profiles secure layer
        _supabase_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY
        )
        return _supabase_client
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        raise
