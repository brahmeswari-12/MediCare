import secrets

from django.conf import settings
from django.db import models
from django.db.models import F, Q


class AppointmentStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    CONFIRMED = "CONFIRMED", "Confirmed"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


# Statuses that occupy a doctor's time slot.
ACTIVE_STATUSES = (AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED)

# Allowed server-side status transitions.
ALLOWED_TRANSITIONS = {
    AppointmentStatus.PENDING: {AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED},
    AppointmentStatus.CONFIRMED: {AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED},
    AppointmentStatus.COMPLETED: set(),
    AppointmentStatus.CANCELLED: set(),
}

_REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_reference():
    return "APT-" + "".join(secrets.choice(_REFERENCE_ALPHABET) for _ in range(8))


class Appointment(models.Model):
    reference = models.CharField(max_length=12, unique=True, default=generate_reference, editable=False)
    patient = models.ForeignKey("patients.Patient", on_delete=models.PROTECT, related_name="appointments")
    # The specialization is derived through the doctor relationship.
    doctor = models.ForeignKey("doctors.Doctor", on_delete=models.PROTECT, related_name="appointments")
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    reason = models.TextField(max_length=1000)
    status = models.CharField(
        max_length=10, choices=AppointmentStatus.choices, default=AppointmentStatus.PENDING, db_index=True
    )
    cancellation_reason = models.TextField(blank=True, max_length=1000)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    # Database-level double-booking guard: "<doctor_id>:<date>:<start>" while the
    # appointment occupies its slot, NULL once cancelled (MySQL allows many NULLs
    # in a unique index). Overlaps are additionally checked under a row lock.
    slot_key = models.CharField(max_length=64, unique=True, null=True, blank=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-start_time"]
        indexes = [
            models.Index(fields=["doctor", "date"]),
            models.Index(fields=["patient", "date"]),
            models.Index(fields=["status", "date"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(end_time__gt=F("start_time")), name="appointment_end_after_start"
            ),
        ]

    def __str__(self):
        return f"{self.reference} {self.date} {self.start_time}"

    @staticmethod
    def build_slot_key(doctor_id, date, start_time):
        return f"{doctor_id}:{date.isoformat()}:{start_time.strftime('%H:%M')}"

    def can_transition_to(self, new_status):
        return new_status in ALLOWED_TRANSITIONS[self.status]


class AppointmentEvent(models.Model):
    """Audit trail of status changes and reschedules."""

    class Action(models.TextChoices):
        CREATED = "CREATED", "Created"
        CONFIRMED = "CONFIRMED", "Confirmed"
        CANCELLED = "CANCELLED", "Cancelled"
        COMPLETED = "COMPLETED", "Completed"
        RESCHEDULED = "RESCHEDULED", "Rescheduled"

    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, related_name="events")
    action = models.CharField(max_length=12, choices=Action.choices)
    from_status = models.CharField(max_length=10, blank=True)
    to_status = models.CharField(max_length=10, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
