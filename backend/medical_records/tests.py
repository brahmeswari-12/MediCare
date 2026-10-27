from rest_framework.test import APITestCase

from appointments.models import Appointment, AppointmentStatus
from appointments.services import book_appointment
from config.test_utils import client_for, make_admin, make_doctor, make_patient, next_weekday


class MedicalRecordAccessTests(APITestCase):
    def setUp(self):
        self.doctor = make_doctor()
        self.patient = make_patient()
        from datetime import time

        self.appt = book_appointment(patient=self.patient, doctor_id=self.doctor.id, day=next_weekday(0),
                                     start_time=time(9), reason="Back pain for days", actor=self.patient.user)
        self.doctor_client = client_for(self.doctor.user)
        self.patient_client = client_for(self.patient.user)

    def create_record(self, **extra):
        data = {"appointment": self.appt.id, "diagnosis": "Muscle strain", "notes": "Rest advised"}
        data.update(extra)
        return self.doctor_client.post("/api/medical-records/", data, format="json")

    def confirm(self):
        Appointment.objects.filter(pk=self.appt.pk).update(status=AppointmentStatus.CONFIRMED)

    def test_record_requires_confirmed_appointment(self):
        self.assertEqual(self.create_record().status_code, 400)
        self.confirm()
        self.assertEqual(self.create_record().status_code, 201)
        self.assertEqual(self.create_record().status_code, 400)  # only one per appointment

    def test_other_doctor_cannot_write_or_read(self):
        self.confirm()
        record_id = self.create_record().data["id"]
        other = client_for(make_doctor(email="other@example.test").user)
        res = other.post("/api/medical-records/", {"appointment": self.appt.id, "diagnosis": "x"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(other.get(f"/api/medical-records/{record_id}/").status_code, 404)

    def test_patient_sees_record_only_after_release(self):
        self.confirm()
        record_id = self.create_record().data["id"]
        self.assertEqual(self.patient_client.get(f"/api/medical-records/{record_id}/").status_code, 404)
        self.assertEqual(self.patient_client.get("/api/medical-records/").data["count"], 0)
        res = self.doctor_client.patch(f"/api/medical-records/{record_id}/", {"is_released": True}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.patient_client.get(f"/api/medical-records/{record_id}/").status_code, 200)
        # Patients cannot modify records.
        res = self.patient_client.patch(f"/api/medical-records/{record_id}/", {"diagnosis": "x"}, format="json")
        self.assertEqual(res.status_code, 403)

    def test_other_patient_and_admin_cannot_read(self):
        self.confirm()
        record_id = self.create_record(is_released=True).data["id"]
        stranger = client_for(make_patient(email="s@example.test").user)
        self.assertEqual(stranger.get(f"/api/medical-records/{record_id}/").status_code, 404)
        self.assertEqual(client_for(make_admin()).get("/api/medical-records/").status_code, 403)

    def test_prescriptions(self):
        self.confirm()
        record_id = self.create_record().data["id"]
        res = self.doctor_client.post("/api/prescriptions/", {
            "medical_record": record_id, "notes": "After food",
            "items": [{"medicine_name": "Ibuprofen", "dosage": "400 mg", "frequency": "Twice daily",
                       "duration": "5 days"}],
        }, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        empty = self.doctor_client.post("/api/prescriptions/", {"medical_record": record_id, "items": []},
                                        format="json")
        self.assertEqual(empty.status_code, 400)
        # Hidden from the patient until the record is released.
        self.assertEqual(self.patient_client.get("/api/prescriptions/").data["count"], 0)
        self.doctor_client.patch(f"/api/medical-records/{record_id}/", {"is_released": True}, format="json")
        self.assertEqual(self.patient_client.get("/api/prescriptions/").data["count"], 1)
        # Another doctor cannot attach a prescription to this record.
        other = client_for(make_doctor(email="o@example.test").user)
        res = other.post("/api/prescriptions/", {
            "medical_record": record_id,
            "items": [{"medicine_name": "X", "dosage": "1", "frequency": "1", "duration": "1"}],
        }, format="json")
        self.assertEqual(res.status_code, 400)
