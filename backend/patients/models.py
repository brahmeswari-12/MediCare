from django.conf import settings
from django.db import models


class Gender(models.TextChoices):
    MALE = "MALE", "Male"
    FEMALE = "FEMALE", "Female"
    OTHER = "OTHER", "Other"
    UNDISCLOSED = "UNDISCLOSED", "Prefer not to say"


class Patient(models.Model):
    """Patient-specific profile. Name, email and phone live on the User."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="patient_profile"
    )
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=12, choices=Gender.choices)
    address = models.TextField(max_length=500)
    blood_group = models.CharField(max_length=5, blank=True)
    emergency_contact_name = models.CharField(max_length=150, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.user.full_name
