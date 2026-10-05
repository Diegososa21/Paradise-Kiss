from django.urls import path

from . import auth_views


urlpatterns = [
    path('csrf/', auth_views.csrf, name='auth-csrf'),
    path('session/', auth_views.session, name='auth-session'),
    path('login/', auth_views.sign_in, name='auth-login'),
    path('activate/', auth_views.activate, name='auth-activate'),
    path('logout/', auth_views.sign_out, name='auth-logout'),
]
