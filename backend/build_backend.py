import os
import sys
from pathlib import Path
import shutil
import site
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

# ────────────────────────────────────────────────────────────────
# Paths
# ────────────────────────────────────────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parent
RUN_SCRIPT  = BACKEND_DIR / "run_waitress.py"
DIST_DIR    = BACKEND_DIR / "dist"
BUILD_DIR   = BACKEND_DIR / "build"

# 🔥 CRITICAL: Fix for "AppRegistryNotReady" inside PyInstaller hooks
# PyInstaller hooks run in isolated subprocesses. They need PYTHONPATH 
# explicitly set to find your local apps during hook execution.
os.environ['PYTHONPATH'] = str(BACKEND_DIR) + os.pathsep + os.environ.get('PYTHONPATH', '')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')

# Call django setup in this process as well
import django
django.setup()

import PyInstaller.__main__

# Clean previous builds
if DIST_DIR.exists():
    shutil.rmtree(DIST_DIR)
if BUILD_DIR.exists():
    shutil.rmtree(BUILD_DIR)

# ────────────────────────────────────────────────────────────────
# Minutely Specified Hidden Imports
# ────────────────────────────────────────────────────────────────
# We avoid --collect-all because it indiscriminately imports submodules
# and triggers AppRegistryNotReady in things like 'rest_framework.schemas'.
HIDDEN_IMPORTS = [
    # Server and DB
    'waitress',
    'sqlite3',
    'django.db.backends.sqlite3',
    
    # Core Application Config
    'config',
    'config.settings',
    'config.settings.base',
    'config.urls',
    'config.wsgi',

    # Django built-in apps and core modules required by base.py
    # Statically declaring the roots fails to inherit their internal `apps.py` AppConfigs,
    # causing 'AppConfig object has no attribute default_site' or missing middlewares.
    *collect_submodules('django.contrib.admin'),
    *collect_submodules('django.contrib.auth'),
    *collect_submodules('django.contrib.contenttypes'),
    *collect_submodules('django.contrib.sessions'),
    *collect_submodules('django.contrib.messages'),
    *collect_submodules('django.contrib.staticfiles'),
    *collect_submodules('django.core.management'),

    # Third Party Libraries (Only what's minutely required)
    'rest_framework',
    'rest_framework.authentication',
    'rest_framework.parsers',
    'rest_framework.negotiation',
    'rest_framework.metadata',
    'rest_framework.permissions',
    'rest_framework.pagination',
    'rest_framework_simplejwt',
    "rest_framework_simplejwt.authentication",
    "rest_framework_simplejwt.tokens",
    "rest_framework_simplejwt.views",
    'rest_framework_simplejwt.token_blacklist',
    'rest_framework_simplejwt.state',
    'corsheaders',
    'corsheaders.middleware',
    'django_filters',
    'django_filters.rest_framework',
    'cryptography',
    'cryptography.fernet',
    'supabase',

    # Dynamic project classes defined in settings
    'core.pagination',
    'core.exceptions',
]

# 🚀 BULLETPROOF GUARANTEE: Use PyInstaller's safe internal analyzer to fetch 
# all dynamically loaded core submodules so Waitress has everything at runtime!
HIDDEN_IMPORTS.extend(collect_submodules('django.template')) # Fixes loader_tags/defaulttags/defaultfilters
HIDDEN_IMPORTS.extend(collect_submodules('django.templatetags'))
HIDDEN_IMPORTS.extend(collect_submodules('django.contrib.admin.templatetags'))
HIDDEN_IMPORTS.extend(collect_submodules('django.contrib.staticfiles.templatetags'))
HIDDEN_IMPORTS.extend(collect_submodules('django.core.cache'))
HIDDEN_IMPORTS.extend(collect_submodules('django.core.management')) # Explicitly pack core CLI commands like migrate
HIDDEN_IMPORTS.extend(collect_submodules('django.db.backends.sqlite3'))
HIDDEN_IMPORTS.extend(collect_submodules('django.views')) # Secures runtime defaults like csrf.csrf_failure and debug views

# 🔥 Explicit Middlewares, Validators and Filters loaded via settings.py Strings
HIDDEN_IMPORTS.extend(collect_submodules('django.middleware'))
HIDDEN_IMPORTS.extend(collect_submodules('django.contrib.sessions.middleware'))
HIDDEN_IMPORTS.extend(collect_submodules('django.contrib.auth.middleware'))
HIDDEN_IMPORTS.extend(collect_submodules('django.contrib.messages.middleware'))
HIDDEN_IMPORTS.extend(collect_submodules('django.contrib.auth.password_validation'))
HIDDEN_IMPORTS.extend(collect_submodules('rest_framework.filters'))
HIDDEN_IMPORTS.extend(collect_submodules('rest_framework.permissions'))
HIDDEN_IMPORTS.extend(collect_submodules('rest_framework.templatetags'))

# Add our custom project apps
PROJECT_APPS = [
    'accounts',
    'billing',
    'inventory',
    'orders',
    'rates',
    'payments',
    'customers',
    'core',
]

for app in PROJECT_APPS:
    app_base = f'apps.{app}'
    HIDDEN_IMPORTS.extend([
        app_base,
        f'{app_base}.apps',
        f'{app_base}.urls',
        f'{app_base}.views',
        f'{app_base}.models',
        f'{app_base}.serializers',
    ])
    
    # Optional per-app modules loaded dynamically by Django
    for optional_module in ['middleware', 'crypto', 'signals', 'services', 'admin', 'forms', 'filters']:
        mod_file = BACKEND_DIR / "apps" / app / f"{optional_module}.py"
        mod_dir  = BACKEND_DIR / "apps" / app / optional_module
        if mod_file.exists() or mod_dir.exists():
            HIDDEN_IMPORTS.append(f'{app_base}.{optional_module}')
    
    # Services subdirectory (e.g. apps.core.services.supabase)
    services_dir = BACKEND_DIR / "apps" / app / "services"
    if services_dir.is_dir():
        for py_file in services_dir.glob("*.py"):
            if py_file.name != "__init__.py":
                HIDDEN_IMPORTS.append(f'{app_base}.services.{py_file.stem}')

    # 🔥 CRITICAL EXPLICIT MIGRATIONS: 
    # Must be python hidden-imports, NOT regular --add-data!
    migrations_dir = BACKEND_DIR / "apps" / app / "migrations"
    if migrations_dir.exists():
        for py_file in migrations_dir.glob("*.py"):
            if py_file.name == "__init__.py":
                HIDDEN_IMPORTS.append(f'{app_base}.migrations')
            else:
                HIDDEN_IMPORTS.append(f'{app_base}.migrations.{py_file.stem}')

# ────────────────────────────────────────────────────────────────
# Data Bundling (Templates + Static DATA ONLY)
# ────────────────────────────────────────────────────────────────
DATAS = []

# Project Templates
templates_dir = BACKEND_DIR / "templates"
if templates_dir.exists():
    DATAS.append((str(templates_dir), "templates"))

# Explicitly pack config.json
config_path = BACKEND_DIR / "config.json"
if config_path.exists():
    DATAS.append((str(config_path), "."))

# Add guaranteed internal bindings for Django and DRF Data (Templates, Localization, CSS/JS)
# Using collect_data_files statically guarantees flawless collection of .mo translation files
# which prevents 'No translation files found for default language en-us' crashes!
DATAS.extend(collect_data_files('django', include_py_files=False))
DATAS.extend(collect_data_files('rest_framework', include_py_files=False))
DATAS.extend(collect_data_files('django_filters', include_py_files=False))
DATAS.extend(collect_data_files('rest_framework_simplejwt', include_py_files=False))

# ────────────────────────────────────────────────────────────────
# PyInstaller Command
# ────────────────────────────────────────────────────────────────
print("=" * 60)
print("  JewelloSoft Backend — Production Build")
print("=" * 60)

cmd = [
    str(RUN_SCRIPT),
    '--name=backend',
    '--onedir', # Industry standard for Electron wraps: avoids %TEMP% extraction delays and aligns path to backend/backend.exe
    '--noconfirm',
    '--clean',
    '--console',
]

# 1. Add all explicit hidden modules
for imp in HIDDEN_IMPORTS:
    cmd.append(f'--hidden-import={imp}')

# 2. Add explicit data folders
for src, dst in DATAS:
    cmd.append(f'--add-data={src}{os.pathsep}{dst}')


print(f"Entry Script    : {RUN_SCRIPT}")
print(f"Output Dir      : {DIST_DIR}")
print(f"Hidden Imports  : {len(HIDDEN_IMPORTS)}")
print(f"Data Files      : {len(DATAS)}")
print("\nBuilding EXE...\n")

PyInstaller.__main__.run(cmd)

# ────────────────────────────────────────────────────────────────
# Verify Build
# ────────────────────────────────────────────────────────────────
# Since we use --onedir, the exe is nested inside the app folder
exe_path = DIST_DIR / "backend" / "backend.exe"

if exe_path.exists():
    size_mb = exe_path.stat().st_size / (1024 * 1024)

    print("\n" + "=" * 60)
    print("BUILD SUCCESSFUL")
    print(f"EXE Path : {exe_path}")
    print(f"Size     : {size_mb:.1f} MB")
    print("=" * 60)
else:
    print("\n" + "=" * 60)
    print("BUILD FAILED — backend.exe not found")
    print("=" * 60)
    sys.exit(1)