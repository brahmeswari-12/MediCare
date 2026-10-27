import re

from django.utils import timezone
from rest_framework import serializers

PHONE_RE = re.compile(r"^\+?[0-9][0-9\s-]{6,18}[0-9]$")


def validate_phone(value):
    value = (value or "").strip()
    if value and not PHONE_RE.match(value):
        raise serializers.ValidationError("Enter a valid phone number (digits, spaces, dashes, optional +).")
    return value


def validate_full_name(value):
    value = " ".join((value or "").split())
    if len(value) < 2:
        raise serializers.ValidationError("Please enter your full name.")
    return value


def validate_birth_date(value):
    today = timezone.localdate()
    if value >= today:
        raise serializers.ValidationError("Date of birth must be in the past.")
    if value.year < today.year - 120:
        raise serializers.ValidationError("Please enter a valid date of birth.")
    return value
