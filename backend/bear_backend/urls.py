"""
URL configuration for bear_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from api import views

# Qui associamo gli URL alle "Views" in senso lato. Non dobbiamo avere una schermata per ogni URL.
# Come "View" possiamo anche e semplicemente attaccare una funzione che prende in input i parametri 
# della richiesta HTTP (GET, POST, PUT, ...) e semplicemente invia il JSON di risposta (es. config.json)
urlpatterns = [

    path('admin/config/', views.update_config),
    path('participants/<str:participant_id>/status/', views.manage_participant_status),
    path('participants/<str:participant_id>/telemetry/', views.send_telemetry),

    path('admin/', admin.site.urls),
    path('config/', views.get_config),
    path('participants/', views.enroll_participant)
]
