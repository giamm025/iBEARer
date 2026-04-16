# questo file definisce i serializer responsabili di creare le risposte dell'API

from rest_framework import serializers

class EnrollmentResponseSerializer(serializers.Serializer):
    participantId = serializers.UUIDField(source='id')
    preSurveyLink = serializers.URLField()