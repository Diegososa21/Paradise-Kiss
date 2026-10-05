from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('auth/', include('resources.auth_urls')),
    path('tables/', include('resources.urls')),
]
