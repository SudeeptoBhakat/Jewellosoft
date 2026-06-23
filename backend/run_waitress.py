#
# JewelloSoft Community Edition
# Copyright (c) 2026 Sudeepta Bhakat
# Licensed under the JewelloSoft Community License.
#
import os
import sys
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')

def log(msg):
    print(f"[JewelloSoft Backend] {msg}", flush=True)

def log_error(msg):
    print(f"[JewelloSoft Backend ERROR] {msg}", file=sys.stderr, flush=True)

log("=" * 50)
log("Starting JewelloSoft Backend...")
log(f"Python Version : {sys.version}")
log(f"Executable     : {sys.executable}")
log(f"Working Dir    : {os.getcwd()}")
log(f"Settings Module: {os.environ.get('DJANGO_SETTINGS_MODULE')}")
log(f"Data Path      : {os.environ.get('JEWELLOSOFT_DATA_PATH', 'Not set (dev mode)')}")
log("=" * 50)

critical_imports = [
    ('django', 'Django framework'),
    ('django.template', 'Django template engine'),
    ('django.templatetags', 'Django template tags'),
    ('django.templatetags.i18n', 'Django i18n template tags'),
    ('django.templatetags.l10n', 'Django l10n template tags'),
    ('django.templatetags.static', 'Django static template tags'),
    ('django.templatetags.tz', 'Django timezone template tags'),
    ('django.templatetags.cache', 'Django cache template tags'),
    ('django.contrib.admin', 'Django admin'),
    ('django.contrib.auth', 'Django auth'),
    ('django.contrib.contenttypes', 'Django content types'),
    ('django.contrib.sessions', 'Django sessions'),
    ('django.contrib.messages', 'Django messages'),
    ('django.contrib.staticfiles', 'Django static files'),
    ('django.db.backends.sqlite3', 'SQLite3 database backend'),
    ('rest_framework', 'Django REST Framework'),
    ('rest_framework_simplejwt', 'SimpleJWT authentication'),
    ('corsheaders', 'CORS headers middleware'),
    ('django_filters', 'Django filter'),
    ('waitress', 'Waitress WSGI server'),
]

import_failures = []
for module_name, description in critical_imports:
    try:
        __import__(module_name)
        log(f"  [success] {description} ({module_name})")
    except ImportError as e:
        log_error(f"  [failed] {description} ({module_name}) — {e}")
        import_failures.append((module_name, str(e)))

if import_failures:
    log_error("")
    log_error("=" * 50)
    log_error(f"FATAL: {len(import_failures)} critical module(s) missing!")
    log_error("The backend.exe was not compiled with all required modules.")
    log_error("Add these to HIDDEN_IMPORTS in build_backend.py and rebuild:")
    for mod, err in import_failures:
        log_error(f"  --hidden-import={mod}  ({err})")
    log_error("=" * 50)
    sys.exit(1)

log("All critical imports verified")

try:
    import django
    django.setup()
    log("Django initialized successfully")
except Exception as e:
    log_error(f"Django setup FAILED: {e}")
    log_error(traceback.format_exc())
    sys.exit(1)

try:
    from django.core.management import execute_from_command_line
    log("Running database migrations...")
    execute_from_command_line(['manage.py', 'migrate', '--run-syncdb'])
    log("Migrations complete")
except Exception as e:
    log_error(f"Migration FAILED: {e}")
    log_error(traceback.format_exc())
    log("WARNING: Continuing despite migration failure...")


try:
    from apps.accounts.models import Shop
    if not Shop.objects.exists():
        log("Seeding default Shop for offline mode...")
        Shop.objects.create(
            name='My Jewellery Shop',
            owner_name='Admin',
            phone='0000000000',
            address='Shop Address'
        )
        log("Default shop created")
    else:
        log("Shop data already exists")
except Exception as e:
    log_error(f"Shop seeding failed (non-critical): {e}")

try:
    from django.contrib.auth import get_user_model
    User = get_user_model()
    if not User.objects.filter(is_superuser=True).exists():
        log("Creating default admin user...")
        User.objects.create_superuser(
            username='admin',
            email='admin@jewellosoft.local',
            password='admin123'
        )
        log("Default admin created (admin / admin123)")
    else:
        log("Admin user already exists")
except Exception as e:
    log_error(f"Admin user creation failed (non-critical): {e}")


try:
    from waitress import serve
    from config.wsgi import application
    from apps.core.background_sync import start_background_sync

    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    host = '127.0.0.1'

    log("Starting Background Sync Thread...")
    start_background_sync()

    log("")
    log("=" * 50)
    log(f"  Waitress WSGI Server starting")
    log(f"  Listening on: http://{host}:{port}")
    log("=" * 50)
    log("")

    serve(application, host=host, port=port)
except Exception as e:
    log_error(f"Server startup FAILED: {e}")
    log_error(traceback.format_exc())
    sys.exit(1)
