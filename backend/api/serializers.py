# questo file definisce i serializer responsabili di creare le risposte dell'API

from rest_framework import serializers

class EnrollmentResponseSerializer(serializers.Serializer):
    participantId = serializers.UUIDField()
    preSurveyLink = serializers.URLField()


class ExperimentSettingsSerializer(serializers.Serializer):
    experiment_name = serializers.CharField()
    experiment_duration_minutes = serializers.IntegerField()

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
    logical_operator = serializers.ChoiceField(choices=["AND", "OR"])
    conditions = ConditionSerializer(many=True)
    apply_interventions = serializers.JSONField()

class InterventionSerializer(serializers.Serializer):
    id = serializers.CharField() 
    function_fqn = serializers.CharField()
    payload = serializers.JSONField(required=False, default=dict)

class ConfigSerializer(serializers.Serializer):
    """Mappa l'intero schema Config definito in api.yaml"""
    experiment = ExperimentSettingsSerializer()
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