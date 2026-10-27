/* Thin wrappers around the REST API, grouped by domain. Every function returns
   the response body (or throws an axios error handled by utils/errors). */
import api from "./api";

const data = (promise) => promise.then((res) => res.data);

export const authApi = {
  login: (email, password) => data(api.post("/auth/login/", { email, password })),
  register: (payload) => data(api.post("/auth/register/", payload)),
  applyAsDoctor: (payload) => data(api.post("/auth/register/doctor/", payload)),
  logout: (refresh) => data(api.post("/auth/logout/", { refresh })),
  me: () => data(api.get("/auth/me/")),
  changePassword: (payload) => data(api.post("/auth/change-password/", payload)),
};

export const specializationApi = {
  list: (params) => data(api.get("/specializations/", { params })),
  create: (payload) => data(api.post("/specializations/", payload)),
  update: (id, payload) => data(api.patch(`/specializations/${id}/`, payload)),
  remove: (id) => data(api.delete(`/specializations/${id}/`)),
};

export const doctorApi = {
  list: (params) => data(api.get("/doctors/", { params })),
  get: (id) => data(api.get(`/doctors/${id}/`)),
  create: (payload) => data(api.post("/doctors/", payload)),
  update: (id, payload) => data(api.patch(`/doctors/${id}/`, payload)),
  remove: (id) => data(api.delete(`/doctors/${id}/`)),
  me: () => data(api.get("/doctors/me/")),
  updateMe: (payload) => data(api.patch("/doctors/me/", payload)),
  schedule: (id) => data(api.get(`/doctors/${id}/schedule/`)),
  availability: (id, date) => data(api.get(`/doctors/${id}/availability/`, { params: { date } })),
  availableDates: (id, params) => data(api.get(`/doctors/${id}/available-dates/`, { params })),
};

export const scheduleApi = {
  list: () => data(api.get("/schedules/")),
  create: (payload) => data(api.post("/schedules/", payload)),
  update: (id, payload) => data(api.patch(`/schedules/${id}/`, payload)),
  remove: (id) => data(api.delete(`/schedules/${id}/`)),
  blockedDates: (params) => data(api.get("/schedules/blocked-dates/", { params })),
  blockDate: (payload) => data(api.post("/schedules/blocked-dates/", payload)),
  unblockDate: (id) => data(api.delete(`/schedules/blocked-dates/${id}/`)),
};

export const appointmentApi = {
  list: (params) => data(api.get("/appointments/", { params })),
  get: (id) => data(api.get(`/appointments/${id}/`)),
  create: (payload) => data(api.post("/appointments/", payload)),
  update: (id, payload) => data(api.patch(`/appointments/${id}/`, payload)),
  cancel: (id, reason) => data(api.post(`/appointments/${id}/cancel/`, { reason })),
  reschedule: (id, payload) => data(api.post(`/appointments/${id}/reschedule/`, payload)),
  confirm: (id) => data(api.post(`/appointments/${id}/confirm/`)),
  complete: (id) => data(api.post(`/appointments/${id}/complete/`)),
};

export const patientApi = {
  list: (params) => data(api.get("/patients/", { params })),
  get: (id) => data(api.get(`/patients/${id}/`)),
  profile: () => data(api.get("/patients/profile/")),
  updateProfile: (payload) => data(api.patch("/patients/profile/", payload)),
};

export const recordApi = {
  list: (params) => data(api.get("/medical-records/", { params })),
  get: (id) => data(api.get(`/medical-records/${id}/`)),
  create: (payload) => data(api.post("/medical-records/", payload)),
  update: (id, payload) => data(api.patch(`/medical-records/${id}/`, payload)),
};

export const prescriptionApi = {
  list: (params) => data(api.get("/prescriptions/", { params })),
  create: (payload) => data(api.post("/prescriptions/", payload)),
};

export const paymentApi = {
  list: (params) => data(api.get("/payments/", { params })),
  pay: (id, method) => data(api.post(`/payments/${id}/pay/`, { method })),
};

export const adminApi = {
  dashboard: () => data(api.get("/admin/dashboard/")),
  patients: (params) => data(api.get("/admin/patients/", { params })),
  createPatient: (payload) => data(api.post("/admin/patients/", payload)),
  updatePatient: (id, payload) => data(api.patch(`/admin/patients/${id}/`, payload)),
  setPatientActive: (id, active) => data(api.post(`/admin/patients/${id}/${active ? "enable" : "disable"}/`)),
  doctors: (params) => data(api.get("/admin/doctors/", { params })),
  doctor: (id) => data(api.get(`/admin/doctors/${id}/`)),
  updateDoctor: (id, payload) => data(api.patch(`/admin/doctors/${id}/`, payload)),
  approveDoctor: (id) => data(api.post(`/admin/doctors/${id}/approve/`)),
  rejectDoctor: (id, reason) => data(api.post(`/admin/doctors/${id}/reject/`, { reason })),
  setDoctorActive: (id, active) => data(api.post(`/admin/doctors/${id}/${active ? "enable" : "disable"}/`)),
  appointments: (params) => data(api.get("/admin/appointments/", { params })),
};

export const inventoryApi = {
  list: (params) => data(api.get("/inventory/supplies/", { params })),
  stats: () => data(api.get("/inventory/supplies/stats/")),
  create: (payload) => data(api.post("/inventory/supplies/", payload)),
  update: (id, payload) => data(api.patch(`/inventory/supplies/${id}/`, payload)),
  remove: (id) => data(api.delete(`/inventory/supplies/${id}/`)),
};
