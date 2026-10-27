from django.db import transaction
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import Role
from appointments.models import AppointmentStatus

from . import services
from .models import Payment, PaymentStatus


class PaymentSerializer(serializers.ModelSerializer):
    appointment_reference = serializers.CharField(source="appointment.reference", read_only=True)
    appointment_id = serializers.IntegerField(source="appointment.id", read_only=True)
    appointment_date = serializers.DateField(source="appointment.date", read_only=True)
    appointment_status = serializers.CharField(source="appointment.status", read_only=True)
    doctor_name = serializers.CharField(source="appointment.doctor.user.full_name", read_only=True)
    patient_name = serializers.CharField(source="appointment.patient.user.full_name", read_only=True)
    is_mock = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id", "appointment_id", "appointment_reference", "appointment_date", "appointment_status",
            "doctor_name", "patient_name", "amount", "currency", "status", "provider", "method",
            "transaction_reference", "paid_at", "created_at", "is_mock",
        ]
        read_only_fields = fields

    def get_is_mock(self, obj):
        return obj.provider == "mock"


class PayRequestSerializer(serializers.Serializer):
    # Only a method label is accepted. Card numbers/CVVs are never sent to or stored by this API.
    method = serializers.ChoiceField(choices=["CARD", "UPI", "NETBANKING"])


class PaymentViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PaymentSerializer
    filterset_fields = ["status"]
    search_fields = ["appointment__reference", "transaction_reference"]
    ordering_fields = ["created_at", "amount"]

    def get_queryset(self):
        user = self.request.user
        qs = Payment.objects.select_related("appointment__doctor__user", "appointment__patient__user")
        if user.role == Role.ADMIN:
            return qs
        if user.role == Role.PATIENT:
            return qs.filter(appointment__patient__user=user)
        if user.role == Role.DOCTOR:
            return qs.filter(appointment__doctor__user=user)
        return qs.none()

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        """Settle a pending consultation fee through the mock adapter."""
        if request.user.role != Role.PATIENT:
            raise PermissionDenied("Only the patient can pay for their appointment.")
        serializer = PayRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            payment = self.get_queryset().select_for_update(of=("self",)).get(pk=self.get_object().pk)
            if payment.status != PaymentStatus.PENDING:
                raise ValidationError({"detail": "This payment is not awaiting settlement."})
            if payment.appointment.status == AppointmentStatus.CANCELLED:
                raise ValidationError({"detail": "Cancelled appointments cannot be paid."})
            services.pay(payment, serializer.validated_data["method"])
        return Response(PaymentSerializer(payment).data)
