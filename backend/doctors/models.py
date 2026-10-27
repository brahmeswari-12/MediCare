from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q


class Specialization(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=110, unique=True)
    description = models.TextField(blank=True)
    # Name of a Lucide icon the frontend renders for this specialty.
    icon = models.CharField(max_length=50, blank=True, default="stethoscope")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ApprovalStatus(models.TextChoices):
    PENDING = "PENDING", "Pending review"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"


class DoctorQuerySet(models.QuerySet):
    def bookable(self):
        """Doctors patients may see and book: approved and with an active account."""
        return self.filter(approval_status=ApprovalStatus.APPROVED, user__is_active=True)


class Doctor(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="doctor_profile"
    )
    specialization = models.ForeignKey(
        Specialization, on_delete=models.PROTECT, related_name="doctors"
    )
    license_number = models.CharField(max_length=50, unique=True)
    qualifications = models.CharField(max_length=255)
    experience_years = models.PositiveSmallIntegerField(validators=[MaxValueValidator(70)])
    hospital = models.CharField(max_length=150, db_index=True)
    location = models.CharField(max_length=100, db_index=True, help_text="City or area")
    address = models.CharField(max_length=255, blank=True)
    consultation_fee = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(0)]
    )
    bio = models.TextField(blank=True, max_length=2000)
    photo = models.ImageField(upload_to="doctors/", blank=True)
    max_appointments_per_day = models.PositiveSmallIntegerField(
        null=True, blank=True, help_text="Optional daily cap across all working intervals."
    )
    approval_status = models.CharField(
        max_length=10, choices=ApprovalStatus.choices, default=ApprovalStatus.PENDING, db_index=True
    )
    rejection_reason = models.TextField(blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = DoctorQuerySet.as_manager()

    class Meta:
        ordering = ["user__full_name"]
        indexes = [
            models.Index(fields=["approval_status", "specialization"]),
            models.Index(fields=["consultation_fee"]),
        ]

    def __str__(self):
        return f"Dr. {self.user.full_name}"

    @property
    def is_approved(self):
        return self.approval_status == ApprovalStatus.APPROVED and self.user.is_active


class Weekday(models.IntegerChoices):
    # Matches Python's date.weekday(): Monday == 0.
    MONDAY = 0, "Monday"
    TUESDAY = 1, "Tuesday"
    WEDNESDAY = 2, "Wednesday"
    THURSDAY = 3, "Thursday"
    FRIDAY = 4, "Friday"
    SATURDAY = 5, "Saturday"
    SUNDAY = 6, "Sunday"


class DoctorSchedule(models.Model):
    """One working interval on a weekday. A weekday may have several intervals
    (e.g. 09:00-13:00 and 14:00-17:00); they must not overlap."""

    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name="schedules")
    weekday = models.PositiveSmallIntegerField(choices=Weekday.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    slot_duration = models.PositiveSmallIntegerField(
        default=30, validators=[MinValueValidator(5), MaxValueValidator(240)],
        help_text="Appointment length in minutes.",
    )
    break_start = models.TimeField(null=True, blank=True)
    break_end = models.TimeField(null=True, blank=True)
    max_appointments = models.PositiveSmallIntegerField(
        null=True, blank=True, help_text="Optional cap for this interval."
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["weekday", "start_time"]
        indexes = [models.Index(fields=["doctor", "weekday"])]
        constraints = [
            models.CheckConstraint(
                condition=Q(end_time__gt=F("start_time")), name="schedule_end_after_start"
            ),
        ]

    def __str__(self):
        return f"{self.doctor} {self.get_weekday_display()} {self.start_time}-{self.end_time}"


class DoctorBlockedDate(models.Model):
    """A full day on which the doctor is unavailable (leave, conference, ...)."""

    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name="blocked_dates")
    date = models.DateField()
    reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date"]
        constraints = [
            models.UniqueConstraint(fields=["doctor", "date"], name="unique_doctor_blocked_date"),
        ]

    def __str__(self):
        return f"{self.doctor} blocked {self.date}"
