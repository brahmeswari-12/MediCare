from datetime import time

from rest_framework.test import APITestCase

from appointments.services import book_appointment, cancel_appointment, confirm_appointment
from config.test_utils import client_for, make_admin, make_doctor, make_patient, next_weekday
from payments.models import PaymentStatus


class AdminPermissionTests(APITestCase):
    def test_non_admins_are_forbidden(self):
        patient = make_patient()
        doctor = make_doctor()
        for user in (patient.user, doctor.user):
            client = client_for(user)
            for url in ("/api/admin/dashboard/", "/api/admin/patients/", "/api/admin/doctors/",
                        "/api/admin/appointments/", "/api/inventory/supplies/"):
                self.assertEqual(client.get(url).status_code, 403, url)
        self.assertEqual(self.client.get("/api/admin/dashboard/").status_code, 401)


class AdminStatsTests(APITestCase):
    def setUp(self):
        self.admin = client_for(make_admin())
        self.doctor = make_doctor()
        make_doctor(email="pending@example.test", approved=False)
        self.p1 = make_patient()
        self.p2 = make_patient(email="p2@example.test")
        disabled = make_patient(email="p3@example.test")
        disabled.user.is_active = False
        disabled.user.save()
        monday = next_weekday(0)
        a1 = book_appointment(patient=self.p1, doctor_id=self.doctor.id, day=monday, start_time=time(9),
                              reason="Visit one", actor=self.p1.user)
        a2 = book_appointment(patient=self.p2, doctor_id=self.doctor.id, day=monday, start_time=time(9, 30),
                              reason="Visit two", actor=self.p2.user)
        book_appointment(patient=self.p1, doctor_id=self.doctor.id, day=monday, start_time=time(11),
                         reason="Visit three", actor=self.p1.user)
        confirm_appointment(appointment=a1, actor=self.doctor.user)
        cancel_appointment(appointment=a2, actor=self.p2.user, reason="Not needed")

    def test_dashboard_counts_come_from_database(self):
        data = self.admin.get("/api/admin/dashboard/").data
        self.assertEqual(data["patients"]["active"], 2)
        self.assertEqual(data["doctors"]["approved"], 1)
        self.assertEqual(data["doctors"]["pending"], 1)
        self.assertEqual(data["appointments"]["total"], 3)
        self.assertEqual(data["appointments"]["pending"], 1)
        self.assertEqual(data["appointments"]["confirmed"], 1)
        self.assertEqual(data["appointments"]["cancelled"], 1)
        self.assertEqual(data["appointments"]["completed"], 0)

    def test_approve_reject_disable_doctor(self):
        pending_id = self.admin.get("/api/admin/doctors/", {"approval_status": "PENDING"}).data["results"][0]["id"]
        res = self.admin.post(f"/api/admin/doctors/{pending_id}/approve/")
        self.assertEqual(res.data["approval_status"], "APPROVED")
        self.assertEqual(self.client.get(f"/api/doctors/{pending_id}/").status_code, 200)
        res = self.admin.post(f"/api/admin/doctors/{pending_id}/disable/")
        self.assertFalse(res.data["is_active"])
        self.assertEqual(self.client.get(f"/api/doctors/{pending_id}/").status_code, 404)
        # Doctor with upcoming appointments cannot be rejected.
        res = self.admin.post(f"/api/admin/doctors/{self.doctor.id}/reject/", {"reason": "Invalid license"},
                              format="json")
        self.assertEqual(res.status_code, 400)

    def test_disable_patient_preserves_history(self):
        res = self.admin.post(f"/api/admin/patients/{self.p1.id}/disable/")
        self.assertFalse(res.data["is_active"])
        self.assertEqual(self.admin.get("/api/admin/appointments/", {"patient": self.p1.id}).data["count"], 2)

    def test_admin_search_and_cancel(self):
        res = self.admin.get("/api/admin/appointments/", {"search": self.p2.user.full_name, "status": "CANCELLED"})
        self.assertEqual(res.data["count"], 1)
        appt_id = self.admin.get("/api/admin/appointments/", {"status": "CONFIRMED"}).data["results"][0]["id"]
        res = self.admin.post(f"/api/appointments/{appt_id}/cancel/", {"reason": "Clinic closed"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["cancelled_by_role"], "ADMIN")

    def test_admin_appointment_endpoint_is_read_only(self):
        appt_id = self.admin.get("/api/admin/appointments/").data["results"][0]["id"]
        self.assertEqual(self.admin.post(f"/api/admin/appointments/{appt_id}/cancel/", {"reason": "x"}).status_code, 405)


class PaymentTests(APITestCase):
    def test_mock_payment_flow_and_refund(self):
        doctor = make_doctor()
        patient = make_patient()
        appt = book_appointment(patient=patient, doctor_id=doctor.id, day=next_weekday(0), start_time=time(9),
                                reason="Checkup visit", actor=patient.user)
        client = client_for(patient.user)
        payment_id = client.get("/api/payments/").data["results"][0]["id"]
        self.assertEqual(client_for(doctor.user).post(f"/api/payments/{payment_id}/pay/", {"method": "UPI"}).status_code, 403)
        res = client.post(f"/api/payments/{payment_id}/pay/", {"method": "UPI"}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], PaymentStatus.PAID)
        self.assertTrue(res.data["transaction_reference"].startswith("MOCK-"))
        self.assertTrue(res.data["is_mock"])
        self.assertEqual(client.post(f"/api/payments/{payment_id}/pay/", {"method": "UPI"}).status_code, 400)
        cancel_appointment(appointment=appt, actor=patient.user, reason="Changed plans")
        self.assertEqual(client.get(f"/api/payments/{payment_id}/").data["status"], PaymentStatus.REFUNDED)
        stranger = client_for(make_patient(email="s@example.test").user)
        self.assertEqual(stranger.get(f"/api/payments/{payment_id}/").status_code, 404)


class InventoryTests(APITestCase):
    def test_crud_and_low_stock(self):
        admin = client_for(make_admin())
        res = admin.post("/api/inventory/supplies/", {"name": "Gloves", "sku": "glv-1", "quantity": 5,
                                                      "minimum_stock_level": 10}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["sku"], "GLV-1")
        self.assertTrue(res.data["is_low_stock"])
        dup = admin.post("/api/inventory/supplies/", {"name": "Gloves 2", "sku": "GLV-1"}, format="json")
        self.assertEqual(dup.status_code, 400)
        self.assertEqual(admin.get("/api/inventory/supplies/", {"low_stock": "true"}).data["count"], 1)
        self.assertEqual(admin.get("/api/inventory/supplies/stats/").data["low_stock_items"], 1)
