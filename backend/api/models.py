import uuid
from django.db import models


# Django si aspetta questo formato:
#   NOME_VARIABILE = 'valore_nel_database', 'Etichetta Umana'
class Group(models.TextChoices):
    CONTROL = 'CONTROL', 'Control'
    TREATMENT = 'TREATMENT', 'Treatment'
    UNASSIGNED = 'UNASSIGNED', 'Unassigned'

class Status(models.TextChoices):
    ENROLLED = 'ENROLLED', 'Enrolled'
    PRE_SURVEY_NOT_COMPLETED = 'PRE-SURVEY-NOT-COMPLETED', 'Pre-survey Not Completed'
    PRE_SURVEY_COMPLETED = 'PRE-SURVEY-COMPLETED', 'Pre-survey Completed'
    EXPERIMENT = 'EXPERIMENT', 'Experiment'
    POST_SURVEY_NOT_COMPLETED = 'POST-SURVEY-NOT-COMPLETED', 'Post-survey Not Completed'
    POST_SURVEY_COMPLETED = 'POST-SURVEY-COMPLETED', 'Post-survey Completed'
    COMPLETED = 'COMPLETED', 'Completed'
    GAVE_UP = 'GAVE_UP', 'Gave Up'

class Participant(models.Model):

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.ENROLLED)
    group = models.CharField(max_length=20, choices=Group.choices, default=Group.UNASSIGNED)

    def __str__(self):
        return str(self.id)


# creiamo una classe Config per memorizzare la struttura di config.json. Poiche vogliamo che ci sia UNA SOLA configurazione 
# per ogni esperimento possiamo implementare un Singleton Pattern (come ho anche fatto per il Pokedex nell'esame di Java)
class Config(models.Model):

    # usiamo JSONField per memorizzare la struttura annidata senza creare decine di tabelle
    data = models.JSONField(default=dict)
    last_updated = models.DateTimeField(auto_now=True)

    # per implementare il Singleton Pattern dobbiamo sovrascrivere (in realta stiamo creando un wrapper per) il metodo save 
    # e forzare l'ID della configurazionea ad 1. in questo modo se proviamo a creare una nuova Config sovrascriviamo sempre 
    # la stessa riga del DB, invece di crearne una nuova 
    def save(self, *args, **kwargs):
        self.pk = 1                     # forza l'ID a 1        
        super().save(*args, **kwargs)   # chiama il save originale

    def __str__(self):
        return f"Global Configuration (Last updated: {self.last_updated})"
    

class TelemetryEvent(models.Model):

    participant = models.ForeignKey(Participant, on_delete=models.CASCADE, related_name='telemetry_events')    
    event_fqn = models.CharField(max_length=255)
    timestamp = models.DateTimeField()
    metadata = models.JSONField(default=dict, blank=True)
    # JSONField è perfetto per i "metadata" perché ogni evento potrebbe avere campi diversi (es. URL, coordinate mouse)

    def __str__(self):
        return f"{self.event_fqn} at {self.timestamp} (Participant: {self.participant.id})"