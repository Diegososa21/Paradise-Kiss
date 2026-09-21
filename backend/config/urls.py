from django.urls import path, re_path
from inventory import views

urlpatterns = [
    path('api/status/', views.status),
    path('api/sources/', views.sources),
    path('api/login/', views.login),
    path('api/snapshot/', views.snapshot),
    path('api/command/', views.command),
    path('', views.frontend),
    re_path(r'^(?P<path>(?:assets|css|js)/.+)$', views.frontend_asset),
]
