from datetime import time, timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from config.test_utils import client_for, make_admin, make_doctor, make_patient, make_specialization, next_weekday
from doctors.models import DoctorBlockedDate, DoctorSchedule


class ScheduleValidationTests(APITestCase):
    def setUp(self):
        self.doctor = make_doctor()  # Monday 09:00-12:00 already exists
        self.client = client_for(self.doctor.user)

    def post(self, **data):
        payload = {"weekday": 0, "start_time": "13:00", "end_time": "17:00", "slot_duration": 30}
        payload.update(data)
        return self.client.post("/api/schedules/", payload, format="json")

    def test_create_second_interval_same_day(self):
        res = self.post()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(DoctorSchedule.objects.filter(doctor=self.doctor, weekday=0).count(), 2)

    def test_overlapping_interval_rejected(self):
        res = self.post(start_time="11:30", end_time="14:00")
        self.assertEqual(res.status_code, 400)
        self.assertIn("start_time", res.data)

    def test_end_before_start_rejected(self):
        self.assertIn("end_time", self.post(start_time="15:00", end_time="14:00").data)

    def test_break_outside_interval_rejected(self):
        self.assertIn("break_start", self.post(break_start="12:00", break_end="13:30").data)

    def test_break_requires_both_ends(self):
        res = self.post(break_start="14:00")
        self.assertEqual(res.status_code, 400)

    def test_duration_longer_than_interval_rejected(self):
        self.assertIn("slot_duration", self.post(start_time="13:00", end_time="13:20", slot_duration=30).data)

    def test_update_does_not_conflict_with_itself(self):
        schedule = DoctorSchedule.objects.get(doctor=self.doctor)
        res = self.client.patch(f"/api/schedules/{schedule.id}/", {"end_time": "12:30"}, format="json")
        self.assertEqual(res.status_code, 200, res.data)

    def test_doctor_cannot_touch_another_doctors_schedule(self):
        other = make_doctor(email="other@example.test")
        schedule = other.schedules.first()
        self.assertEqual(self.client.delete(f"/api/schedules/{schedule.id}/").status_code, 404)

    def test_patient_cannot_create_schedule(self):
        patient_client = client_for(make_patient().user)
        res = patient_client.post("/api/schedules/", {"weekday": 1, "start_time": "09:00", "end_time": "10:00"},
                                  format="json")
        self.assertEqual(res.status_code, 403)

    def test_block_date_and_reject_past_or_duplicate(self):
        day = timezone.localdate() + timedelta(days=5)
        self.assertEqual(self.client.post("/api/schedules/blocked-dates/", {"date": day}, format="json").status_code, 201)
        self.assertEqual(self.client.post("/api/schedules/blocked-dates/", {"date": day}, format="json").status_code, 400)
        past = timezone.localdate() - timedelta(days=1)
        self.assertEqual(self.client.post("/api/schedules/blocked-dates/", {"date": past}, format="json").status_code, 400)


class AvailabilityTests(APITestCase):
    def setUp(self):
        self.doctor = make_doctor()
        self.monday = next_weekday(0)

    def availability(self, day):
        return self.client.get(f"/api/doctors/{self.doctor.id}/availability/", {"date": day.isoformat()})

    def test_slots_respect_break(self):
        res = self.availability(self.monday)
        self.assertEqual(res.status_code, 200)
        starts = [s["start_time"] for s in res.data["slots"]]
        # 09:00-12:00 with a 10:30-11:00 break.
        self.assertEqual(starts, ["09:00", "09:30", "10:00", "11:00", "11:30"])
        self.assertTrue(all(s["available"] for s in res.data["slots"]))

    def test_non_working_day_has_no_slots(self):
        res = self.availability(self.monday + timedelta(days=1))
        self.assertEqual(res.data["slots"], [])
        self.assertFalse(res.data["available"])

    def test_blocked_date_has_no_slots(self):
        DoctorBlockedDate.objects.create(doctor=self.doctor, date=self.monday)
        self.assertEqual(self.availability(self.monday).data["slots"], [])

    def test_past_date_has_no_slots(self):
        self.assertEqual(self.availability(timezone.localdate() - timedelta(days=7)).data["slots"], [])

    def test_invalid_date_returns_400(self):
        res = self.client.get(f"/api/doctors/{self.doctor.id}/availability/", {"date": "nope"})
        self.assertEqual(res.status_code, 400)

    def test_interval_cap(self):
        schedule = self.doctor.schedules.first()
        schedule.max_appointments = 1
        schedule.save()
        from appointments.services import book_appointment

        patient = make_patient()
        book_appointment(patient=patient, doctor_id=self.doctor.id, day=self.monday, start_time=time(9),
                         reason="Check-up visit", actor=patient.user)
        slots = self.availability(self.monday).data["slots"]
        self.assertFalse(any(s["available"] for s in slots))

    def test_unapproved_doctor_hidden(self):
        pending = make_doctor(email="pending@example.test", approved=False)
        self.assertEqual(self.client.get(f"/api/doctors/{pending.id}/").status_code, 404)
        self.assertEqual(
            client_for(make_admin()).get(f"/api/doctors/{pending.id}/").status_code, 200
        )


class DoctorDirectoryTests(APITestCase):
    def setUp(self):
        cardio = make_specialization("Cardiologist")
        make_doctor(email="a@example.test", name="Asha Heart", specialization=cardio, fee="1200.00")
        make_doctor(email="b@example.test", name="Bala General", fee="400.00")

    def test_filters(self):
        self.assertEqual(self.client.get("/api/doctors/", {"specialization": "cardiologist"}).data["count"], 1)
        self.assertEqual(self.client.get("/api/doctors/", {"max_fee": 500}).data["count"], 1)
        self.assertEqual(self.client.get("/api/doctors/", {"search": "bala"}).data["count"], 1)
        self.assertEqual(self.client.get("/api/doctors/", {"available_on": next_weekday(0)}).data["count"], 2)
        self.assertEqual(self.client.get("/api/doctors/", {"available_on": next_weekday(2)}).data["count"], 0)

    def test_public_listing_hides_private_fields(self):
        doctor = self.client.get("/api/doctors/").data["results"][0]
        for field in ("email", "phone", "license_number", "approval_status"):
            self.assertNotIn(field, doctor)

    def test_doctor_can_edit_own_profile_but_not_others(self):
        a = make_doctor(email="c@example.test", name="Chitra")
        b = make_doctor(email="d@example.test", name="Deepak")
        client = client_for(a.user)
        res = client.patch("/api/doctors/me/", {"bio": "Updated bio", "license_number": "HACK"}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        a.refresh_from_db()
        self.assertEqual(a.bio, "Updated bio")
        self.assertNotEqual(a.license_number, "HACK")
        self.assertEqual(client.patch(f"/api/doctors/{b.id}/", {"bio": "x"}, format="json").status_code, 403)

    def test_only_admin_creates_doctors(self):
        spec = make_specialization()
        data = {"full_name": "New Doc", "email": "new@example.test", "password": "Str0ng-Pass!x",
                "specialization_id": spec.id, "license_number": "NEW-1", "qualifications": "MBBS",
                "experience_years": 3, "hospital": "H", "location": "L", "consultation_fee": "300"}
        self.assertEqual(self.client.post("/api/doctors/", data, format="json").status_code, 401)
        res = client_for(make_admin()).post("/api/doctors/", data, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["approval_status"], "APPROVED")

    def test_specialization_delete_protected(self):
        admin_client = client_for(make_admin())
        spec = make_specialization("Cardiologist")
        self.assertEqual(admin_client.delete(f"/api/specializations/{spec.id}/").status_code, 400)
        empty = make_specialization("Dentist")
        self.assertEqual(admin_client.delete(f"/api/specializations/{empty.id}/").status_code, 204)
        patient_client = client_for(make_patient().user)
        self.assertEqual(patient_client.post("/api/specializations/", {"name": "X"}, format="json").status_code, 403)
