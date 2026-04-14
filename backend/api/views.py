from django.shortcuts import render
import json
import uuid
from . import models
from .utils import error_response
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

# POST /participants: enrollParticipant
@csrf_exempt
def enroll_participant(request):

    if request.method != 'POST':
        return error_response(405)
        
    # generazione UUID
    new_participant_id = str(uuid.uuid4())
    
    # creazione Deep Link 
    base_form_url = "https://docs.google.com/forms/d/e/IL_TUO_ID_FORM_REALE/viewform"
    pre_survey_link = f"{base_form_url}?usp=pp_url&entry.123456789={new_participant_id}"

    # aggiungiamo il nuovo partecipante al DB
    '''new_participant = models.Participant.objects.create(
        id=new_participant_id,
        status="ENROLLED",
        group="UNASSIGNED"
    )'''

    # invio risposta
    return JsonResponse({
        "participantId": new_participant_id,
        "preSurveyLink": pre_survey_link
    }, status=201)


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