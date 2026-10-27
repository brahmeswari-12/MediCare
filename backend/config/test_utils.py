"""Shared factories for backend tests."""
from datetime import time, timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Role, User
from doctors.models import ApprovalStatus, Doctor, DoctorSchedule, Specialization
from patients.models import Patient

PASSWORD = "Str0ng-Test-Pass!"


def next_weekday(weekday, min_days=2):
    """A date at least `min_days` ahead that falls on `weekday` (Monday=0)."""
    day = timezone.localdate() + timedelta(days=min_days)
    while day.weekday() != weekday:
        day += timedelta(days=1)
    return day


def make_specialization(name="General Physician"):
    spec, _ = Specialization.objects.get_or_create(
        slug=name.lower().replace(" ", "-"), defaults={"name": name}
    )
    return spec


def make_patient(email="patient@example.test", name="Test Patient"):
    user = User.objects.create_user(email=email, password=PASSWORD, full_name=name, phone="+91 9000000000")
    return Patient.objects.create(user=user, date_of_birth="1990-01-01", gender="MALE", address="1 Test Road")


def make_doctor(email="doctor@example.test", name="Test Doctor", approved=True, with_schedule=True,
                specialization=None, fee="500.00"):
    user = User.objects.create_user(email=email, password=PASSWORD, full_name=name, role=Role.DOCTOR)
    doctor = Doctor.objects.create(
        user=user,
        specialization=specialization or make_specialization(),
        license_number=f"LIC-{email}",
        qualifications="MBBS",
        experience_years=5,
        hospital="Test Hospital",
        location="Bengaluru",
        consultation_fee=Decimal(fee),
        approval_status=ApprovalStatus.APPROVED if approved else ApprovalStatus.PENDING,
    )
    if with_schedule:
        # Monday 09:00-12:00, 30 min slots, break 10:30-11:00.
        DoctorSchedule.objects.create(
            doctor=doctor, weekday=0, start_time=time(9), end_time=time(12),
            slot_duration=30, break_start=time(10, 30), break_end=time(11),
        )
    return doctor


def make_admin(email="admin@example.test"):
    return User.objects.create_superuser(email=email, password=PASSWORD, full_name="Admin User")


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client
