"""Role-based permission classes shared across apps.

Every protected endpoint uses these on the server; frontend role checks are
only a convenience for navigation.
"""
from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Role


def _has_role(request, role):
    user = request.user
    return bool(user and user.is_authenticated and user.is_active and user.role == role)


class IsPatient(BasePermission):
    message = "This action is available to patients only."

    def has_permission(self, request, view):
        return _has_role(request, Role.PATIENT) and hasattr(request.user, "patient_profile")


class IsDoctor(BasePermission):
    message = "This action is available to doctors only."

    def has_permission(self, request, view):
        return _has_role(request, Role.DOCTOR) and hasattr(request.user, "doctor_profile")


class IsApprovedDoctor(IsDoctor):
    message = "Your doctor account must be approved by an administrator first."

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.doctor_profile.is_approved


class IsAdminRole(BasePermission):
    message = "Administrator access is required."

    def has_permission(self, request, view):
        return _has_role(request, Role.ADMIN)


class IsAdminOrReadOnly(BasePermission):
    """Anyone may read; only administrators may write."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return _has_role(request, Role.ADMIN)
