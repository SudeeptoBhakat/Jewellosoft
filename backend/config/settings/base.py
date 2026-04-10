import os
from pathlib import Path
from datetime import timedelta
import sys

# Load local config system
# We import loader like this because settings package is sometimes loaded differently
base_dir_parent = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(base_dir_parent))
from config.loader import load_config

APP_CONFIG = load_config()

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Support dynamic user data path for Electron packaging
USER_DATA_PATH = os.environ.get('JEWELLOSOFT_DATA_PATH')
if USER_DATA_PATH:
    USER_DATA_DIR = Path(USER_DATA_PATH)
    USER_DATA_DIR.mkdir(parents=True, exist_ok=True)
else:
    USER_DATA_DIR = BASE_DIR

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'unsafe-fallback-key-replace-in-prod')
DEBUG = True
ALLOWED_HOSTS = ['*']

# ── Supabase Config ──────────────────────────────────────────────────
SUPABASE_URL = APP_CONFIG.get("SUPABASE_URL")
SUPABASE_ANON_KEY = APP_CONFIG.get("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = APP_CONFIG.get("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_JWT_SECRET = APP_CONFIG.get("SUPABASE_JWT_SECRET")

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    
    # Local Apps
    'apps.accounts',
    'apps.billing',
    'apps.inventory',
    'apps.orders',
    'apps.rates',
    'apps.payments',
    'apps.customers',
    'apps.core',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'apps.accounts.middleware.SupabaseAuthMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': USER_DATA_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True
ROOT_URLCONF = 'config.urls'

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
STATICFILES_DIRS = []
static_dir = BASE_DIR / 'static'
if static_dir.exists():
    STATICFILES_DIRS.append(static_dir)
# ── Media files (product images, etc.) ────────────────────────────────
MEDIA_URL = '/media/'
MEDIA_ROOT = USER_DATA_DIR / 'media'
MEDIA_ROOT.mkdir(exist_ok=True)

# ── REST Framework Global Config ─────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.StandardPagination',
    'PAGE_SIZE': 50,
    'EXCEPTION_HANDLER': 'core.exceptions.custom_exception_handler',
}

# ── SimpleJWT Config ─────────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ── CORS Config ──────────────────────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'x-user-email',
    'x-user-id',
]

# ── Logging ──────────────────────────────────────────────────────────
LOG_DIR = USER_DATA_DIR / 'logs'
LOG_DIR.mkdir(exist_ok=True)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} {name} — {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': LOG_DIR / 'jewellosoft.log',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'jewellosoft': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'jewellosoft.api': {
            'handlers': ['console', 'file'],
            'level': 'WARNING',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console', 'file'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}
