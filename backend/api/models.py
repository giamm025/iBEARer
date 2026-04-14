from django.db import models

# Create your models here.
class Participant(models.Model):

    id = models.UUIDField(primary_key=True, editable=False)
    status = models.CharField(max_length=50, default="ENROLLED")
    group = models.CharField(max_length=20, default="UNASSIGNED")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return str(self.id)