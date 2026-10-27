from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from appointments.models import Appointment, AppointmentStatus

from .models import MedicalRecord, Prescription, PrescriptionItem


class RecordAppointmentSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source="doctor.user.full_name")
    specialization = serializers.CharField(source="doctor.specialization.name")
    patient_name = serializers.CharField(source="patient.user.full_name")
    patient_id = serializers.IntegerField(source="patient.id")

    class Meta:
        model = Appointment
        fields = ["id", "reference", "date", "start_time", "doctor_name", "specialization",
                  "patient_name", "patient_id"]


class PrescriptionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrescriptionItem
        fields = ["id", "medicine_name", "dosage", "frequency", "duration", "instructions"]
        read_only_fields = ["id"]


class PrescriptionSerializer(serializers.ModelSerializer):
    items = PrescriptionItemSerializer(many=True)
    medical_record = serializers.PrimaryKeyRelatedField(queryset=MedicalRecord.objects.all())
    appointment = RecordAppointmentSerializer(source="medical_record.appointment", read_only=True)
    is_released = serializers.BooleanField(source="medical_record.is_released", read_only=True)

    class Meta:
        model = Prescription
        fields = ["id", "medical_record", "appointment", "notes", "items", "is_released", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_medical_record(self, record):
        doctor = self.context["request"].user.doctor_profile
        if record.appointment.doctor_id != doctor.id:
            # Same message as a missing record so ids cannot be probed.
            raise serializers.ValidationError("Medical record not found.")
        return record

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("Add at least one medicine.")
        if len(items) > 30:
            raise serializers.ValidationError("A prescription can contain at most 30 medicines.")
        return items

    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop("items")
        prescription = Prescription.objects.create(**validated_data)
        PrescriptionItem.objects.bulk_create(PrescriptionItem(prescription=prescription, **item) for item in items)
        return prescription


class MedicalRecordSerializer(serializers.ModelSerializer):
    appointment = serializers.PrimaryKeyRelatedField(queryset=Appointment.objects.all(), write_only=True)
    appointment_detail = RecordAppointmentSerializer(source="appointment", read_only=True)
    prescriptions = PrescriptionSerializer(many=True, read_only=True)

    class Meta:
        model = MedicalRecord
        fields = [
            "id", "appointment", "appointment_detail", "symptoms", "diagnosis", "notes",
            "follow_up_instructions", "follow_up_date", "is_released", "released_at",
            "prescriptions", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "released_at", "created_at", "updated_at"]

    def validate_appointment(self, appointment):
        if self.instance is not None and appointment.pk != self.instance.appointment_id:
            raise serializers.ValidationError("The appointment of a record cannot be changed.")
        doctor = self.context["request"].user.doctor_profile
        if appointment.doctor_id != doctor.id:
            raise serializers.ValidationError("Appointment not found.")
        if self.instance is None:
            if appointment.status not in (AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED):
                raise serializers.ValidationError(
                    "Records can only be written for confirmed or completed appointments."
                )
            if MedicalRecord.objects.filter(appointment=appointment).exists():
                raise serializers.ValidationError("A record already exists for this appointment.")
        return appointment

    def validate_diagnosis(self, value):
        if not value.strip():
            raise serializers.ValidationError("Diagnosis is required.")
        return value.strip()

    def validate(self, attrs):
        if self.instance is not None and self.instance.is_released and attrs.get("is_released") is False:
            raise serializers.ValidationError({"is_released": ["A released record cannot be withdrawn."]})
        follow_up = attrs.get("follow_up_date")
        if follow_up and follow_up < timezone.localdate():
            raise serializers.ValidationError({"follow_up_date": ["Follow-up date cannot be in the past."]})
        return attrs

    def _apply_release(self, validated_data, instance=None):
        if validated_data.get("is_released") and not (instance and instance.is_released):
            validated_data["released_at"] = timezone.now()

    def create(self, validated_data):
        self._apply_release(validated_data)
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("appointment", None)
        self._apply_release(validated_data, instance)
        return super().update(instance, validated_data)
