# questo file è l'equivalente di urls.py ma per le WebSockets. 
# qui definiamo a quali URL rispondono i nostri consumer.

from django.urls import re_path
from . import consumers

# quando l'estensione manda un messaggio tramite WebSocket a ws://localhost:8000/ws/participants/{participant_id}/status/
# usiamo StatusConsumer
websocket_urlpatterns = [
    re_path(r'ws/participants/(?P<participant_id>[0-9a-f-]+)/status/$', consumers.StatusConsumer.as_asgi()),
]