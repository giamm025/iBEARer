# questo file è l'equivalente di view.py ma per le WebSockets.
# qui definiamo i "consumer", cioè le classi che gestiscono le connessioni WebSocket e i messaggi.

import json
from channels.generic.websocket import AsyncWebsocketConsumer

class StatusConsumer(AsyncWebsocketConsumer):
    
    async def connect(self):
        # recuperiamo l'ID dall'URL di connessione
        self.participant_id = self.scope['url_route']['kwargs']['participant_id']
        self.room_group_name = f'participant_{self.participant_id}'

        # aggiungiamo questa connessione al gruppo del partecipante (così possiamo inviare messaggi a tutti i dispositivi connessi di quel partecipante)
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        # accettiamo la connessione WebSocket
        await self.accept()

    async def disconnect(self, close_code):
        # rimuoviamo l'estensione dal gruppo quando si disconnette
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # funzione utilizzata quando riceviamo un messaggio di "status_update" dal Webhook di Google Forms
    async def status_update(self, event):

        # invia i dati formattati in JSON
        await self.send(text_data=json.dumps({
            'status': event['status'],
            'group': event['group']
        }))