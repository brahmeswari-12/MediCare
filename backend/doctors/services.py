"""Schedule validation and availability (time-slot) generation.

Overlap policy: every appointment occupies the half-open interval
[start_time, end_time). Two intervals conflict when a.start < b.end and
b.start < a.end, so back-to-back slots (09:00-09:30, 09:30-10:00) are fine.

Slots are generated per working interval, stepping by the interval's
slot_duration from its start time. A slot that would overlap the break is
skipped and generation resumes at the break end.
"""
from collections import defaultdict
from datetime import datetime, timedelta

from django.conf import settings
from django.utils import timezone

from appointments.models import ACTIVE_STATUSES, Appointment

from .models import DoctorBlockedDate, DoctorSchedule


def local_now():
    return timezone.localtime()


def overlaps(start_a, end_a, start_b, end_b):
    return start_a < end_b and start_b < end_a


def _minutes_between(start, end):
    return (datetime.combine(datetime.min, end) - datetime.combine(datetime.min, start)).seconds // 60


def validate_schedule(doctor, data, instance=None):
    """Return a dict of field errors for a proposed schedule interval (empty if valid)."""
    errors = {}
    weekday = data.get("weekday")
    start = data.get("start_time")
    end = data.get("end_time")
    duration = data.get("slot_duration") or 30
    break_start = data.get("break_start")
    break_end = data.get("break_end")
    max_appointments = data.get("max_appointments")

    if start is None or end is None:
        return errors
    if end <= start:
        errors["end_time"] = ["End time must be after start time."]
        return errors
    if duration > _minutes_between(start, end):
        errors["slot_duration"] = ["Appointment duration is longer than the working interval."]

    if (break_start is None) != (break_end is None):
        errors["break_end" if break_start else "break_start"] = [
            "Provide both break start and break end, or neither."
        ]
    elif break_start is not None:
        if break_end <= break_start:
            errors["break_end"] = ["Break end must be after break start."]
        elif break_start <= start or break_end >= end:
            errors["break_start"] = ["The break must fall strictly inside the working interval."]

    if max_appointments is not None and max_appointments < 1:
        errors["max_appointments"] = ["Maximum appointments must be at least 1."]

    if data.get("is_active", True):
        siblings = DoctorSchedule.objects.filter(doctor=doctor, weekday=weekday, is_active=True)
        if instance is not None:
            siblings = siblings.exclude(pk=instance.pk)
        for other in siblings:
            if overlaps(start, end, other.start_time, other.end_time):
                errors["start_time"] = [
                    f"Overlaps an existing interval on this day "
                    f"({other.start_time:%H:%M}-{other.end_time:%H:%M})."
                ]
                break
    return errors


def generate_interval_slots(schedule, day):
    """Yield (start_time, end_time) tuples for one working interval on a date."""
    cursor = datetime.combine(day, schedule.start_time)
    interval_end = datetime.combine(day, schedule.end_time)
    step = timedelta(minutes=schedule.slot_duration)
    break_start = datetime.combine(day, schedule.break_start) if schedule.break_start else None
    break_end = datetime.combine(day, schedule.break_end) if schedule.break_end else None

    while cursor + step <= interval_end:
        slot_end = cursor + step
        if break_start and overlaps(cursor, slot_end, break_start, break_end):
            # Overlap implies cursor < break_end, so this always moves forward.
            cursor = break_end
            continue
        yield cursor.time(), slot_end.time()
        cursor = slot_end


def booking_window():
    today = local_now().date()
    return today, today + timedelta(days=settings.BOOKING_MAX_DAYS_AHEAD)


def compute_availability(doctor, days, exclude_appointment_id=None):
    """Compute slot availability for each date in `days`.

    Returns {date: {"date", "available", "message", "slots": [...]}} where each
    slot is {"start_time", "end_time", "available", "reason"}. Data is fetched in
    bulk so a month-long calendar costs a constant number of queries.
    """
    days = sorted(set(days))
    results = {}
    if not days:
        return results

    now = local_now()
    today, last_day = booking_window()

    schedules_by_weekday = defaultdict(list)
    for schedule in doctor.schedules.filter(is_active=True).order_by("start_time"):
        schedules_by_weekday[schedule.weekday].append(schedule)

    blocked = set(
        DoctorBlockedDate.objects.filter(doctor=doctor, date__in=days).values_list("date", flat=True)
    )

    appointments = Appointment.objects.filter(
        doctor=doctor, date__in=days, status__in=ACTIVE_STATUSES
    ).only("id", "date", "start_time", "end_time")
    if exclude_appointment_id:
        appointments = appointments.exclude(pk=exclude_appointment_id)
    booked_by_day = defaultdict(list)
    for appt in appointments:
        booked_by_day[appt.date].append((appt.start_time, appt.end_time))

    for day in days:
        result = {"date": day, "available": False, "message": "", "slots": []}
        results[day] = result

        if not doctor.is_approved:
            result["message"] = "This doctor is not accepting appointments."
            continue
        if day < today:
            result["message"] = "Appointments cannot be booked in the past."
            continue
        if day > last_day:
            result["message"] = (
                f"Appointments can be booked up to {settings.BOOKING_MAX_DAYS_AHEAD} days ahead."
            )
            continue
        if day in blocked:
            result["message"] = "The doctor is unavailable on this date."
            continue
        schedules = schedules_by_weekday.get(day.weekday(), [])
        if not schedules:
            result["message"] = "The doctor does not work on this day."
            continue

        booked = booked_by_day.get(day, [])
        daily_cap_reached = (
            doctor.max_appointments_per_day is not None
            and len(booked) >= doctor.max_appointments_per_day
        )

        for schedule in schedules:
            in_interval = [
                b for b in booked if overlaps(b[0], b[1], schedule.start_time, schedule.end_time)
            ]
            interval_cap_reached = (
                schedule.max_appointments is not None and len(in_interval) >= schedule.max_appointments
            )
            for start, end in generate_interval_slots(schedule, day):
                reason = ""
                if day == today and datetime.combine(day, start) <= now.replace(tzinfo=None):
                    reason = "past"
                elif any(overlaps(start, end, b_start, b_end) for b_start, b_end in booked):
                    reason = "booked"
                elif daily_cap_reached or interval_cap_reached:
                    reason = "capacity"
                result["slots"].append(
                    {
                        "start_time": start,
                        "end_time": end,
                        "available": not reason,
                        "reason": reason,
                        "slot_duration": schedule.slot_duration,
                    }
                )

        result["available"] = any(slot["available"] for slot in result["slots"])
        if not result["slots"]:
            result["message"] = "No appointment slots are configured for this day."
        elif not result["available"]:
            result["message"] = "All slots on this date are booked or no longer available."
    return results


def day_availability(doctor, day, exclude_appointment_id=None):
    return compute_availability(doctor, [day], exclude_appointment_id)[day]
