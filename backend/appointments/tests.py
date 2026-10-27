import threading
import unittest
from datetime import time, timedelta
from unittest import mock

from django.db import connection
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from appointments.models import Appointment, AppointmentStatus
from config.test_utils import client_for, make_admin, make_doctor, make_patient, next_weekday
from doctors.models import DoctorBlockedDate
from payments.models import PaymentStatus


class BookingTests(APITestCase):
    def setUp(self):
        self.doctor = make_doctor()
        self.patient = make_patient()
        self.client = client_for(self.patient.user)
        self.monday = next_weekday(0)

    def book(self, start="09:00", day=None, client=None, doctor=None):
        return (client or self.client).post("/api/appointments/", {
            "doctor": (doctor or self.doctor).id, "date": (day or self.monday).isoformat(),
            "start_time": start, "reason": "Persistent headache for a week",
        }, format="json")

    def test_successful_booking(self):
        res = self.book()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data["reference"].startswith("APT-"))
        self.assertEqual(res.data["status"], AppointmentStatus.PENDING)
        self.assertEqual(res.data["end_time"], "09:30")
        self.assertEqual(res.data["doctor"]["specialization"]["name"], "General Physician")
        self.assertEqual(res.data["payment"]["status"], PaymentStatus.PENDING)
        self.assertEqual(res.data["events"][0]["action"], "CREATED")

    def test_double_booking_rejected(self):
        self.assertEqual(self.book().status_code, 201)
        other = make_patient(email="p2@example.test")
        res = self.book(client=client_for(other.user))
        self.assertEqual(res.status_code, 409)
        self.assertEqual(Appointment.objects.count(), 1)
        # The slot is reported as unavailable.
        slots = self.client.get(f"/api/doctors/{self.doctor.id}/availability/",
                                {"date": self.monday.isoformat()}).data["slots"]
        self.assertEqual(slots[0]["reason"], "booked")

    def test_patient_cannot_hold_overlapping_appointments(self):
        other_doctor = make_doctor(email="d2@example.test")
        self.assertEqual(self.book().status_code, 201)
        res = self.book(doctor=other_doctor)
        self.assertEqual(res.status_code, 400)

    def test_outside_schedule_rejected(self):
        self.assertEqual(self.book(start="15:00").status_code, 400)
        self.assertEqual(self.book(start="09:10").status_code, 400)  # not aligned to a slot

    def test_break_rejected(self):
        self.assertEqual(self.book(start="10:30").status_code, 400)

    def test_non_working_day_rejected(self):
        self.assertEqual(self.book(day=self.monday + timedelta(days=1)).status_code, 400)

    def test_blocked_date_rejected(self):
        DoctorBlockedDate.objects.create(doctor=self.doctor, date=self.monday)
        self.assertEqual(self.book().status_code, 400)

    def test_past_date_rejected(self):
        self.assertEqual(self.book(day=timezone.localdate() - timedelta(days=7)).status_code, 400)

    def test_unapproved_doctor_rejected(self):
        pending = make_doctor(email="pending@example.test", approved=False)
        self.assertEqual(self.book(doctor=pending).status_code, 400)

    def test_disabled_doctor_rejected(self):
        self.doctor.user.is_active = False
        self.doctor.user.save()
        self.assertEqual(self.book().status_code, 400)

    def test_only_patients_can_book(self):
        self.assertEqual(self.book(client=client_for(self.doctor.user)).status_code, 403)
        self.assertEqual(self.book(client=APIClient()).status_code, 401)

    def test_cancelled_slot_can_be_rebooked(self):
        appt_id = self.book().data["id"]
        res = self.client.post(f"/api/appointments/{appt_id}/cancel/", {"reason": "Plans changed"}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["payment"]["status"], PaymentStatus.VOID)
        other = make_patient(email="p2@example.test")
        self.assertEqual(self.book(client=client_for(other.user)).status_code, 201)


class AppointmentLifecycleTests(APITestCase):
    def setUp(self):
        self.doctor = make_doctor()
        self.patient = make_patient()
        self.patient_client = client_for(self.patient.user)
        self.doctor_client = client_for(self.doctor.user)
        self.monday = next_weekday(0)
        res = self.patient_client.post("/api/appointments/", {
            "doctor": self.doctor.id, "date": self.monday.isoformat(), "start_time": "09:00",
            "reason": "Routine check-up visit",
        }, format="json")
        self.appt_id = res.data["id"]

    def url(self, suffix=""):
        return f"/api/appointments/{self.appt_id}/{suffix}"

    def test_access_is_scoped(self):
        stranger = make_patient(email="stranger@example.test")
        other_doctor = make_doctor(email="d2@example.test")
        self.assertEqual(client_for(stranger.user).get(self.url()).status_code, 404)
        self.assertEqual(client_for(other_doctor.user).get(self.url()).status_code, 404)
        self.assertEqual(self.doctor_client.get(self.url()).status_code, 200)
        self.assertEqual(client_for(make_admin()).get(self.url()).status_code, 200)
        self.assertEqual(client_for(stranger.user).get("/api/appointments/").data["count"], 0)

    def test_doctor_confirms_patient_cannot(self):
        self.assertEqual(self.patient_client.post(self.url("confirm/")).status_code, 403)
        res = self.doctor_client.post(self.url("confirm/"))
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], AppointmentStatus.CONFIRMED)

    def test_invalid_transitions_rejected(self):
        # Pending -> completed is not allowed.
        self.assertEqual(self.doctor_client.post(self.url("complete/")).status_code, 400)
        self.doctor_client.post(self.url("cancel/"), {"reason": "Doctor unavailable"}, format="json")
        # Cancelled is terminal.
        self.assertEqual(self.doctor_client.post(self.url("confirm/")).status_code, 400)
        res = self.doctor_client.patch(self.url(), {"status": "CONFIRMED"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_future_appointment_cannot_be_completed(self):
        self.doctor_client.post(self.url("confirm/"))
        self.assertEqual(self.doctor_client.post(self.url("complete/")).status_code, 400)

    def test_complete_on_appointment_day(self):
        self.doctor_client.post(self.url("confirm/"))
        Appointment.objects.filter(pk=self.appt_id).update(date=timezone.localdate())
        res = self.doctor_client.post(self.url("complete/"))
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], AppointmentStatus.COMPLETED)

    def test_cancel_requires_reason(self):
        res = self.patient_client.post(self.url("cancel/"), {"reason": ""}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_patient_cancellation_window(self):
        with self.settings(CANCELLATION_MIN_HOURS=24 * 30):
            res = self.patient_client.post(self.url("cancel/"), {"reason": "Cannot attend"}, format="json")
            self.assertEqual(res.status_code, 400)
            # Doctors are not bound by the patient window.
            res = self.doctor_client.post(self.url("cancel/"), {"reason": "Emergency leave"}, format="json")
            self.assertEqual(res.status_code, 200)

    def test_reschedule_moves_slot_and_frees_old_one(self):
        self.doctor_client.post(self.url("confirm/"))
        res = self.patient_client.post(self.url("reschedule/"), {"date": self.monday.isoformat(), "start_time": "11:00"},
                                       format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["start_time"], "11:00")
        self.assertEqual(res.data["status"], AppointmentStatus.PENDING)  # needs re-confirmation
        self.assertEqual(res.data["events"][-1]["action"], "RESCHEDULED")
        # Old slot is free again.
        other = make_patient(email="p2@example.test")
        res = client_for(other.user).post("/api/appointments/", {
            "doctor": self.doctor.id, "date": self.monday.isoformat(), "start_time": "09:00",
            "reason": "Fever and cough",
        }, format="json")
        self.assertEqual(res.status_code, 201)

    def test_reschedule_into_taken_slot_rejected(self):
        other = make_patient(email="p2@example.test")
        client_for(other.user).post("/api/appointments/", {
            "doctor": self.doctor.id, "date": self.monday.isoformat(), "start_time": "11:00",
            "reason": "Fever and cough",
        }, format="json")
        res = self.patient_client.post(self.url("reschedule/"), {"date": self.monday.isoformat(), "start_time": "11:00"},
                                       format="json")
        self.assertEqual(res.status_code, 409)
        self.assertEqual(Appointment.objects.get(pk=self.appt_id).start_time, time(9))

    def test_doctor_cannot_reschedule(self):
        res = self.doctor_client.post(self.url("reschedule/"), {"date": self.monday.isoformat(), "start_time": "11:00"},
                                      format="json")
        self.assertEqual(res.status_code, 403)

    def test_filters(self):
        self.assertEqual(self.patient_client.get("/api/appointments/", {"status": "PENDING"}).data["count"], 1)
        self.assertEqual(self.patient_client.get("/api/appointments/", {"status": "COMPLETED"}).data["count"], 0)
        self.assertEqual(self.patient_client.get("/api/appointments/", {"scope": "upcoming"}).data["count"], 1)
        self.assertEqual(self.patient_client.get("/api/appointments/", {"scope": "past"}).data["count"], 0)


class ConcurrentBookingTests(TransactionTestCase):
    """Fires simultaneous booking requests for one slot; exactly one must win.

    Requires a database with row-level locking (MySQL). SQLite serializes all
    writes with a database lock and cannot exercise this path.
    """

    def test_simultaneous_requests_for_same_slot(self):
        if connection.vendor == "sqlite":
            raise unittest.SkipTest("Concurrency test requires MySQL.")
        doctor = make_doctor()
        monday = next_weekday(0)
        patients = [make_patient(email=f"c{i}@example.test") for i in range(5)]
        results = []
        barrier = threading.Barrier(len(patients))

        def attempt(patient):
            from django.db import connection as thread_connection

            client = client_for(patient.user)
            barrier.wait()
            try:
                res = client.post("/api/appointments/", {
                    "doctor": doctor.id, "date": monday.isoformat(), "start_time": "09:00",
                    "reason": "Concurrent booking test",
                }, format="json")
                results.append(res.status_code)
            finally:
                thread_connection.close()

        threads = [threading.Thread(target=attempt, args=(p,)) for p in patients]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(sorted(results), [201, 409, 409, 409, 409])
        self.assertEqual(Appointment.objects.filter(doctor=doctor, date=monday).count(), 1)


class SlotKeyConstraintTests(APITestCase):
    def test_unique_slot_key_is_last_line_of_defence(self):
        """Even if availability checks were bypassed, the DB refuses a duplicate slot."""
        doctor = make_doctor()
        p1, p2 = make_patient(), make_patient(email="p2@example.test")
        monday = next_weekday(0)
        client_for(p1.user).post("/api/appointments/", {
            "doctor": doctor.id, "date": monday.isoformat(), "start_time": "09:00", "reason": "First booking",
        }, format="json")
        unrestricted = {"date": monday, "available": True, "message": "", "slots": [
            {"start_time": time(9), "end_time": time(9, 30), "available": True, "reason": "", "slot_duration": 30}
        ]}
        with mock.patch("appointments.services.day_availability", return_value=unrestricted):
            res = client_for(p2.user).post("/api/appointments/", {
                "doctor": doctor.id, "date": monday.isoformat(), "start_time": "09:00", "reason": "Second booking",
            }, format="json")
        self.assertEqual(res.status_code, 409)
        self.assertEqual(Appointment.objects.count(), 1)
