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
    
