import os
import sys
from pathlib import Path
import shutil
import site
from PyInstaller.utils.hooks import collect_submodules, collect_data_files


BACKEND_DIR = Path(__file__).resolve().parent
RUN_SCRIPT  = BACKEND_DIR / "run_waitress.py"
DIST_DIR    = BACKEND_DIR / "dist"
BUILD_DIR   = BACKEND_DIR / "build"

os.environ['PYTHONPATH'] = str(BACKEND_DIR) + os.pathsep + os.environ.get('PYTHONPATH', '')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')


import django
django.setup()

import PyInstaller.__main__

if DIST_DIR.exists():
    shutil.rmtree(DIST_DIR)
if BUILD_DIR.exists():
    shutil.rmtree(BUILD_DIR)

HIDDEN_IMPORTS = [
    'waitress',
    'sqlite3',
    'django.db.backends.sqlite3',
    'config',
    'config.settings',
    'config.settings.base',
    'config.urls',
    'config.wsgi',

    *collect_submodules('django.contrib.admin'),
    *collect_submodules('django.contrib.auth'),
    *collect_submodules('django.contrib.contenttypes'),
    *collect_submodules('django.contrib.sessions'),
    *collect_submodules('django.contrib.messages'),
    *collect_submodules('django.contrib.staticfiles'),
    *collect_submodules('django.core.management'),

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

    'core.pagination',
    'core.exceptions',
]

HIDDEN_IMPORTS.extend(collect_submodules('django.template'))
HIDDEN_IMPORTS.extend(collect_submodules('django.templatetags'))
HIDDEN_IMPORTS.extend(collect_submodules('django.contrib.admin.templatetags'))
HIDDEN_IMPORTS.extend(collect_submodules('django.contrib.staticfiles.templatetags'))
HIDDEN_IMPORTS.extend(collect_submodules('django.core.cache'))
HIDDEN_IMPORTS.extend(collect_submodules('django.core.management'))
HIDDEN_IMPORTS.extend(collect_submodules('django.db.backends.sqlite3'))
HIDDEN_IMPORTS.extend(collect_submodules('django.views'))

HIDDEN_IMPORTS.extend(collect_submodules('django.middleware'))
HIDDEN_IMPORTS.extend(collect_submodules('django.contrib.sessions.middleware'))
HIDDEN_IMPORTS.extend(collect_submodules('django.contrib.auth.middleware'))
HIDDEN_IMPORTS.extend(collect_submodules('django.contrib.messages.middleware'))
HIDDEN_IMPORTS.extend(collect_submodules('django.contrib.auth.password_validation'))
HIDDEN_IMPORTS.extend(collect_submodules('rest_framework.filters'))
HIDDEN_IMPORTS.extend(collect_submodules('rest_framework.permissions'))
HIDDEN_IMPORTS.extend(collect_submodules('rest_framework.templatetags'))

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
    
    for optional_module in ['middleware', 'crypto', 'signals', 'services', 'admin', 'forms', 'filters']:
        mod_file = BACKEND_DIR / "apps" / app / f"{optional_module}.py"
        mod_dir  = BACKEND_DIR / "apps" / app / optional_module
        if mod_file.exists() or mod_dir.exists():
            HIDDEN_IMPORTS.append(f'{app_base}.{optional_module}')
    
    services_dir = BACKEND_DIR / "apps" / app / "services"
    if services_dir.is_dir():
        for py_file in services_dir.glob("*.py"):
            if py_file.name != "__init__.py":
                HIDDEN_IMPORTS.append(f'{app_base}.services.{py_file.stem}')


    migrations_dir = BACKEND_DIR / "apps" / app / "migrations"
    if migrations_dir.exists():
        for py_file in migrations_dir.glob("*.py"):
            if py_file.name == "__init__.py":
                HIDDEN_IMPORTS.append(f'{app_base}.migrations')
            else:
                HIDDEN_IMPORTS.append(f'{app_base}.migrations.{py_file.stem}')


DATAS = []

templates_dir = BACKEND_DIR / "templates"
if templates_dir.exists():
    DATAS.append((str(templates_dir), "templates"))

config_enc_path = BACKEND_DIR / "config.json.enc"
config_key_path = BACKEND_DIR / ".config_key"
config_plain_path = BACKEND_DIR / "config.json"
if config_enc_path.exists():
    DATAS.append((str(config_enc_path), "."))
    print(f"  [OK] Bundling ENCRYPTED config: {config_enc_path}")
    if config_key_path.exists():
        DATAS.append((str(config_key_path), "."))
        print(f"  [OK] Bundling ENCRYPTION KEY: {config_key_path}")
elif config_plain_path.exists():
    DATAS.append((str(config_plain_path), "."))
    print(f"  [WARN] Bundling PLAIN config (dev mode): {config_plain_path}")

DATAS.extend(collect_data_files('django', include_py_files=False))
DATAS.extend(collect_data_files('rest_framework', include_py_files=False))
DATAS.extend(collect_data_files('django_filters', include_py_files=False))
DATAS.extend(collect_data_files('rest_framework_simplejwt', include_py_files=False))

print("=" * 60)
print("  JewelloSoft Backend — Production Build")
print("=" * 60)

cmd = [
    str(RUN_SCRIPT),
    '--name=backend',
    '--onedir',
    '--noconfirm',
    '--clean',
    '--console',
]


for imp in HIDDEN_IMPORTS:
    cmd.append(f'--hidden-import={imp}')

for src, dst in DATAS:
    cmd.append(f'--add-data={src}{os.pathsep}{dst}')


print(f"Entry Script    : {RUN_SCRIPT}")
print(f"Output Dir      : {DIST_DIR}")
print(f"Hidden Imports  : {len(HIDDEN_IMPORTS)}")
print(f"Data Files      : {len(DATAS)}")
print("\nBuilding EXE...\n")

PyInstaller.__main__.run(cmd)


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