# --- VECCHI IMPROT ---
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

# --- NUOVI IMPORT DRF ---
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from .models import Participant
from .serializers import EnrollmentResponseSerializer
from .utils import error_response

# POST /participants: enrollParticipant
@api_view(['POST'])             # dice gia a DRF di accettare solo le richieste POST. Per tutte le altre richieste invia in automatico un Error 405
@permission_classes([AllowAny]) # per ora ignoriamo l'autenticazione, AllowAny permette a chiunque di accedere a questa view anche se non autenticato
def enroll_participant(request):

    try:
        # creazione nuovo partecipante nel DB (l'id viene generato automaticamente nel costruttore)
        participant = Participant.objects.create(
            status=Participant.Status.ENROLLED,
            group=Participant.Group.UNASSIGNED
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
        serializer = EnrollmentResponseSerializer(response_data)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    # in caso di errore sul DB o problemi inaspettati
    except Exception as e:
        return error_response(500, str(e))

# GET /config: getConfig
@csrf_exempt
def get_config(request):

    if request.method != 'GET':
        return error_response(405)
        
    config = {
        "triggers": [
        {
            "id": "trigger_contains_conspiracy",
            "event_source": "adapters.events.SearchResultsLoadedEvent",
            "logical_operator": "AND",
            "conditions": [
                {
                    "property": "search_query",
                    "operator": "CONTAINS_ANY",
                    "value": ["epstein", "vaccini", "terra piatta", "5g"]
                }
            ],
            "apply_interventions": [
                "apply_red_border",
                "inject_debunking"
            ]
        },
        
        {
            "id": "trigger_NOT_contains_conspiracy",
            "event_source": "adapters.events.SearchResultsLoadedEvent",
            "logical_operator": "AND",
            "conditions": [
                {
                    "property": "search_query",
                    "operator": "NOT_CONTAINS_ANY",
                    "value": ["epstein", "vaccini", "terra piatta", "5g"]
                }
            ],
            "apply_interventions": [
                "apply_green_border",
            ]
        }
        ],

        "interventions": [
            {
                "id": "apply_red_border",
                "function_fqn": "interventions.debug.applyBorder",
                "payload": {
                    "border_style": "30px solid red"
                }
            },

            {
                "id": "apply_green_border",
                "function_fqn": "interventions.debug.applyBorder",
                "payload": {
                    "border_style": "30px solid green"
                }
            },

            {
                "id": "inject_debunking",
                "function_fqn": "interventions.ui.showDebunkingBanner",
                "payload": {}
            }
        ]
    }
    
    return JsonResponse(config, status=200)


# POST /participants/{participantId}/telemetry: sendTelemetry
@csrf_exempt
def send_telemetry(request, participant_id):

    if request.method != 'POST':
        return error_response(405)
        
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
        return error_response(400)
    except Exception as e:
        return error_response(500, str(e))