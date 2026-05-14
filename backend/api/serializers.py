# questo file definisce i serializer responsabili di creare le risposte dell'API

from rest_framework import serializers

class EnrollmentResponseSerializer(serializers.Serializer):
    participantId = serializers.UUIDField()

class EndConditionSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=["ACTIVE_MINUTES_ON_PLATFORM", "ABSOLUTE_DAYS"])
    duration = serializers.FloatField()
    
class ExperimentSettingsSerializer(serializers.Serializer):
    experiment_name = serializers.CharField()
    end_condition = EndConditionSerializer()
    groups = serializers.ListField(child=serializers.CharField(), required=True)

class ModalUISerializer(serializers.Serializer):
    title = serializers.CharField()
    message = serializers.CharField()
    button_text = serializers.CharField()

class SurveyDefinitionSerializer(serializers.Serializer):
    base_url = serializers.URLField()
    id_param = serializers.CharField()
    modal_ui = ModalUISerializer()

class SurveySettingsSerializer(serializers.Serializer):
    pre_survey = SurveyDefinitionSerializer()
    post_survey = SurveyDefinitionSerializer()

class TelemetrySettingsSerializer(serializers.Serializer):
    track_events = serializers.ListField(child=serializers.CharField())
    sync_interval_ms = serializers.IntegerField()

class TargetSerializer(serializers.Serializer):
    url_pattern = serializers.CharField()
    dependency = serializers.CharField()

class ConditionSerializer(serializers.Serializer):
    property = serializers.CharField()
    operator = serializers.ChoiceField(choices=["CONTAINS_ANY", "NOT_CONTAINS_ANY", "EQUALS"])
    value = serializers.ListField(child=serializers.CharField())

class TriggerSerializer(serializers.Serializer):
    id = serializers.CharField() 
    target_groups = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    event_source = serializers.CharField()
    conditions_logical_operator = serializers.ChoiceField(choices=["AND", "OR"],  required=False, default="AND")    
    conditions = ConditionSerializer(many=True)
    apply_interventions = serializers.JSONField()

class InterventionSerializer(serializers.Serializer):
    id = serializers.CharField() 
    function_fqn = serializers.CharField()
    payload = serializers.JSONField(required=False, default=dict)

class ConfigSerializer(serializers.Serializer):
    """Mappa l'intero schema Config definito in api.yaml"""
    experiment = ExperimentSettingsSerializer()
    survey_settings = SurveySettingsSerializer()
    telemetry_settings = TelemetrySettingsSerializer()
    target = TargetSerializer()
    triggers = TriggerSerializer(many=True)
    interventions = InterventionSerializer(many=True)


class TelemetryEventSerializer(serializers.Serializer):
    event_fqn = serializers.CharField()
    timestamp = serializers.DateTimeField()
    metadata = serializers.JSONField(required=False, default=dict)

class TelemetryBatchSerializer(serializers.Serializer):
    # Validiamo l'intero array di eventi
    events = TelemetryEventSerializer(many=True)

class StatusResponseSerializer(serializers.Serializer):
    status = serializers.CharField()
    group = serializers.CharField()