# --- NUOVI IMPORT DRF ---
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
import copy

from . import models
from . import serializers
from . import utils

import json

# -------------------------------------------- POST /participants: enrollParticipant --------------------------------------------
@api_view(['POST'])             # dice gia a DRF di accettare solo le richieste POST. Per tutte le altre richieste invia in automatico un Error 405
@authentication_classes([])     # dice a DRF di non applicare nessuna autenticazione (es. token, session, ecc.) a questa view
@permission_classes([AllowAny]) # per ora ignoriamo l'autenticazione, AllowAny permette a chiunque di accedere a questa view anche se non autenticato
def enroll_participant(request):

    try:
        # creazione nuovo partecipante nel DB (l'id viene generato automaticamente nel costruttore)
        participant = models.Participant.objects.create(
            status=models.Status.ENROLLED,
            group=models.Group.UNASSIGNED
        )

        # creazione Deep Link
        base_pre_form_url = "https://docs.google.com/forms/d/e/1FAIpQLScUOjPZviDKFnx0Ml1d3sBAtTkjHFFx7YnEuC2J-ZCvnTxJVA/viewform"
        pre_survey_link = f"{base_pre_form_url}?entry.2119809368={participant.id}"

        base_post_form_url = "https://docs.google.com/forms/d/e/1FAIpQLScVnXcdATtuA3C-3TFz1WQx6ip1vAyfJjTUrJ_k5glugbB7Xg/viewform"
        post_survey_link = f"{base_post_form_url}?usp=pp_url&entry.2119809368={participant.id}"

        # prepariamo i dati da mandare al serializer
        response_data = {
            'participantId': participant.id,
            'preSurveyLink': pre_survey_link,
            'postSurveyLink': post_survey_link
        }

        # il serializer trasforma i dati in JSON secondo la specifica api.yaml e controlla che i dati siano corretti (es. che participant.id sia un UUID valido, che preSurveyLink sia una URL valida, ecc.)
        serializer = serializers.EnrollmentResponseSerializer(response_data)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    # in caso di errore sul DB o problemi inaspettati
    except Exception as e:
        return utils.error_response(500, str(e))

# -------------------------------------------- GET /participants/{participantId}/config: getConfig --------------------------------------------
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def get_config(request, participant_id):

    try:
        # recuperiamo il partecipante => se non esiste errore
        participant = models.Participant.objects.filter(id=participant_id).first()
        if not participant:
            return utils.error_response(404, "Partecipante non trovato.")
        
        # recuperiamo la configurazione => se non esiste errore
        config = models.Config.objects.filter(pk=1).first()
        if not config or not config.data:
            return utils.error_response(404, "Configurazione non trovata.")
        
        # filtriamo la configurazione per restituire solo i trigger relativi per il gruppo del partecipante
        filtered_config = filter_config(config, participant.group)
        
        return Response(filtered_config, status=status.HTTP_200_OK)
    
    except Exception as e:
        return utils.error_response(500, f"Errore imprevisto del server: {str(e)}")

def filter_config(config, user_group):

    # creiamo una copia per sicureazza
    filtered_config = copy.deepcopy(config.data)
    
    # creiamo una lista che conterrà solo i trigger relativi al gruppo dell'utente
    filtered_triggers = []
    
    # iteriamo sui trigger originali
    for trigger in  filtered_config.get('triggers', []):
        
        # se il trigger è destinato al gruppo dell'utente
        if user_group in trigger.get('target_groups', []):

            # filtriamo gli interventi
            filtered_interventions = filter_interventions(trigger, user_group)
            trigger['apply_interventions'] = filtered_interventions
            
            # cancelliamo il campo 'target_groups' che all'estensione non serve
            trigger.pop('target_groups', None)
            filtered_triggers.append(trigger)
            
    # sostituiamo i trigger originali con la nostra lista filtrata
    filtered_config['triggers'] = filtered_triggers
    
    return filtered_config

def filter_interventions(trigger, user_group):

    # prendiamo tutti gli interventi
    interventions = trigger.get('apply_interventions', {})

    # prendiamo solo gli intervention_id che hanno il gruppo dell'utente in target_groups
    filtered_interventions = []
    for intervention_id, groups in interventions.items():
        if user_group in groups:
            filtered_interventions.append(intervention_id)
    
    return filtered_interventions

# ------------------------------------- GET admin/config: getMasterConfig --------------------------------------
# ------------------------------------- PUT admin/config: updateConfig --------------------------------------
@api_view(['GET', 'PUT'])
@authentication_classes([])
@permission_classes([AllowAny]) 
def manage_admin_config(request):

    try:

        # se è una GET => resituiamo la configurazione completa (non filtrata) al Master Admin
        if request.method == 'GET':
            config = models.Config.objects.filter(pk=1).first()
            if not config or not config.data:
                return utils.error_response(404, "Configurazione Master non trovata.")
            
            return Response(config.data, status=status.HTTP_200_OK)
        
        # DRF in automatico gia converte i JSOn in dizionari Python leggibili. Dunque ci basta leggere request.data
        serializer = serializers.ConfigSerializer(data=request.data)
        
        # controlliamo che il JSON sia valido (usiamo lo stesso serializer di getConfig)
        if serializer.is_valid():
            
            # aggiorniamo la configurazione nel DB
            config_obj, created = models.Config.objects.update_or_create(
                pk=1,
                defaults={'data': serializer.data}
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        else:
            return utils.error_response(400, f"JSON non valido: {serializer.errors}")
            
    except Exception as e:
        return utils.error_response(500, f"Errore durante il salvataggio della configurazione: {str(e)}")
    
# ------------------------------------- POST /participants/{participantId}/telemetry: sendTelemetry --------------------------------------
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def send_telemetry(request, participant_id):

    print("-" * 50)
    print("📦 PAYLOAD RICEVUTO (request.data):")
    try:
        # Usiamo json.dumps con indent=4 per stamparlo bello incolonnato
        payload_formattato = json.dumps(request.data, indent=4, ensure_ascii=False)
        print(payload_formattato)
    except Exception:
        # Se per qualche motivo DRF non è riuscito a parsarlo come JSON
        print(request.data)
        
    print("="*50 + "\n")

    try:
        # controlliamo che il partecipante esista => se non esiste errore
        participant = models.Participant.objects.filter(id=participant_id).first()
        if not participant:
            return utils.error_response(404, "Partecipante non trovato. Impossibile salvare la telemetria.")

        # validazione della Telemetry Batch (cioe la lista/coda di eventi)
        serializer = serializers.TelemetryBatchSerializer(data=request.data)
        
        # se la Telemetry Batch è valida andiamo a validare i singoli Telemetry Event
        if serializer.is_valid():
            
            events_data = serializer.validated_data.get('events', [])
            telemetry_objects = [
                models.TelemetryEvent(
                    participant=participant,
                    event_fqn=event['event_fqn'],
                    timestamp=event['timestamp'],
                    metadata=event.get('metadata', {})
                )
                for event in events_data
            ]
            models.TelemetryEvent.objects.bulk_create(telemetry_objects)
        # NB. DRF ci permette di salvare TUTTI gli eventi in una sola query usando bulk_create. In alternativa dovremmo usare 
        # .save() come facevamo prima... Ma in quel caso genereremmo una query per ogni Telemetry Event (chiaramente meno efficente) 

            # DEBUG
            print(f"\n🟢 [TELEMETRIA SALVATA per Participant: {participant_id}]")
            print(f"Salvati con successo {len(telemetry_objects)} eventi.")
            print("--------------------------------------------------\n")

            # risposta al client
            return Response(status=status.HTTP_201_CREATED)
            
        else:
            return utils.error_response(400, f"Payload telemetria non valido: {serializer.errors}")
            
    except Exception as e:
        return utils.error_response(500, f"Errore imprevisto durante il salvataggio della telemetria: {str(e)}")
    

# ---------------------------- GET / PUT /participants/{participantId}/status -----------------------------
@api_view(['GET', 'PUT'])
@authentication_classes([])
@permission_classes([AllowAny]) # DEBUG: Prima o poi dovremo mettere l'API Key segreta condivisa con Google Forms
def manage_participant_status(request, participant_id):

    try:
        # controllo che il partecipante esista => se non esiste errore
        participant = models.Participant.objects.filter(id=participant_id).first()
        if not participant:
            return utils.error_response(404, "Partecipante non trovato.")

        # se è una GET semplicemente ritorniamo lo stato
        if request.method == 'GET':
            serializer = serializers.StatusResponseSerializer(participant)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # se è una PUT allora aggiorniamo lo stato
        elif request.method == 'PUT':

            # chiaramente, non solo Google Forms ma chiunque chiami questo endpoint, deve passarci un payload
            # JSON con un campo status (es. {status: PRE-SURVEY-COMPLETED} )
            new_status = request.data.get('status')
            
            # aggiorniamo il Partecipante nel DB (e assegniamo il gruppo A/B)
            participant.status = new_status
            if (participant.status == 'PRE-SURVEY-COMPLETED' and participant.group == 'UNASSIGNED'):
                participant.group = utils.assign_group()
            
            participant.save()

            # mandiamo il messaggio all'estensione tramite WebSocket
            utils.notify_status_update(participant)

            return Response({"message": "Stato aggiornato e notifica inviata"}, status=status.HTTP_200_OK)

    except Exception as e:
        return utils.error_response(500, str(e))
    