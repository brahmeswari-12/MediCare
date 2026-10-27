"""Appointment business rules: booking, rescheduling and status transitions.

Concurrency strategy for booking and rescheduling:
  1. Inside a transaction, lock the doctor's row with SELECT ... FOR UPDATE.
     All bookings for one doctor are therefore serialized.
  2. Re-compute availability from the database while holding the lock; the
     slot the client sent is never trusted.
  3. Lock the patient's row and reject overlapping appointments for the patient.
  4. Save with a unique `slot_key`; an IntegrityError (which can only happen if
     the lock was somehow bypassed) is reported as a 409 conflict.
"""
from datetime import datetime, timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import Role
from config.exceptions import Conflict
from doctors.models import Doctor
from doctors.services import day_availability, local_now, overlaps
from patients.models import Patient
from payments.services import create_payment_for_appointment, handle_appointment_cancelled

from .models import Appointment, AppointmentEvent, AppointmentStatus

SLOT_TAKEN_MESSAGE = "Sorry, this time slot is no longer available. Please choose another slot."


def appointment_start(appointment):
    return timezone.make_aware(datetime.combine(appointment.date, appointment.start_time))


def within_patient_change_window(appointment):
    """Patients may cancel/reschedule only until CANCELLATION_MIN_HOURS before the start."""
    cutoff = appointment_start(appointment) - timedelta(hours=settings.CANCELLATION_MIN_HOURS)
    return timezone.now() < cutoff


def _resolve_slot(doctor, day, start_time, exclude_appointment_id=None):
    availability = day_availability(doctor, day, exclude_appointment_id=exclude_appointment_id)
    if not availability["slots"]:
        raise ValidationError({"date": [availability["message"] or "No slots are available on this date."]})
    start_key = start_time.replace(second=0, microsecond=0)
    for slot in availability["slots"]:
        if slot["start_time"] == start_key:
            if slot["available"]:
                return slot
            if slot["reason"] == "past":
                raise ValidationError({"start_time": ["This time slot has already passed."]})
            raise Conflict(SLOT_TAKEN_MESSAGE)
    raise ValidationError(
        {"start_time": ["The selected time is outside the doctor's schedule or overlaps a break."]}
    )


def _check_patient_overlap(patient, day, start, end, exclude_appointment_id=None):
    qs = Appointment.objects.filter(
        patient=patient,
        date=day,
        status__in=(AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED),
    )
    if exclude_appointment_id:
        qs = qs.exclude(pk=exclude_appointment_id)
    for other in qs.only("start_time", "end_time", "reference"):
        if overlaps(start, end, other.start_time, other.end_time):
            raise ValidationError(
                {"start_time": [f"You already have appointment {other.reference} at this time."]}
            )


def _log(appointment, action, actor, from_status="", note=""):
    AppointmentEvent.objects.create(
        appointment=appointment,
        action=action,
        from_status=from_status,
        to_status=appointment.status,
        actor=actor,
        note=note,
    )


def book_appointment(*, patient, doctor_id, day, start_time, reason, actor):
    with transaction.atomic():
        try:
            doctor = Doctor.objects.select_for_update().select_related("user").get(pk=doctor_id)
        except Doctor.DoesNotExist:
            raise ValidationError({"doctor": ["Doctor not found."]})
        if not doctor.is_approved:
            raise ValidationError({"doctor": ["This doctor is not accepting appointments."]})

        slot = _resolve_slot(doctor, day, start_time)
        Patient.objects.select_for_update().get(pk=patient.pk)
        _check_patient_overlap(patient, day, slot["start_time"], slot["end_time"])

        appointment = Appointment(
            patient=patient,
            doctor=doctor,
            date=day,
            start_time=slot["start_time"],
            end_time=slot["end_time"],
            reason=reason,
            status=AppointmentStatus.PENDING,
            slot_key=Appointment.build_slot_key(doctor.pk, day, slot["start_time"]),
        )
        try:
            with transaction.atomic():
                appointment.save()
        except IntegrityError:
            raise Conflict(SLOT_TAKEN_MESSAGE)

        _log(appointment, AppointmentEvent.Action.CREATED, actor)
        create_payment_for_appointment(appointment)
    return appointment


def _lock(appointment_id):
    # of=("self",) locks only the appointment row, not the joined doctor/patient rows.
    return (
        Appointment.objects.select_for_update(of=("self",))
        .select_related("doctor__user", "patient__user")
        .get(pk=appointment_id)
    )


def reschedule_appointment(*, appointment, actor, day, start_time):
    with transaction.atomic():
        doctor = Doctor.objects.select_for_update().select_related("user").get(pk=appointment.doctor_id)
        appointment = _lock(appointment.pk)

        if appointment.status not in (AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED):
            raise ValidationError({"detail": "Only pending or confirmed appointments can be rescheduled."})
        if actor.role == Role.PATIENT and not within_patient_change_window(appointment):
            raise ValidationError(
                {"detail": f"Appointments can only be rescheduled more than "
                           f"{settings.CANCELLATION_MIN_HOURS} hours before they start."}
            )
        if not doctor.is_approved:
            raise ValidationError({"detail": "This doctor is not accepting appointments."})
        if day == appointment.date and start_time.replace(second=0) == appointment.start_time:
            raise ValidationError({"start_time": ["Please choose a different date or time."]})

        slot = _resolve_slot(doctor, day, start_time, exclude_appointment_id=appointment.pk)
        Patient.objects.select_for_update().get(pk=appointment.patient_id)
        _check_patient_overlap(
            appointment.patient, day, slot["start_time"], slot["end_time"],
            exclude_appointment_id=appointment.pk,
        )

        previous = f"{appointment.date:%Y-%m-%d} {appointment.start_time:%H:%M}"
        from_status = appointment.status
        appointment.date = day
        appointment.start_time = slot["start_time"]
        appointment.end_time = slot["end_time"]
        # A moved appointment needs the doctor's confirmation again.
        appointment.status = AppointmentStatus.PENDING
        appointment.confirmed_at = None
        appointment.slot_key = Appointment.build_slot_key(doctor.pk, day, slot["start_time"])
        try:
            with transaction.atomic():
                appointment.save()
        except IntegrityError:
            raise Conflict(SLOT_TAKEN_MESSAGE)

        _log(
            appointment, AppointmentEvent.Action.RESCHEDULED, actor, from_status,
            note=f"Moved from {previous} to {day:%Y-%m-%d} {slot['start_time']:%H:%M}",
        )
    return appointment


def _ensure_transition(appointment, new_status):
    if not appointment.can_transition_to(new_status):
        raise ValidationError(
            {"detail": f"A {appointment.get_status_display().lower()} appointment cannot be "
                       f"changed to {AppointmentStatus(new_status).label.lower()}."}
        )


def confirm_appointment(*, appointment, actor):
    with transaction.atomic():
        appointment = _lock(appointment.pk)
        _ensure_transition(appointment, AppointmentStatus.CONFIRMED)
        if appointment_start(appointment) <= timezone.now():
            raise ValidationError({"detail": "This appointment time has already passed."})
        appointment.status = AppointmentStatus.CONFIRMED
        appointment.confirmed_at = timezone.now()
        appointment.save(update_fields=["status", "confirmed_at", "updated_at"])
        _log(appointment, AppointmentEvent.Action.CONFIRMED, actor, AppointmentStatus.PENDING)
    return appointment


def complete_appointment(*, appointment, actor):
    with transaction.atomic():
        appointment = _lock(appointment.pk)
        _ensure_transition(appointment, AppointmentStatus.COMPLETED)
        if appointment.date > local_now().date():
            raise ValidationError({"detail": "Future appointments cannot be marked as completed."})
        appointment.status = AppointmentStatus.COMPLETED
        appointment.completed_at = timezone.now()
        appointment.save(update_fields=["status", "completed_at", "updated_at"])
        _log(appointment, AppointmentEvent.Action.COMPLETED, actor, AppointmentStatus.CONFIRMED)
    return appointment


def cancel_appointment(*, appointment, actor, reason):
    reason = (reason or "").strip()
    if len(reason) < 3:
        raise ValidationError({"reason": ["Please provide a cancellation reason."]})
    with transaction.atomic():
        appointment = _lock(appointment.pk)
        _ensure_transition(appointment, AppointmentStatus.CANCELLED)
        if actor.role == Role.PATIENT and not within_patient_change_window(appointment):
            raise ValidationError(
                {"detail": f"Appointments can only be cancelled more than "
                           f"{settings.CANCELLATION_MIN_HOURS} hours before they start. "
                           f"Please contact the clinic."}
            )
        from_status = appointment.status
        appointment.status = AppointmentStatus.CANCELLED
        appointment.cancellation_reason = reason
        appointment.cancelled_by = actor
        appointment.cancelled_at = timezone.now()
        appointment.slot_key = None  # frees the slot
        appointment.save()
        _log(appointment, AppointmentEvent.Action.CANCELLED, actor, from_status, note=reason)
        handle_appointment_cancelled(appointment)
    return appointment


def user_can_access(user, appointment):
    """Object-level access rule for appointments."""
    if user.role == Role.ADMIN:
        return True
    if user.role == Role.PATIENT:
        return appointment.patient.user_id == user.id
    if user.role == Role.DOCTOR:
        return appointment.doctor.user_id == user.id
    return False


def ensure_actor(user, appointment, allowed_roles):
    if user.role not in allowed_roles or not user_can_access(user, appointment):
        raise PermissionDenied("You are not allowed to perform this action on this appointment.")
