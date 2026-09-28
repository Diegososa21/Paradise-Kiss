"""Django settings for the Paradise Kiss API."""

import os
from pathlib import Path

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

for vercel_host_variable in ('VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL'):
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

database_url = os.getenv('DATABASE_URL')
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
    DATABASES = {
        'default': dj_database_url.parse(
            database_url,
            conn_max_age=database_connection_age,
            conn_health_checks=True,
            ssl_require=True,
        )
    }
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
elif DEBUG:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    raise RuntimeError('DATABASE_URL is required when DJANGO_DEBUG is false')

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
for vercel_host_variable in ('VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL'):
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

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

APP_ALLOWED_USERNAMES = {
    username.strip().lower()
    for username in os.getenv('APP_ALLOWED_USERNAMES', 'diego,nico,fabian').split(',')
    if username.strip()
}
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
}
