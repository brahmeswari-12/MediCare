"""Development-only seed data.

    python manage.py seed_demo                 # specializations + demo accounts + sample data
    python manage.py seed_demo --specializations-only

Creates fictional doctors, patients, schedules, appointments and supplies so
the app can be explored locally. All demo accounts share DEMO_PASSWORD below
and use the reserved ".test" email domain. Refuses to run with DEBUG=False
unless --force is passed. Safe to run more than once (existing rows are kept).
"""
import zlib
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import Role, User
from appointments.models import Appointment, AppointmentEvent, AppointmentStatus
from appointments.services import book_appointment, confirm_appointment
from doctors.models import ApprovalStatus, Doctor, DoctorSchedule, Specialization
from doctors.services import day_availability
from inventory.models import HospitalSupply
from medical_records.models import MedicalRecord, Prescription, PrescriptionItem
from patients.models import Patient
from payments.models import Payment, PaymentStatus

DEMO_PASSWORD = "DemoPass@2026"
ADMIN_EMAIL = "admin@medicare.test"

SPECIALIZATIONS = [
    ("General Physician", "stethoscope", "Primary care for common illnesses, check-ups and preventive health."),
    ("Cardiologist", "heart-pulse", "Diagnosis and treatment of heart and blood-vessel conditions."),
    ("Dermatologist", "scan-face", "Care for skin, hair and nail conditions."),
    ("Dentist", "smile", "Oral health, dental check-ups, fillings and orthodontics."),
    ("Pediatrician", "baby", "Medical care for infants, children and adolescents."),
    ("Neurologist", "brain", "Disorders of the brain, spinal cord and nerves."),
    ("Orthopedic", "bone", "Bones, joints, ligaments and sports injuries."),
    ("Gynecologist", "flower", "Women's reproductive health and pregnancy care."),
    ("ENT Specialist", "ear", "Ear, nose and throat conditions."),
    ("Ophthalmologist", "eye", "Eye examinations, vision problems and eye surgery."),
    ("Psychiatrist", "brain-circuit", "Mental health assessment, therapy and treatment."),
]

# (name, specialization, qualifications, years, hospital, city, fee, schedule_type)
DOCTORS = [
    ("Ananya Sharma", "General Physician", "MBBS, MD (General Medicine)", 12,
     "CityCare Multispeciality Hospital", "Bengaluru", 500, "split"),
    ("Rohan Mehta", "Cardiologist", "MBBS, MD, DM (Cardiology)", 15,
     "Heartline Cardiac Centre", "Mumbai", 1200, "long"),
    ("Priya Nair", "Dermatologist", "MBBS, MD (Dermatology)", 9,
     "SkinFirst Clinic", "Kochi", 800, "split"),
    ("Vikram Rao", "Dentist", "BDS, MDS (Orthodontics)", 11,
     "BrightSmile Dental Care", "Hyderabad", 600, "long"),
    ("Kavya Iyer", "Pediatrician", "MBBS, MD (Pediatrics)", 8,
     "Little Steps Children's Clinic", "Chennai", 700, "split"),
    ("Arjun Kapoor", "Neurologist", "MBBS, MD, DM (Neurology)", 14,
     "NeuroCare Institute", "New Delhi", 1500, "long"),
    ("Sneha Kulkarni", "Orthopedic", "MBBS, MS (Orthopaedics)", 10,
     "Motion Ortho & Spine Centre", "Pune", 900, "split"),
    ("Meera Joshi", "Gynecologist", "MBBS, MS (Obstetrics & Gynaecology)", 13,
     "Lotus Women's Hospital", "Ahmedabad", 900, "long"),
    ("Sameer Khan", "ENT Specialist", "MBBS, MS (ENT)", 7,
     "ClearSound ENT Clinic", "Lucknow", 650, "split"),
    ("Lakshmi Menon", "Ophthalmologist", "MBBS, MS (Ophthalmology)", 16,
     "VisionPlus Eye Hospital", "Bengaluru", 750, "long"),
    ("Aditya Verma", "Psychiatrist", "MBBS, MD (Psychiatry)", 9,
     "MindWell Clinic", "Mumbai", 1000, "split"),
    ("Farah Siddiqui", "General Physician", "MBBS, DNB (Family Medicine)", 6,
     "CityCare Multispeciality Hospital", "Bengaluru", 450, "long"),
]

PENDING_DOCTORS = [
    ("Nikhil Bose", "Cardiologist", "MBBS, MD (Medicine)", 5, "Eastside Heart Clinic", "Kolkata", 900),
    ("Ritu Agarwal", "Dermatologist", "MBBS, DDVL", 4, "Glow Skin Studio", "Jaipur", 600),
]

PATIENTS = [
    ("Rahul Verma", "patient@medicare.test", "1992-04-18", "MALE", "12 MG Road, Bengaluru 560001", "B+"),
    ("Aisha Khan", "aisha.khan@medicare.test", "1988-11-02", "FEMALE", "45 Park Street, Kolkata 700016", "O+"),
    ("Sanjay Gupta", "sanjay.gupta@medicare.test", "1975-07-23", "MALE", "8 Civil Lines, Jaipur 302006", "A-"),
]

SUPPLIES = [
    ("Surgical Gloves (Nitrile, M)", "SUP-GLV-001", "Consumables", 1200, "pairs", 500, "MedSupply Distributors"),
    ("N95 Respirator Masks", "SUP-MSK-002", "PPE", 180, "units", 300, "SafeAir Healthcare"),
    ("Disposable Syringes 5 ml", "SUP-SYR-003", "Consumables", 2400, "units", 1000, "MedSupply Distributors"),
    ("Paracetamol 500 mg", "PHM-PCM-004", "Pharmacy", 90, "strips", 150, "Generic Pharma Wholesale"),
    ("Sterile Gauze Pads", "SUP-GZE-005", "Wound care", 640, "packs", 200, "CarePlus Medical"),
    ("Digital Thermometer", "EQP-THM-006", "Equipment", 25, "units", 10, "Diagnostix India"),
    ("IV Cannula 20G", "SUP-IVC-007", "Consumables", 0, "units", 100, "CarePlus Medical"),
    ("Hand Sanitizer 500 ml", "SUP-SAN-008", "Hygiene", 75, "bottles", 60, "CleanCare Supplies"),
]


def email_for(name):
    return name.lower().replace(" ", ".") + "@medicare.test"


class Command(BaseCommand):
    help = "Seed development data (specializations, demo accounts, schedules, appointments)."

    def add_arguments(self, parser):
        parser.add_argument("--specializations-only", action="store_true")
        parser.add_argument("--force", action="store_true", help="Allow running with DEBUG=False.")

    def handle(self, *args, **options):
        if not settings.DEBUG and not options["force"]:
            raise CommandError("seed_demo is for development. Set DJANGO_DEBUG=True or pass --force.")
        with transaction.atomic():
            specs = self.seed_specializations()
            if options["specializations_only"]:
                return
            self.seed_admin()
            doctors = self.seed_doctors(specs)
            patients = self.seed_patients()
            self.seed_supplies()
        # Appointments use the real booking service (its own transactions).
        self.seed_appointments(doctors, patients)
        self.stdout.write(self.style.SUCCESS(
            f"Demo data ready. Demo accounts use the password defined in DEMO_PASSWORD "
            f"({__file__})."
        ))

    def seed_specializations(self):
        from django.utils.text import slugify

        specs = {}
        for name, icon, description in SPECIALIZATIONS:
            spec, _ = Specialization.objects.get_or_create(
                slug=slugify(name), defaults={"name": name, "icon": icon, "description": description}
            )
            specs[name] = spec
        self.stdout.write(f"Specializations: {len(specs)}")
        return specs

    def seed_admin(self):
        if not User.objects.filter(email=ADMIN_EMAIL).exists():
            User.objects.create_superuser(email=ADMIN_EMAIL, password=DEMO_PASSWORD, full_name="Platform Admin")
            self.stdout.write(f"Admin: {ADMIN_EMAIL}")

    def _doctor(self, name, spec, quals, years, hospital, city, fee, status):
        email = email_for(name)
        user = User.objects.filter(email=email).first()
        if user:
            return user.doctor_profile
        user = User.objects.create_user(
            email=email, password=DEMO_PASSWORD, full_name=name, role=Role.DOCTOR,
            phone=f"+91 98{zlib.crc32(email.encode()) % 100000000:08d}",
        )
        bio = (
            f"Dr. {name.split()[0]} is a {spec.name.lower()} with {years} years of clinical experience "
            f"at {hospital}, {city}. Consultations focus on clear explanations, evidence-based "
            f"treatment and long-term follow-up."
        )
        return Doctor.objects.create(
            user=user, specialization=spec, license_number=f"MCI-{100000 + User.objects.count()}",
            qualifications=quals, experience_years=years, hospital=hospital, location=city,
            address=f"{hospital}, {city}", consultation_fee=Decimal(fee), bio=bio,
            approval_status=status,
            approved_at=timezone.now() if status == ApprovalStatus.APPROVED else None,
        )

    def seed_doctors(self, specs):
        doctors = []
        for name, spec, quals, years, hospital, city, fee, kind in DOCTORS:
            doctor = self._doctor(name, specs[spec], quals, years, hospital, city, fee, ApprovalStatus.APPROVED)
            if not doctor.schedules.exists():
                weekdays = range(0, 6) if kind == "split" else range(0, 5)
                for wd in weekdays:
                    if kind == "split":
                        DoctorSchedule.objects.create(doctor=doctor, weekday=wd, start_time=time(9),
                                                      end_time=time(13), slot_duration=30)
                        if wd < 5:
                            DoctorSchedule.objects.create(doctor=doctor, weekday=wd, start_time=time(14),
                                                          end_time=time(17), slot_duration=30)
                    else:
                        DoctorSchedule.objects.create(
                            doctor=doctor, weekday=wd, start_time=time(10), end_time=time(18),
                            slot_duration=30, break_start=time(13), break_end=time(14), max_appointments=12,
                        )
            doctors.append(doctor)
        for name, spec, quals, years, hospital, city, fee in PENDING_DOCTORS:
            self._doctor(name, specs[spec], quals, years, hospital, city, fee, ApprovalStatus.PENDING)
        self.stdout.write(f"Doctors: {len(doctors)} approved, {len(PENDING_DOCTORS)} pending")
        return doctors

    def seed_patients(self):
        patients = []
        for name, email, dob, gender, address, blood in PATIENTS:
            user = User.objects.filter(email=email).first()
            if user is None:
                user = User.objects.create_user(
                    email=email, password=DEMO_PASSWORD, full_name=name, role=Role.PATIENT,
                    phone=f"+91 97{zlib.crc32(email.encode()) % 100000000:08d}",
                )
                Patient.objects.create(user=user, date_of_birth=dob, gender=gender, address=address,
                                       blood_group=blood)
            patients.append(user.patient_profile)
        self.stdout.write(f"Patients: {len(patients)}")
        return patients

    def seed_supplies(self):
        for name, sku, category, qty, unit, minimum, supplier in SUPPLIES:
            HospitalSupply.objects.get_or_create(sku=sku, defaults={
                "name": name, "category": category, "quantity": qty, "unit": unit,
                "minimum_stock_level": minimum, "supplier": supplier,
            })

    def _next_free_slot(self, doctor, start_offset):
        today = timezone.localdate()
        for offset in range(start_offset, start_offset + 21):
            day = today + timedelta(days=offset)
            for slot in day_availability(doctor, day)["slots"]:
                if slot["available"]:
                    return day, slot["start_time"]
        return None, None

    def _past_appointment(self, patient, doctor, days_ago, start, status, reason, cancel_reason=""):
        day = timezone.localdate() - timedelta(days=days_ago)
        end = (datetime.combine(day, start) + timedelta(minutes=30)).time()
        appt = Appointment.objects.create(
            patient=patient, doctor=doctor, date=day, start_time=start, end_time=end, reason=reason,
            status=status, cancellation_reason=cancel_reason,
            slot_key=None if status == AppointmentStatus.CANCELLED else Appointment.build_slot_key(doctor.pk, day, start),
            confirmed_at=timezone.now() if status == AppointmentStatus.COMPLETED else None,
            completed_at=timezone.now() if status == AppointmentStatus.COMPLETED else None,
            cancelled_at=timezone.now() if status == AppointmentStatus.CANCELLED else None,
            cancelled_by=patient.user if status == AppointmentStatus.CANCELLED else None,
        )
        AppointmentEvent.objects.create(appointment=appt, action="CREATED", to_status="PENDING", actor=patient.user)
        AppointmentEvent.objects.create(appointment=appt, action=status if status != "CANCELLED" else "CANCELLED",
                                        from_status="PENDING", to_status=status,
                                        actor=patient.user if status == "CANCELLED" else doctor.user,
                                        note=cancel_reason)
        Payment.objects.create(
            appointment=appt, amount=doctor.consultation_fee, currency=settings.CURRENCY,
            status=PaymentStatus.PAID if status == AppointmentStatus.COMPLETED else PaymentStatus.VOID,
            method="UPI" if status == AppointmentStatus.COMPLETED else "",
            transaction_reference=f"MOCK-SEED{appt.pk:08d}" if status == AppointmentStatus.COMPLETED else None,
            paid_at=timezone.now() if status == AppointmentStatus.COMPLETED else None,
        )
        return appt

    def seed_appointments(self, doctors, patients):
        if Appointment.objects.exists():
            self.stdout.write("Appointments already exist; skipping sample appointments.")
            return
        rahul, aisha, sanjay = patients
        ananya, rohan, priya = doctors[0], doctors[1], doctors[2]

        with transaction.atomic():
            visit = self._past_appointment(rahul, ananya, 12, time(10), AppointmentStatus.COMPLETED,
                                           "Fever and sore throat for three days.")
            record = MedicalRecord.objects.create(
                appointment=visit, symptoms="Fever (101°F), sore throat, mild body ache.",
                diagnosis="Acute viral pharyngitis.",
                notes="Throat congested, no exudate. Chest clear. Advised rest and fluids.",
                follow_up_instructions="Return if fever persists beyond 3 days or breathing difficulty develops.",
                is_released=True, released_at=timezone.now(), created_by=ananya.user,
            )
            rx = Prescription.objects.create(medical_record=record, notes="Take medicines after food.")
            PrescriptionItem.objects.bulk_create([
                PrescriptionItem(prescription=rx, medicine_name="Paracetamol", dosage="650 mg",
                                 frequency="Three times daily", duration="3 days", instructions="Only if fever"),
                PrescriptionItem(prescription=rx, medicine_name="Warm saline gargle", dosage="1 glass",
                                 frequency="Twice daily", duration="5 days"),
            ])
            self._past_appointment(rahul, priya, 30, time(9, 30), AppointmentStatus.CANCELLED,
                                   "Skin rash on forearm.", "Rash resolved before the visit.")
            self._past_appointment(aisha, rohan, 20, time(11), AppointmentStatus.COMPLETED,
                                   "Routine cardiac check-up and ECG review.")
            self._past_appointment(sanjay, ananya, 5, time(15), AppointmentStatus.COMPLETED,
                                   "Follow-up for blood pressure readings.")

        upcoming = [
            (rahul, rohan, 2, "Occasional chest tightness while climbing stairs.", True),
            (rahul, ananya, 4, "Annual health check-up.", False),
            (aisha, ananya, 1, "Persistent dry cough for two weeks.", True),
            (sanjay, ananya, 3, "Review of blood test results.", False),
            (aisha, priya, 6, "Acne treatment follow-up.", False),
        ]
        for patient, doctor, offset, reason, confirm in upcoming:
            day, start = self._next_free_slot(doctor, offset)
            if day is None:
                continue
            appt = book_appointment(patient=patient, doctor_id=doctor.pk, day=day, start_time=start,
                                    reason=reason, actor=patient.user)
            if confirm:
                confirm_appointment(appointment=appt, actor=doctor.user)
        self.stdout.write(f"Appointments: {Appointment.objects.count()}")
