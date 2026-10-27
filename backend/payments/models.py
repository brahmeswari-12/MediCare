from django.db import models


class PaymentStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    PAID = "PAID", "Paid"
    FAILED = "FAILED", "Failed"
    REFUNDED = "REFUNDED", "Refunded"
    VOID = "VOID", "Void"


class Payment(models.Model):
    """Consultation fee record for an appointment.

    No card numbers, CVVs or raw payment credentials are ever stored. The
    `provider` field makes it explicit when a record came from the mock adapter.
    """

    appointment = models.OneToOneField(
        "appointments.Appointment", on_delete=models.PROTECT, related_name="payment"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="INR")
    status = models.CharField(
        max_length=10, choices=PaymentStatus.choices, default=PaymentStatus.PENDING, db_index=True
    )
    provider = models.CharField(max_length=30, default="mock")
    method = models.CharField(max_length=30, blank=True)
    transaction_reference = models.CharField(max_length=64, unique=True, null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.appointment.reference} {self.amount} {self.status}"
