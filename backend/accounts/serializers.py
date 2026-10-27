from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from doctors.models import ApprovalStatus, Doctor, Specialization
from patients.models import Gender, Patient

from .models import Role, User
from .validators import validate_birth_date, validate_full_name, validate_phone


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "phone", "role", "is_active", "date_joined"]
        read_only_fields = fields


def profile_summary(user):
    """Role-specific info the frontend needs right after login."""
    data = UserSerializer(user).data
    if user.role == Role.PATIENT and hasattr(user, "patient_profile"):
        data["patient_id"] = user.patient_profile.id
    elif user.role == Role.DOCTOR and hasattr(user, "doctor_profile"):
        doctor = user.doctor_profile
        data["doctor_id"] = doctor.id
        data["approval_status"] = doctor.approval_status
        data["rejection_reason"] = doctor.rejection_reason
    return data


class PasswordFieldsMixin(serializers.Serializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, style={"input_type": "password"})
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_password_pair(self, attrs, user_fields):
        if attrs["password"] != attrs.pop("confirm_password"):
            raise serializers.ValidationError({"confirm_password": ["Passwords do not match."]})
        candidate = User(**user_fields)
        try:
            password_validation.validate_password(attrs["password"], candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})


class BaseRegistrationSerializer(PasswordFieldsMixin):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=254)
    phone = serializers.CharField(max_length=20)

    def validate_full_name(self, value):
        return validate_full_name(value)

    def validate_phone(self, value):
        value = validate_phone(value)
        if not value:
            raise serializers.ValidationError("Phone number is required.")
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate(self, attrs):
        self.validate_password_pair(attrs, {"email": attrs["email"], "full_name": attrs["full_name"]})
        return attrs


class PatientRegistrationSerializer(BaseRegistrationSerializer):
    date_of_birth = serializers.DateField(validators=[validate_birth_date])
    gender = serializers.ChoiceField(choices=Gender.choices)
    address = serializers.CharField(max_length=500)

    @transaction.atomic
    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            full_name=validated_data["full_name"],
            phone=validated_data["phone"],
            role=Role.PATIENT,
        )
        Patient.objects.create(
            user=user,
            date_of_birth=validated_data["date_of_birth"],
            gender=validated_data["gender"],
            address=validated_data["address"].strip(),
        )
        return user


class DoctorApplicationSerializer(BaseRegistrationSerializer):
    """Public doctor application. Accounts start PENDING and are not bookable
    until an administrator approves them."""

    specialization_id = serializers.PrimaryKeyRelatedField(
        queryset=Specialization.objects.filter(is_active=True), source="specialization"
    )
    license_number = serializers.CharField(max_length=50)
    qualifications = serializers.CharField(max_length=255)
    experience_years = serializers.IntegerField(min_value=0, max_value=70)
    hospital = serializers.CharField(max_length=150)
    location = serializers.CharField(max_length=100)
    consultation_fee = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    bio = serializers.CharField(max_length=2000, required=False, allow_blank=True)

    def validate_license_number(self, value):
        value = value.strip().upper()
        if Doctor.objects.filter(license_number__iexact=value).exists():
            raise serializers.ValidationError("A doctor with this license number is already registered.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            full_name=validated_data["full_name"],
            phone=validated_data["phone"],
            role=Role.DOCTOR,
        )
        Doctor.objects.create(
            user=user,
            specialization=validated_data["specialization"],
            license_number=validated_data["license_number"],
            qualifications=validated_data["qualifications"],
            experience_years=validated_data["experience_years"],
            hospital=validated_data["hospital"],
            location=validated_data["location"],
            consultation_fee=validated_data["consultation_fee"],
            bio=validated_data.get("bio", ""),
            approval_status=ApprovalStatus.PENDING,
        )
        return user


class LoginSerializer(TokenObtainPairSerializer):
    """Email + password login. Adds role claims to the token and returns the user."""

    default_error_messages = {"no_active_account": "Invalid email or password."}

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["name"] = user.full_name
        return token

    def validate(self, attrs):
        attrs[self.username_field] = attrs.get(self.username_field, "").strip().lower()
        data = super().validate(attrs)
        data["user"] = profile_summary(self.user)
        return data


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Your current password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": ["Passwords do not match."]})
        if attrs["new_password"] == attrs["current_password"]:
            raise serializers.ValidationError({"new_password": ["Choose a password different from your current one."]})
        try:
            password_validation.validate_password(attrs["new_password"], self.context["request"].user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})
        return attrs


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()
