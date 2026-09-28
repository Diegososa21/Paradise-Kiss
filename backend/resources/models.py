from django.db import models


class resources(models.Model):
    name = models.CharField(max_length=200)
    desc = models.CharField(max_length=200)
    size = models.CharField(max_length=10)
    category = models.CharField(max_length=200)
    manufacurer = models.CharField(max_length=200)
    material = models.CharField(max_length=200)
    gender = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
