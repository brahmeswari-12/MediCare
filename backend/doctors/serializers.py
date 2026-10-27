from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import serializers

from accounts.models import Role, User
from accounts.validators import validate_full_name, validate_phone

from .models import ApprovalStatus, Doctor, DoctorBlockedDate, DoctorSchedule, Specialization
from .services import validate_schedule

MAX_PHOTO_BYTES = 2 * 1024 * 1024


class SpecializationSerializer(serializers.ModelSerializer):
    doctor_count = serializers.IntegerField(read_only=True)
    slug = serializers.SlugField(required=False, max_length=110)

    class Meta:
        model = Specialization
        fields = ["id", "name", "slug", "description", "icon", "is_active", "doctor_count", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        name = attrs.get("name") or (self.instance.name if self.instance else "")
        if not attrs.get("slug") and (not self.instance or "name" in attrs):
            attrs["slug"] = slugify(name)
        slug = attrs.get("slug")
        if slug:
            qs = Specialization.objects.filter(slug=slug)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"slug": ["A specialization with this slug already exists."]})
        return attrs


class SpecializationMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Specialization
        fields = ["id", "name", "slug", "icon"]


class PublicDoctorSerializer(serializers.ModelSerializer):
    """Public directory card / profile. Contains no private contact or admin data."""

    full_name = serializers.CharField(source="user.full_name", read_only=True)
    specialization = SpecializationMiniSerializer(read_only=True)
    working_days = serializers.SerializerMethodField()

    class Meta:
        model = Doctor
        fields = [
            "id", "full_name", "photo", "specialization", "qualifications", "experience_years",
            "hospital", "location", "address", "consultation_fee", "bio", "working_days",
        ]
        read_only_fields = fields

    def get_working_days(self, obj):
        # Uses prefetched schedules when available.
        days = sorted({s.weekday for s in obj.schedules.all() if s.is_active})
        return days


class DoctorSerializer(serializers.ModelSerializer):
    """Full doctor record for the doctor themselves and for administrators."""

    full_name = serializers.CharField(source="user.full_name", max_length=150)
    email = serializers.EmailField(source="user.email", read_only=True)
    phone = serializers.CharField(source="user.phone", max_length=20, required=False, allow_blank=True)
    is_active = serializers.BooleanField(source="user.is_active", read_only=True)
    specialization = SpecializationMiniSerializer(read_only=True)
    specialization_id = serializers.PrimaryKeyRelatedField(
        queryset=Specialization.objects.all(), source="specialization", write_only=True, required=False
    )
    photo = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Doctor
        fields = [
            "id", "full_name", "email", "phone", "is_active", "photo", "specialization", "specialization_id",
            "license_number", "qualifications", "experience_years", "hospital", "location", "address",
            "consultation_fee", "bio", "max_appointments_per_day", "approval_status", "rejection_reason",
            "approved_at", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "approval_status", "rejection_reason", "approved_at", "created_at", "updated_at"]

    def validate_full_name(self, value):
        return validate_full_name(value)

    def validate_phone(self, value):
        return validate_phone(value)

    def validate_photo(self, value):
        if value and value.size > MAX_PHOTO_BYTES:
            raise serializers.ValidationError("Profile photo must be 2 MB or smaller.")
        return value

    def validate_license_number(self, value):
        value = value.strip().upper()
        qs = Doctor.objects.filter(license_number__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A doctor with this license number is already registered.")
        return value

    @transaction.atomic
    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        for attr, value in user_data.items():
            setattr(instance.user, attr, value)
        if user_data:
            instance.user.save(update_fields=list(user_data.keys()))
        return super().update(instance, validated_data)


class DoctorSelfSerializer(DoctorSerializer):
    """Fields a doctor may edit on their own profile. Specialization and license
    are verified credentials and can only be changed by an administrator."""

    class Meta(DoctorSerializer.Meta):
        read_only_fields = DoctorSerializer.Meta.read_only_fields + ["license_number"]

    def get_fields(self):
        fields = super().get_fields()
        fields.pop("specialization_id", None)
        return fields


class AdminDoctorCreateSerializer(DoctorSerializer):
    """Admin creates a doctor account directly (approved by default)."""

    email = serializers.EmailField(source="user.email")
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    approve = serializers.BooleanField(write_only=True, default=True)

    class Meta(DoctorSerializer.Meta):
        fields = DoctorSerializer.Meta.fields + ["password", "approve"]

    def get_fields(self):
        fields = super().get_fields()
        fields["specialization_id"].required = True
        return fields

    def validate(self, attrs):
        user_data = attrs.get("user", {})
        email = user_data.get("email", "").strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError({"email": ["An account with this email already exists."]})
        user_data["email"] = email
        try:
            password_validation.validate_password(
                attrs["password"], User(email=email, full_name=user_data.get("full_name", ""))
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user_data = validated_data.pop("user")
        password = validated_data.pop("password")
        approve = validated_data.pop("approve", True)
        user = User.objects.create_user(
            email=user_data["email"], password=password, full_name=user_data["full_name"],
            phone=user_data.get("phone", ""), role=Role.DOCTOR,
        )
        if approve:
            validated_data["approval_status"] = ApprovalStatus.APPROVED
            validated_data["approved_at"] = timezone.now()
        return Doctor.objects.create(user=user, **validated_data)


class DoctorScheduleSerializer(serializers.ModelSerializer):
    weekday_display = serializers.CharField(source="get_weekday_display", read_only=True)

    class Meta:
        model = DoctorSchedule
        fields = [
            "id", "weekday", "weekday_display", "start_time", "end_time", "slot_duration",
            "break_start", "break_end", "max_appointments", "is_active",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        doctor = self.context["doctor"]
        merged = {}
        if self.instance:
            for field in ["weekday", "start_time", "end_time", "slot_duration", "break_start",
                          "break_end", "max_appointments", "is_active"]:
                merged[field] = getattr(self.instance, field)
        merged.update(attrs)
        errors = validate_schedule(doctor, merged, instance=self.instance)
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class BlockedDateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DoctorBlockedDate
        fields = ["id", "date", "reason", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_date(self, value):
        if value < timezone.localdate():
            raise serializers.ValidationError("You cannot block a date in the past.")
        doctor = self.context["doctor"]
        if DoctorBlockedDate.objects.filter(doctor=doctor, date=value).exists():
            raise serializers.ValidationError("This date is already blocked.")
        from appointments.models import Appointment, AppointmentStatus

        active = Appointment.objects.filter(
            doctor=doctor, date=value,
            status__in=[AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        ).count()
        if active:
            raise serializers.ValidationError(
                f"You have {active} active appointment(s) on this date. Cancel or reschedule them first."
            )
        return value


class SlotSerializer(serializers.Serializer):
    start_time = serializers.TimeField(format="%H:%M")
    end_time = serializers.TimeField(format="%H:%M")
    available = serializers.BooleanField()
    reason = serializers.CharField()
    slot_duration = serializers.IntegerField()


class DayAvailabilitySerializer(serializers.Serializer):
    date = serializers.DateField()
    available = serializers.BooleanField()
    message = serializers.CharField(allow_blank=True)
    slots = SlotSerializer(many=True)
