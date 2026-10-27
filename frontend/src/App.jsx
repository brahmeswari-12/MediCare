import { Route, Routes } from "react-router-dom";
import PublicLayout from "./layouts/PublicLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import ProtectedRoute, { GuestOnly } from "./routes/ProtectedRoute";

import Home from "./pages/public/Home";
import About from "./pages/public/About";
import Doctors from "./pages/public/Doctors";
import DoctorDetail from "./pages/public/DoctorDetail";
import Specialties from "./pages/public/Specialties";
import Login from "./pages/public/Login";
import Register from "./pages/public/Register";
import DoctorApply from "./pages/public/DoctorApply";
import NotFound from "./pages/public/NotFound";

import AppointmentDetail from "./pages/shared/AppointmentDetail";
import RecordDetail from "./pages/shared/RecordDetail";
import AccountSecurity from "./pages/shared/AccountSecurity";

import PatientDashboard from "./pages/patient/PatientDashboard";
import BookAppointment from "./pages/patient/BookAppointment";
import BookingConfirmation from "./pages/patient/BookingConfirmation";
import PatientAppointments from "./pages/patient/PatientAppointments";
import PatientRecords from "./pages/patient/PatientRecords";
import PatientPrescriptions from "./pages/patient/PatientPrescriptions";
import PatientPayments from "./pages/patient/PatientPayments";
import PatientProfile from "./pages/patient/PatientProfile";

import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import DoctorAppointments from "./pages/doctor/DoctorAppointments";
import DoctorSchedule from "./pages/doctor/DoctorSchedule";
import BlockedDates from "./pages/doctor/BlockedDates";
import DoctorPatients from "./pages/doctor/DoctorPatients";
import DoctorRecords from "./pages/doctor/DoctorRecords";
import RecordEditor from "./pages/doctor/RecordEditor";
import DoctorPrescriptions from "./pages/doctor/DoctorPrescriptions";
import DoctorProfile from "./pages/doctor/DoctorProfile";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminApprovals from "./pages/admin/AdminApprovals";
import AdminDoctors from "./pages/admin/AdminDoctors";
import AdminPatients from "./pages/admin/AdminPatients";
import AdminAppointments from "./pages/admin/AdminAppointments";
import AdminSpecializations from "./pages/admin/AdminSpecializations";
import AdminSupplies from "./pages/admin/AdminSupplies";

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="doctors" element={<Doctors />} />
        <Route path="doctors/:id" element={<DoctorDetail />} />
        <Route path="specialties" element={<Specialties />} />
        <Route path="login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="register" element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="register/doctor" element={<GuestOnly><DoctorApply /></GuestOnly>} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route element={<ProtectedRoute roles={["PATIENT"]} />}>
        <Route path="patient" element={<DashboardLayout />}>
          <Route index element={<PatientDashboard />} />
          <Route path="book/:doctorId" element={<BookAppointment />} />
          <Route path="appointments" element={<PatientAppointments />} />
          <Route path="appointments/:id" element={<AppointmentDetail />} />
          <Route path="appointments/:id/confirmation" element={<BookingConfirmation />} />
          <Route path="records" element={<PatientRecords />} />
          <Route path="records/:id" element={<RecordDetail />} />
          <Route path="prescriptions" element={<PatientPrescriptions />} />
          <Route path="payments" element={<PatientPayments />} />
          <Route path="profile" element={<PatientProfile />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={["DOCTOR"]} />}>
        <Route path="doctor" element={<DashboardLayout />}>
          <Route index element={<DoctorDashboard />} />
          <Route path="appointments" element={<DoctorAppointments />} />
          <Route path="appointments/:id" element={<AppointmentDetail />} />
          <Route path="schedule" element={<DoctorSchedule />} />
          <Route path="blocked-dates" element={<BlockedDates />} />
          <Route path="patients" element={<DoctorPatients />} />
          <Route path="records" element={<DoctorRecords />} />
          <Route path="records/new" element={<RecordEditor />} />
          <Route path="records/:id" element={<RecordDetail />} />
          <Route path="records/:id/edit" element={<RecordEditor />} />
          <Route path="prescriptions" element={<DoctorPrescriptions />} />
          <Route path="profile" element={<DoctorProfile />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
        <Route path="admin" element={<DashboardLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="approvals" element={<AdminApprovals />} />
          <Route path="doctors" element={<AdminDoctors />} />
          <Route path="patients" element={<AdminPatients />} />
          <Route path="appointments" element={<AdminAppointments />} />
          <Route path="appointments/:id" element={<AppointmentDetail />} />
          <Route path="specializations" element={<AdminSpecializations />} />
          <Route path="supplies" element={<AdminSupplies />} />
          <Route path="account" element={<AccountSecurity />} />
        </Route>
      </Route>
    </Routes>
  );
}
