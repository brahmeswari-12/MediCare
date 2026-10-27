# REST API reference

Base URL: `http://127.0.0.1:8000/api`

**Authentication:** send `Authorization: Bearer <access token>`. Endpoints marked *public* work without a token.

**List endpoints** are paginated: `?page=N&page_size=M` (default 10, max 100). They return `{count, next, previous, results}`. Most lists also accept `?search=` and `?ordering=` (prefix `-` for descending).

**Errors:** `400` returns `{field: ["message"]}` and/or `{"detail": "message"}`. `401` means unauthenticated, `403` means wrong role, `404` means not found or not yours, and `409` means a slot conflict.

Dates use `YYYY-MM-DD` and times use `HH:MM` (24-hour, server time zone `TIME_ZONE`).

---

## Auth: `/api/auth/`

| Method | Path | Access | Body / notes |
|---|---|---|---|
| POST | `/auth/register/` | public | `full_name, email, phone, password, confirm_password, date_of_birth, gender (MALE/FEMALE/OTHER/UNDISCLOSED), address`. Creates a **patient** and returns `{user, access, refresh}` |
| POST | `/auth/register/doctor/` | public | `full_name, email, phone, password, confirm_password, specialization_id, license_number, qualifications, experience_years, hospital, location, consultation_fee, bio?`. Creates a **pending** doctor |
| POST | `/auth/login/` | public | `email, password` returns `{access, refresh, user}` |
| POST | `/auth/refresh/` | public | `refresh` returns a new `{access, refresh}`; the old refresh token is blacklisted |
| POST | `/auth/logout/` | auth | `refresh` (blacklisted); returns 205 |
| GET | `/auth/me/` | auth | user, role, `patient_id` / `doctor_id`, `approval_status` |
| POST | `/auth/change-password/` | auth | `current_password, new_password, confirm_password`. Revokes all refresh tokens and returns new tokens |

## Patients: `/api/patients/`

| Method | Path | Access |
|---|---|---|
| GET | `/patients/` | Admin: all. Doctor: own patients (limited fields). Patient: self |
| GET, PATCH | `/patients/profile/` | Patient (own profile; email is read-only) |
| GET | `/patients/{id}/` | Same scoping as the list |

## Specializations

| Method | Path | Access |
|---|---|---|
| GET | `/specializations/` | public (admins also see inactive). Includes `doctor_count` |
| POST | `/specializations/` | Admin: `name, description?, icon?, is_active?` (slug auto-generated) |
| PATCH | `/specializations/{id}/` | Admin |
| DELETE | `/specializations/{id}/` | Admin. Returns 400 if any doctor uses it |

## Doctors

| Method | Path | Access / notes |
|---|---|---|
| GET | `/doctors/` | public. Approved and active doctors only. Filters: `search, name, specialization (id or slug), hospital, location, min_fee, max_fee, available_on=YYYY-MM-DD`; `ordering=consultation_fee,-experience_years,…` |
| GET | `/doctors/{id}/` | public |
| POST | `/doctors/` | Admin: creates an account (`email, password, full_name, specialization_id, license_number, …, approve=true`) |
| PATCH | `/doctors/{id}/` | Admin, or the doctor themselves (limited fields) |
| DELETE | `/doctors/{id}/` | Admin. **Soft delete** (disables the account) |
| GET, PATCH | `/doctors/me/` | Doctor's own profile; multipart `photo` upload (≤ 2 MB) supported |
| GET | `/doctors/{id}/schedule/` | public: active intervals and blocked dates (reasons only for owner/admin) |
| GET | `/doctors/{id}/availability/?date=YYYY-MM-DD` | public. `{date, available, message, slots:[{start_time, end_time, available, reason}]}`; `reason` is `booked`, `past` or `capacity` |
| GET | `/doctors/{id}/available-dates/?start=YYYY-MM-DD&days=31` | public. Calendar helper: `[{date, available, free_slots}]` (max 62 days) |

## Schedules (doctor only, own rows)

| Method | Path | Body |
|---|---|---|
| GET | `/schedules/` | |
| POST | `/schedules/` | `weekday (0=Mon…6=Sun), start_time, end_time, slot_duration (min), break_start?, break_end?, max_appointments?, is_active?` |
| PATCH / DELETE | `/schedules/{id}/` | Overlapping intervals, invalid breaks and too-long durations are rejected |
| GET | `/schedules/blocked-dates/` | upcoming (`?include_past=true` for all) |
| POST | `/schedules/blocked-dates/` | `date, reason?`. Rejected for past dates, duplicates, or days with active appointments |
| DELETE | `/schedules/blocked-dates/{id}/` | |

## Appointments

| Method | Path | Access / notes |
|---|---|---|
| POST | `/appointments/` | Patient: `doctor, date, start_time, reason`. Returns 201 with the detail, 400 if invalid, 409 if the slot was taken |
| GET | `/appointments/` | Scoped by role. Filters: `status=PENDING,CONFIRMED`, `scope=upcoming|past|today`, `date, date_from, date_to, doctor, patient, specialization`, `search` |
| GET | `/appointments/{id}/` | Includes `events` (history), `payment`, `actions` (what the caller may do) |
| PATCH | `/appointments/{id}/` | `reason` (patient), or `status` (`CONFIRMED` / `COMPLETED` / `CANCELLED` + `cancellation_reason`) through the same rules as the actions below |
| POST | `/appointments/{id}/cancel/` | Patient (within window), doctor, admin. `reason` required |
| POST | `/appointments/{id}/reschedule/` | Patient (within window), admin. `date, start_time`. Status returns to PENDING |
| POST | `/appointments/{id}/confirm/` | Doctor (own) or admin |
| POST | `/appointments/{id}/complete/` | Doctor (own), on or after the appointment date |

## Medical records and prescriptions (doctor and patient only)

| Method | Path | Access / notes |
|---|---|---|
| GET | `/medical-records/` | Doctor: records for own appointments (`?appointment__patient=ID`). Patient: own **released** records |
| POST | `/medical-records/` | Doctor: `appointment, diagnosis, symptoms?, notes?, follow_up_instructions?, follow_up_date?, is_released?`. Appointment must be confirmed or completed; one record per appointment |
| GET / PATCH | `/medical-records/{id}/` | Doctor can edit; setting `is_released=true` shares it (cannot be withdrawn) |
| GET | `/prescriptions/` | Same scoping as records |
| POST | `/prescriptions/` | Doctor: `medical_record, notes?, items:[{medicine_name, dosage, frequency, duration, instructions?}]` (1–30 items) |

## Payments (mock provider)

| Method | Path | Access |
|---|---|---|
| GET | `/payments/` | Patient: own. Doctor: own appointments. Admin: all. Filter `status` |
| GET | `/payments/{id}/` | same scoping |
| POST | `/payments/{id}/pay/` | Patient: `method` = `UPI` / `CARD` / `NETBANKING`. Mock settlement; no card data is accepted |

## Inventory (admin)

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/inventory/supplies/` | `name, sku, category, quantity, unit, minimum_stock_level, supplier, notes`. Filters `low_stock=true`, `category`, `search` |
| GET/PATCH/DELETE | `/inventory/supplies/{id}/` | |
| GET | `/inventory/supplies/stats/` | totals, low-stock and out-of-stock counts |

## Admin: `/api/admin/` (admin role only)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/dashboard/` | Patient, doctor and appointment counts, last-14-day series, counts by specialization, inventory alerts, recent bookings |
| GET/POST | `/admin/patients/` | Search and paginate; POST uses the registration fields |
| GET/PATCH | `/admin/patients/{id}/` | |
| POST | `/admin/patients/{id}/disable/` · `/enable/` | Soft disable |
| GET | `/admin/doctors/` | All statuses. Filters `approval_status, specialization, search` |
| GET/PATCH | `/admin/doctors/{id}/` | |
| POST | `/admin/doctors/{id}/approve/` | |
| POST | `/admin/doctors/{id}/reject/` | `reason`. Refused if the doctor has upcoming appointments |
| POST | `/admin/doctors/{id}/disable/` · `/enable/` | |
| GET | `/admin/appointments/` · `/admin/appointments/{id}/` | Read-only; cancel via `/appointments/{id}/cancel/` |

## Misc

| GET | `/health/` | public liveness check |
|---|---|---|
