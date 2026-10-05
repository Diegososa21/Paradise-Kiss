"""Django settings for the Paradise Kiss API."""

import os
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import dj_database_url
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

DEBUG = os.getenv('DJANGO_DEBUG', 'false').lower() == 'true'

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'unsafe-development-key')
if not DEBUG and SECRET_KEY == 'unsafe-development-key':
    raise RuntimeError('DJANGO_SECRET_KEY is required when DJANGO_DEBUG is false')

ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
    if host.strip()
]

# Hostnames Vercel assigns to a deployment, its branch alias and the production domain.
VERCEL_HOST_VARIABLES = ('VERCEL_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_PRODUCTION_URL')

for vercel_host_variable in VERCEL_HOST_VARIABLES:
    vercel_host = os.getenv(vercel_host_variable)
    if vercel_host and vercel_host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(vercel_host)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'resources',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'

# Connection parameters libpq/psycopg understands. The Supabase-Vercel integration
# adds its own query parameters (for example "supa=..."), which psycopg rejects.
LIBPQ_QUERY_PARAMETERS = {'sslmode', 'sslrootcert', 'connect_timeout', 'application_name'}


def vercel_postgres_url():
    """POSTGRES_URL from the Supabase integration on Vercel, cleaned for psycopg."""
    url = os.getenv('POSTGRES_URL')
    if not url:
        return None
    parts = urlsplit(url)
    query = [
        (key, value)
        for key, value in parse_qsl(parts.query)
        if key in LIBPQ_QUERY_PARAMETERS
    ]
    return urlunsplit(parts._replace(query=urlencode(query)))


database_url = os.getenv('DATABASE_URL') or vercel_postgres_url()
database_name = os.getenv('DB_NAME') or os.getenv('DB_Name')
database_user = os.getenv('DB_USER')
database_password = os.getenv('DB_PASSWORD') or os.getenv('DB_Password')
database_host = os.getenv('DB_HOST') or os.getenv('DB_Host')
database_port = os.getenv('DB_PORT') or os.getenv('DB_Port') or '5432'
database_pool_mode = os.getenv('DB_POOL_MODE', 'transaction').lower()
use_sqlite = os.getenv('DJANGO_USE_SQLITE', 'false').lower() == 'true'
database_connection_age = int(os.getenv('DB_CONN_MAX_AGE', '0' if DEBUG else '60'))

if database_host and 'pooler.supabase.com' in database_host and database_pool_mode == 'transaction':
    database_port = '6543'

if use_sqlite:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
elif database_url:
    database_config = dj_database_url.parse(
        database_url,
        conn_max_age=database_connection_age,
        conn_health_checks=True,
        ssl_require=True,
    )
    if database_pool_mode == 'transaction':
        database_config.setdefault('OPTIONS', {})['prepare_threshold'] = None
    DATABASES = {'default': database_config}
elif all([database_name, database_user, database_password, database_host]):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': database_name,
            'USER': database_user,
            'PASSWORD': database_password,
            'HOST': database_host,
            'PORT': database_port,
            'CONN_MAX_AGE': database_connection_age,
            'CONN_HEALTH_CHECKS': True,
            'OPTIONS': {
                'sslmode': 'require',
                'prepare_threshold': None,
            },
        }
    }
else:
    raise RuntimeError(
        'Supabase database configuration is missing. Copy backend/.env.example '
        'to backend/.env and ask the project owner for DB_PASSWORD. To use an '
        'isolated SQLite database intentionally, set DJANGO_USE_SQLITE=true.'
    )

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:4200').rstrip('/')

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        'DJANGO_CORS_ALLOWED_ORIGINS',
        'http://localhost:4200,http://127.0.0.1:4200',
    ).split(',')
    if origin.strip()
]

CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        'DJANGO_CSRF_TRUSTED_ORIGINS',
        'http://localhost:4200,http://127.0.0.1:4200',
    ).split(',')
    if origin.strip()
]

frontend_origins = [FRONTEND_URL]
for vercel_host_variable in VERCEL_HOST_VARIABLES:
    vercel_host = os.getenv(vercel_host_variable)
    if vercel_host:
        frontend_origins.append(f'https://{vercel_host}')

for frontend_origin in frontend_origins:
    if frontend_origin not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(frontend_origin)
    if frontend_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(frontend_origin)

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_HSTS_SECONDS = int(os.getenv('DJANGO_SECURE_HSTS_SECONDS', '0'))

EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
# Gmail only needs EMAIL_HOST_USER and an app password in EMAIL_HOST_PASSWORD.
email_host = os.getenv('EMAIL_HOST', '') or (
    'smtp.gmail.com' if EMAIL_HOST_USER and EMAIL_HOST_PASSWORD else ''
)
EMAIL_BACKEND = os.getenv(
    'DJANGO_EMAIL_BACKEND',
    (
        'django.core.mail.backends.smtp.EmailBackend'
        if email_host
        else 'django.core.mail.backends.console.EmailBackend'
    ),
)
EMAIL_HOST = email_host
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'true').lower() == 'true'
EMAIL_USE_SSL = os.getenv('EMAIL_USE_SSL', 'false').lower() == 'true'
EMAIL_TIMEOUT = int(os.getenv('EMAIL_TIMEOUT', '10'))
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL') or (
    f'Paradise Kiss <{EMAIL_HOST_USER}>'
    if '@' in EMAIL_HOST_USER
    else 'Paradise Kiss <no-reply@localhost>'
)
INVENTORY_EMAIL_NOTIFICATIONS_ENABLED = (
    os.getenv('INVENTORY_EMAIL_NOTIFICATIONS_ENABLED', 'true').lower() == 'true'
)
INVENTORY_EMAIL_SUBJECT_PREFIX = os.getenv(
    'INVENTORY_EMAIL_SUBJECT_PREFIX',
    '[Paradise Kiss Lager]',
)

PASSWORD_RESET_TIMEOUT = int(os.getenv('PASSWORD_RESET_TIMEOUT', '86400'))

CSRF_COOKIE_NAME = 'XSRF-TOKEN'
CSRF_HEADER_NAME = 'HTTP_X_XSRF_TOKEN'
CORS_ALLOW_CREDENTIALS = True
SESSION_COOKIE_AGE = int(os.getenv('SESSION_COOKIE_AGE', '28800'))
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'resources.permissions.IsApprovedAppUser',
    ],
    'DEFAULT_THROTTLE_RATES': {
        # Questions per team member to the KI-Assistent (protects the free Gemini quota).
        'assistant': os.getenv('ASSISTANT_RATE_LIMIT', '30/hour'),
    },
}

# KI-Assistent (Google Gemini, free tier). Without a key the assistant answers
# with the built-in rule-based analysis and sends nothing outside the server.
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-3.8-flash')
# Tried in order when the main model is overloaded (503) or out of free quota (429).
GEMINI_FALLBACK_MODELS = [
    model.strip()
    for model in os.getenv('GEMINI_FALLBACK_MODELS', 'gemini-3.5-flash-lite').split(',')
    if model.strip()
]
GEMINI_TIMEOUT_SECONDS = int(os.getenv('GEMINI_TIMEOUT_SECONDS', '15'))
