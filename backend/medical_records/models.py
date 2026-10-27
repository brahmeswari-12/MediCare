from django.conf import settings
from django.db import models


class MedicalRecord(models.Model):
    """Consultation record written by the treating doctor for one appointment.

    Patients only see a record once the doctor releases it."""

    appointment = models.OneToOneField(
        "appointments.Appointment", on_delete=models.PROTECT, related_name="medical_record"
    )
    symptoms = models.TextField(blank=True, max_length=2000)
    diagnosis = models.TextField(max_length=2000)
    notes = models.TextField(blank=True, max_length=5000, help_text="Consultation notes")
    follow_up_instructions = models.TextField(blank=True, max_length=2000)
    follow_up_date = models.DateField(null=True, blank=True)
    is_released = models.BooleanField(default=False, db_index=True)
    released_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Record for {self.appointment.reference}"


class Prescription(models.Model):
    medical_record = models.ForeignKey(MedicalRecord, on_delete=models.CASCADE, related_name="prescriptions")
    notes = models.TextField(blank=True, max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class PrescriptionItem(models.Model):
    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name="items")
    medicine_name = models.CharField(max_length=150)
    dosage = models.CharField(max_length=100, help_text="e.g. 500 mg")
    frequency = models.CharField(max_length=100, help_text="e.g. Twice daily after meals")
    duration = models.CharField(max_length=100, help_text="e.g. 5 days")
    instructions = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["id"]
