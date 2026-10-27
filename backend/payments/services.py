"""Payment service with a mock adapter for local development.

The mock adapter never contacts a real provider and never receives card data.
Transaction references it produces are prefixed with "MOCK-" so they can never
be mistaken for real transactions.
"""
import secrets

from django.conf import settings
from django.utils import timezone

from .models import Payment, PaymentStatus


class MockPaymentAdapter:
    name = "mock"

    def charge(self, payment, method):
        return {"success": True, "reference": f"MOCK-{secrets.token_hex(8).upper()}"}

    def refund(self, payment):
        return {"success": True}


def get_adapter():
    # A real provider adapter (e.g. Razorpay or Stripe) would be selected here
    # from settings. Only the mock adapter ships with the project.
    return MockPaymentAdapter()


def create_payment_for_appointment(appointment):
    return Payment.objects.create(
        appointment=appointment,
        amount=appointment.doctor.consultation_fee,
        currency=getattr(settings, "CURRENCY", "INR"),
        provider=get_adapter().name,
    )


def pay(payment, method):
    adapter = get_adapter()
    result = adapter.charge(payment, method)
    if result["success"]:
        payment.status = PaymentStatus.PAID
        payment.transaction_reference = result["reference"]
        payment.method = method
        payment.paid_at = timezone.now()
    else:
        payment.status = PaymentStatus.FAILED
    payment.save()
    return payment


def handle_appointment_cancelled(appointment):
    """Refund a paid fee (mock) or void an unpaid one when an appointment is cancelled."""
    payment = getattr(appointment, "payment", None)
    if payment is None:
        return
    if payment.status == PaymentStatus.PAID:
        if get_adapter().refund(payment)["success"]:
            payment.status = PaymentStatus.REFUNDED
            payment.save(update_fields=["status", "updated_at"])
    elif payment.status == PaymentStatus.PENDING:
        payment.status = PaymentStatus.VOID
        payment.save(update_fields=["status", "updated_at"])
