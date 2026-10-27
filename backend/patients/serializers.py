from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from accounts.validators import validate_birth_date, validate_full_name, validate_phone

from .models import Patient


def calculate_age(dob):
    today = timezone.localdate()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


class PatientSerializer(serializers.ModelSerializer):
    """Full patient profile: used by the patient themselves and by admins."""

    full_name = serializers.CharField(source="user.full_name", max_length=150)
    email = serializers.EmailField(source="user.email", read_only=True)
    phone = serializers.CharField(source="user.phone", max_length=20)
    is_active = serializers.BooleanField(source="user.is_active", read_only=True)
    date_joined = serializers.DateTimeField(source="user.date_joined", read_only=True)
    age = serializers.SerializerMethodField()
    date_of_birth = serializers.DateField(validators=[validate_birth_date])

    class Meta:
        model = Patient
        fields = [
            "id", "full_name", "email", "phone", "date_of_birth", "age", "gender", "address",
            "blood_group", "emergency_contact_name", "emergency_contact_phone",
            "is_active", "date_joined", "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]

    def get_age(self, obj):
        return calculate_age(obj.date_of_birth)

    def validate_full_name(self, value):
        return validate_full_name(value)

    def validate_phone(self, value):
        value = validate_phone(value)
        if not value:
            raise serializers.ValidationError("Phone number is required.")
        return value

    def validate_emergency_contact_phone(self, value):
        return validate_phone(value)

    @transaction.atomic
    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        for attr, value in user_data.items():
            setattr(instance.user, attr, value)
        if user_data:
            instance.user.save(update_fields=list(user_data.keys()))
        return super().update(instance, validated_data)


class PatientCareSerializer(serializers.ModelSerializer):
    """The subset of patient data a treating doctor needs (no home address)."""

    full_name = serializers.CharField(source="user.full_name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    age = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = ["id", "full_name", "email", "phone", "gender", "date_of_birth", "age", "blood_group"]
        read_only_fields = fields

    def get_age(self, obj):
        return calculate_age(obj.date_of_birth)
