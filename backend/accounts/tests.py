from rest_framework.test import APITestCase

from accounts.models import Role, User
from config.test_utils import PASSWORD, make_doctor, make_patient, make_specialization
from doctors.models import ApprovalStatus


class RegistrationTests(APITestCase):
    def payload(self, **overrides):
        data = {
            "full_name": "Asha Rao", "email": "Asha@Example.test", "phone": "+91 98765 43210",
            "password": PASSWORD, "confirm_password": PASSWORD, "date_of_birth": "1995-05-05",
            "gender": "FEMALE", "address": "22 Lake View, Pune",
        }
        data.update(overrides)
        return data

    def test_patient_registration_creates_patient_and_returns_tokens(self):
        res = self.client.post("/api/auth/register/", self.payload(), format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertIn("access", res.data)
        user = User.objects.get(email="asha@example.test")  # normalized to lower case
        self.assertEqual(user.role, Role.PATIENT)
        self.assertTrue(hasattr(user, "patient_profile"))
        self.assertNotEqual(user.password, PASSWORD)  # hashed

    def test_duplicate_email_rejected_case_insensitive(self):
        self.client.post("/api/auth/register/", self.payload(), format="json")
        res = self.client.post("/api/auth/register/", self.payload(email="ASHA@example.test"), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("email", res.data)

    def test_password_mismatch_and_weak_password(self):
        res = self.client.post("/api/auth/register/", self.payload(confirm_password="different"), format="json")
        self.assertIn("confirm_password", res.data)
        res = self.client.post("/api/auth/register/", self.payload(password="12345678", confirm_password="12345678"),
                               format="json")
        self.assertIn("password", res.data)

    def test_future_birth_date_rejected(self):
        res = self.client.post("/api/auth/register/", self.payload(date_of_birth="2999-01-01"), format="json")
        self.assertIn("date_of_birth", res.data)

    def test_registration_cannot_create_admin(self):
        res = self.client.post("/api/auth/register/", self.payload(role="ADMIN"), format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(User.objects.get(email="asha@example.test").role, Role.PATIENT)

    def test_doctor_application_is_pending(self):
        spec = make_specialization()
        data = {
            "full_name": "Kiran Das", "email": "kiran@example.test", "phone": "+91 9123456780",
            "password": PASSWORD, "confirm_password": PASSWORD, "specialization_id": spec.id,
            "license_number": "kmc-123", "qualifications": "MBBS", "experience_years": 4,
            "hospital": "Sun Clinic", "location": "Mysuru", "consultation_fee": "400.00",
        }
        res = self.client.post("/api/auth/register/doctor/", data, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        user = User.objects.get(email="kiran@example.test")
        self.assertEqual(user.role, Role.DOCTOR)
        self.assertEqual(user.doctor_profile.approval_status, ApprovalStatus.PENDING)
        # Not visible in the public directory until approved.
        res = self.client.get("/api/doctors/")
        self.assertEqual(res.data["count"], 0)


class LoginTests(APITestCase):
    def setUp(self):
        self.patient = make_patient()

    def login(self, email="patient@example.test", password=PASSWORD):
        return self.client.post("/api/auth/login/", {"email": email, "password": password}, format="json")

    def test_login_returns_tokens_and_role(self):
        res = self.login(email="PATIENT@example.test")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["user"]["role"], Role.PATIENT)
        self.assertIn("refresh", res.data)

    def test_wrong_password_gives_generic_error(self):
        res = self.login(password="wrong-password")
        self.assertEqual(res.status_code, 401)
        self.assertEqual(str(res.data["detail"]), "Invalid email or password.")

    def test_disabled_account_cannot_login(self):
        self.patient.user.is_active = False
        self.patient.user.save()
        self.assertEqual(self.login().status_code, 401)

    def test_invalid_token_is_rejected(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_refresh_and_logout_blacklists_refresh_token(self):
        tokens = self.login().data
        res = self.client.post("/api/auth/refresh/", {"refresh": tokens["refresh"]}, format="json")
        self.assertEqual(res.status_code, 200)
        new_refresh = res.data["refresh"]
        # Rotation blacklists the old refresh token.
        self.assertEqual(
            self.client.post("/api/auth/refresh/", {"refresh": tokens["refresh"]}, format="json").status_code, 401
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        self.assertEqual(self.client.post("/api/auth/logout/", {"refresh": new_refresh}, format="json").status_code, 205)
        self.assertEqual(
            self.client.post("/api/auth/refresh/", {"refresh": new_refresh}, format="json").status_code, 401
        )

    def test_change_password(self):
        tokens = self.login().data
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        res = self.client.post("/api/auth/change-password/", {
            "current_password": "nope", "new_password": "An0ther-Pass!", "confirm_password": "An0ther-Pass!",
        }, format="json")
        self.assertIn("current_password", res.data)
        res = self.client.post("/api/auth/change-password/", {
            "current_password": PASSWORD, "new_password": "An0ther-Pass!", "confirm_password": "An0ther-Pass!",
        }, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(self.login(password="An0ther-Pass!").status_code, 200)
        # Old refresh tokens are revoked.
        self.assertEqual(
            self.client.post("/api/auth/refresh/", {"refresh": tokens["refresh"]}, format="json").status_code, 401
        )

    def test_me_requires_authentication(self):
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)


class PatientProfileTests(APITestCase):
    def test_patient_can_view_and_update_own_profile_only(self):
        patient = make_patient()
        other = make_patient(email="other@example.test", name="Other Person")
        self.client.force_authenticate(patient.user)
        res = self.client.patch("/api/patients/profile/", {"address": "New address", "email": "x@y.test"},
                                format="json")
        self.assertEqual(res.status_code, 200, res.data)
        patient.refresh_from_db()
        self.assertEqual(patient.address, "New address")
        self.assertEqual(patient.user.email, "patient@example.test")  # email is read-only
        self.assertEqual(self.client.get(f"/api/patients/{other.id}/").status_code, 404)
        self.assertEqual(self.client.get("/api/patients/").data["count"], 1)

    def test_doctor_cannot_use_patient_profile_endpoint(self):
        doctor = make_doctor()
        self.client.force_authenticate(doctor.user)
        self.assertEqual(self.client.get("/api/patients/profile/").status_code, 403)
