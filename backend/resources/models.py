from django.db import models

class Manufacturer(models.Model):
    name = models.CharField(max_length=200, unique=True)
    location = models.CharField(max_length=200)

    def __str__(self):
        return self.name

class Category(models.Model):
    name = models.CharField(max_length=200, unique=True)

    def __str__(self):
        return self.name

class Gender(models.Model):
    name = models.CharField(max_length=200, unique=True)

    def __str__(self):
        return self.name

class resources(models.Model):
    name = models.CharField(max_length=200)
    amount = models.IntegerField()
    desc = models.CharField(max_length=200)
    size = models.CharField(max_length=10)
    material = models.CharField(max_length=200)
    category = models.ForeignKey(Category, on_delete=models.PROTECT)
    manufacturer = models.ForeignKey(Manufacturer, on_delete=models.PROTECT)
    gender = models.ForeignKey(Gender, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
