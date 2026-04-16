# --- VECCHI IMPROT ---
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

# --- NUOVI IMPORT DRF ---
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from . import models
from . import serializers
from . import utils

# -------------------------------------------- POST /participants: enrollParticipant --------------------------------------------
@api_view(['POST'])             # dice gia a DRF di accettare solo le richieste POST. Per tutte le altre richieste invia in automatico un Error 405
@permission_classes([AllowAny]) # per ora ignoriamo l'autenticazione, AllowAny permette a chiunque di accedere a questa view anche se non autenticato
def enroll_participant(request):

    try:
        # creazione nuovo partecipante nel DB (l'id viene generato automaticamente nel costruttore)
        participant = models.Participant.objects.create(
            status=models.Participant.Status.ENROLLED,
            group=models.Participant.Group.UNASSIGNED
        )

        # creazione Deep Link
        # DEBUG: Per ora usiamo un link fittizio
        base_form_url = "https://docs.google.com/forms/d/e/IL_TUO_ID_FORM_REALE/viewform"
        pre_survey_link = f"{base_form_url}?usp=pp_url&entry.123456789={participant.id}"

        # prepariamo i dati da mandare al serializer
        response_data = {
            'id': participant.id,
            'preSurveyLink': pre_survey_link
        }

        # il serializer trasforma i dati in JSON secondo la specifica api.yaml e controlla che i dati siano corretti (es. che participant.id sia un UUID valido, che preSurveyLink sia una URL valida, ecc.)
        serializer = serializers.EnrollmentResponseSerializer(response_data)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    # in caso di errore sul DB o problemi inaspettati
    except Exception as e:
        return utils.error_response(500, str(e))

# -------------------------------------------- GET /config: getConfig --------------------------------------------
@api_view(['GET'])
@permission_classes([AllowAny])
def get_config(request):

    try:
        # recuperiamo la configurazione
        config = models.Config.objects.filter(pk=1).first()
        
        # se per puro caso non dovesse esistere => errore 
        if not config or not config.data:
            return utils.error_response(404, "Configurazione non trovata. Il ricercatore deve prima salvarla dalla Dashboard.")
        
        # validiamo il JSON con il serializer => se è valido mandiamo la risposta, altrimenti errore
        serializer = serializers.ConfigSerializer(data=config.data)
        if serializer.is_valid():
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        else:
            return utils.error_response(500, f"Errore interno di struttura configurazione: {serializer.errors}")
    
    except Exception as e:
        return utils.error_response(500, f"Errore imprevisto del server: {str(e)}")

# ------------------------------------- PUT admin/config: updateConfig --------------------------------------
@api_view(['PUT'])
@permission_classes([AllowAny]) 
def update_config(request):

    try:
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
@csrf_exempt
def send_telemetry(request, participant_id):

    if request.method != 'POST':
        return utils.error_response(405)
        
    try:
        # Django riceve i dati grezzi in request.body, li trasformiamo in dizionario Python
        body = json.loads(request.body)
        
        # DEBUG: Per semplicità, ora ci limitiamo a stampare la telemetria ricevuta nel terminale.
        print(f"\n🟢 [TELEMETRIA RICEVUTA da Participant: {participant_id}]")
        print(json.dumps(body, indent=2))
        print("--------------------------------------------------\n")

        # Salviamo la telemetria nel DB

        return JsonResponse({"message": "Batch saved successfully"}, status=201)
        
    except json.JSONDecodeError:
        return utils.error_response(400)
    except Exception as e:
        return utils.error_response(500, str(e))