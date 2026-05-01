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
    
    # prendiamo la lista dei gruppi disponibili dal config.json
    # se i gruppi non sono specificati nel config.json assumiamo che sia un semplice A/B Test con solo TREATMENT e CONTROL
    available_groups = ["TREATMENT", "CONTROL"] 
    config = models.Config.objects.filter(pk=1).first()
    if config and config.data:
        experiment_settings = config.data.get('experiment', {})
        available_groups = experiment_settings.get('groups', available_groups)
    
    # DEBUG: Per ora ho tolto CONTROL per testare più facilmente
    if "CONTROL" in available_groups:  available_groups.remove("CONTROL")
    
    # Contiamo quanti partecipanti hanno GIA' un gruppo assegnato
    assigned_count = models.Participant.objects.exclude(group='UNASSIGNED').count()
    
    # assegniamo il prossimo gruppo in modo ciclico (round-robin) per garantire una distribuzione equilibrata tra i gruppi
    next_group_index = assigned_count % len(available_groups)
    assigned_group = available_groups[next_group_index]
    
    print(f"🎲 [Assegnazione Gruppo] Utente numero {assigned_count + 1} assegnato a: {assigned_group}")
    return assigned_group

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