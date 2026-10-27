from django.utils import timezone
from rest_framework import serializers

from accounts.models import Role
from doctors.models import Doctor
from doctors.serializers import SpecializationMiniSerializer
from patients.serializers import PatientCareSerializer

from .models import Appointment, AppointmentEvent, AppointmentStatus
from .services import within_patient_change_window


class AppointmentDoctorSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="user.full_name")
    specialization = SpecializationMiniSerializer()

    class Meta:
        model = Doctor
        fields = ["id", "full_name", "photo", "specialization", "qualifications", "hospital",
                  "location", "address", "consultation_fee"]


class AppointmentEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    actor_role = serializers.SerializerMethodField()

    class Meta:
        model = AppointmentEvent
        fields = ["id", "action", "from_status", "to_status", "actor_name", "actor_role", "note", "created_at"]

    def get_actor_name(self, obj):
        return obj.actor.full_name if obj.actor else "System"

    def get_actor_role(self, obj):
        return obj.actor.role if obj.actor else ""


class AppointmentSerializer(serializers.ModelSerializer):
    doctor = AppointmentDoctorSerializer(read_only=True)
    patient = PatientCareSerializer(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    cancelled_by_role = serializers.SerializerMethodField()
    payment = serializers.SerializerMethodField()
    has_medical_record = serializers.SerializerMethodField()
    medical_record_id = serializers.SerializerMethodField()
    actions = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            "id", "reference", "doctor", "patient", "date", "start_time", "end_time", "reason",
            "status", "status_display", "cancellation_reason", "cancelled_by_role", "cancelled_at",
            "confirmed_at", "completed_at", "created_at", "updated_at", "payment",
            "has_medical_record", "medical_record_id", "actions",
        ]
        read_only_fields = fields

    def get_cancelled_by_role(self, obj):
        return obj.cancelled_by.role if obj.cancelled_by_id and obj.cancelled_by else ""

    def get_payment(self, obj):
        payment = getattr(obj, "payment", None)
        if payment is None:
            return None
        return {"id": payment.id, "status": payment.status, "amount": str(payment.amount),
                "currency": payment.currency, "provider": payment.provider}

    def _record(self, obj):
        return getattr(obj, "medical_record", None)

    def get_has_medical_record(self, obj):
        record = self._record(obj)
        if record is None:
            return False
        user = self.context["request"].user
        return record.is_released or user.role != Role.PATIENT

    def get_medical_record_id(self, obj):
        return self._record(obj).id if self.get_has_medical_record(obj) else None

    def get_actions(self, obj):
        """What the current user may do next; the server re-checks on every action."""
        user = self.context["request"].user
        active = obj.status in (AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED)
        is_patient = user.role == Role.PATIENT
        is_doctor = user.role == Role.DOCTOR
        is_admin = user.role == Role.ADMIN
        in_window = active and within_patient_change_window(obj)
        today = timezone.localdate()
        return {
            "can_cancel": active and (is_doctor or is_admin or (is_patient and in_window)),
            "can_reschedule": active and (is_admin or (is_patient and in_window)),
            "can_confirm": obj.status == AppointmentStatus.PENDING and (is_doctor or is_admin)
                           and (obj.date > today or (obj.date == today and obj.start_time > timezone.localtime().time())),
            "can_complete": obj.status == AppointmentStatus.CONFIRMED and is_doctor and obj.date <= today,
            "can_write_record": is_doctor and obj.status in (AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED)
                                and self._record(obj) is None,
        }


class AppointmentDetailSerializer(AppointmentSerializer):
    events = AppointmentEventSerializer(many=True, read_only=True)

    class Meta(AppointmentSerializer.Meta):
        fields = AppointmentSerializer.Meta.fields + ["events"]
        read_only_fields = fields


class AppointmentCreateSerializer(serializers.Serializer):
    doctor = serializers.IntegerField(min_value=1)
    date = serializers.DateField()
    start_time = serializers.TimeField()
    reason = serializers.CharField(min_length=5, max_length=1000)

    def validate_date(self, value):
        if value < timezone.localdate():
            raise serializers.ValidationError("Appointments cannot be booked in the past.")
        return value

    def validate_reason(self, value):
        value = value.strip()
        if len(value) < 5:
            raise serializers.ValidationError("Please describe the reason for your visit (at least 5 characters).")
        return value


class RescheduleSerializer(serializers.Serializer):
    date = serializers.DateField()
    start_time = serializers.TimeField()

    def validate_date(self, value):
        if value < timezone.localdate():
            raise serializers.ValidationError("Appointments cannot be moved to the past.")
        return value


class CancelSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=1000)


class AppointmentUpdateSerializer(serializers.Serializer):
    """PATCH body. `status` changes go through the same transition services as
    the dedicated action endpoints."""

    reason = serializers.CharField(min_length=5, max_length=1000, required=False)
    status = serializers.ChoiceField(choices=AppointmentStatus.choices, required=False)
    cancellation_reason = serializers.CharField(max_length=1000, required=False, allow_blank=True)
