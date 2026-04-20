import random

from django.http import JsonResponse

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from . import models

# dizionario che associa codice di errore HTTP al relativo messaggio descrittivo
API_ERRORS = {
    400: "Bad Request. Invalid input.",
    401: "Unauthorized. Authentication token is missing or invalid.",
    403: "Forbidden. The user is authenticated but does not have the necessary permissions to perform this specific action (e.g., delete a message that is not theirs).",
    404: "Not Found. The requested resource does not exist.",
    405: "Method Not Allowed. The HTTP method is not supported for this endpoint.",
    409: "Conflict. The request conflicts with the current state.",
    500: "Internal Server Error. An unexpected error occurred on the server."
}

# funzione helper che, dato il codice, crea in automatico la risposta JSON contenente l'Errore (code + message)
def error_response(status_code, custom_message=None):
    message = API_ERRORS.get(status_code, "Unknown Error. An unexpected issue occurred.")

    if custom_message:
        message += " " + custom_message
        
    return JsonResponse({
        "code": str(status_code), 
        "message": message 
    }, status=status_code)

# funzione per assegnare un gruppo al partecipante (per ora facciamo una scelta random 50 e 50)
def assign_group():
    # scelta = random.choice([models.Group.CONTROL, models.Group.TREATMENT])
    # return scelta
    return models.Group.TREATMENT   # DEBUG per ora assegbiamo sempre gruppo trattamento cosi posso vedere se gli interventi funzionano

# funzione helper per inviare un messaggio di aggiornamento dello stato del partecipante alla WebSocket
def notify_status_update(participant):
    
    # reuperiamo il canale riservto a quell'utente
    channel_layer = get_channel_layer()
    
    # async_to_sync fa da "ponte traduttore" tra il mondo sincrono e quello asincrono.
    # Senza di questo la vista HTTP (sincrona) e il Channel Layer della WebSocket (asincrono) non riuscirebbero a 
    # comunicare tra loro, e Python si bloccherebbe. 
    async_to_sync(channel_layer.group_send)(
        f'participant_{participant.id}', 
        {
            'type': 'status_update',      # il nome della funzione asincrona nel consumer
            'status': participant.status,
            'group': participant.group
        }
    )