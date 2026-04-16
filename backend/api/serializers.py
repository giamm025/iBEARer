# questo file definisce i serializer responsabili di creare le risposte dell'API

from rest_framework import serializers

class EnrollmentResponseSerializer(serializers.Serializer):
    participantId = serializers.UUIDField(source='id')
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
    id = serializers.UUIDField()
    name = serializers.CharField()
    description = serializers.CharField(required=False, allow_blank=True)
    event_source = serializers.CharField()
    logical_operator = serializers.ChoiceField(choices=["AND", "OR"])
    conditions = ConditionSerializer(many=True)
    apply_interventions = serializers.ListField(child=serializers.CharField())

class InterventionSerializer(serializers.Serializer):
    name = serializers.CharField()
    description = serializers.CharField(required=False, allow_blank=True)
    function_fqn = serializers.CharField()
    payload = serializers.DictField(child=serializers.JSONField(), required=False)

class ConfigSerializer(serializers.Serializer):
    """Mappa l'intero schema Config definito in api.yaml"""
    experiment = ExperimentSettingsSerializer()
    telemetry_settings = TelemetrySettingsSerializer()
    target = TargetSerializer()
    triggers = TriggerSerializer(many=True)
    interventions = InterventionSerializer(many=True)