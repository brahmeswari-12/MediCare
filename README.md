# MediCare: Doctor Appointment Booking System

A full-stack healthcare management system for booking doctor appointments. It has three roles:

| Role | What they can do |
|------|------------------|
| **Patient** | Register, search doctors, book/reschedule/cancel appointments, view released medical records, prescriptions and payments |
| **Doctor** | Apply to join (admin approval required), manage profile, weekly schedule (multiple intervals per day, breaks, caps), blocked dates, confirm/cancel/complete appointments, write consultation records and prescriptions |
| **Admin** | Dashboard statistics, approve/reject doctors, manage doctors, patients, specializations, appointments and hospital supplies |

**Stack:** React 19 + Vite, React Router, Axios, Context API, Lucide icons · Django 5.2, Django REST Framework, Simple JWT, django-filter · MySQL 8.

---

## 1. Project structure

```
Doctor Appointment Booking/
├── README.md
├── docs/
│   ├── API.md                     # Endpoint reference
│   └── postman_collection.json    # Importable Postman collection
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── scripts/create_mysql_db.sql
│   ├── config/          # settings, root URLs, pagination, error handler, test helpers
│   ├── accounts/        # custom User (email login, roles), JWT auth, permissions
│   ├── patients/        # Patient profile
│   ├── doctors/         # Specialization, Doctor, DoctorSchedule, DoctorBlockedDate, availability engine
│   ├── appointments/    # Appointment + AppointmentEvent, booking/transition services
│   ├── medical_records/ # MedicalRecord, Prescription, PrescriptionItem
│   ├── payments/        # Payment + mock payment adapter
│   ├── inventory/       # HospitalSupply
│   └── admin_panel/     # admin APIs, dashboard statistics, seed_demo command
└── frontend/
    ├── package.json
    ├── .env.example
    └── src/
        ├── components/  # design-system components, SlotPicker, AppointmentTable, Modal…
        ├── context/     # AuthContext, ToastContext
        ├── hooks/       # useApi, useForm
        ├── layouts/     # PublicLayout, DashboardLayout (role-aware sidebar)
        ├── pages/       # public/, patient/, doctor/, admin/, shared/
        ├── routes/      # ProtectedRoute (role-aware)
        ├── services/    # axios client with token refresh + API modules
        └── utils/       # formatting and error helpers
```

---

## 2. Prerequisites

- Python 3.11+ (`python --version`)
- Node.js 18+ and npm (`node --version`)
- MySQL Server 8.0 running locally

All commands below are for **Windows PowerShell** unless noted. Use two terminals: one for the backend, one for the frontend.

---

## 3. Backend setup (terminal 1, inside `backend/`)

```powershell
cd backend

# 1. Create a virtual environment
python -m venv venv

# 2. Activate it (PowerShell)
.\venv\Scripts\Activate.ps1
#    Command Prompt instead:  venv\Scripts\activate.bat
#    If PowerShell blocks the script, run once:
#    Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables
copy .env.example .env
#    Edit .env: set DJANGO_SECRET_KEY, DB_USER and DB_PASSWORD.
#    Generate a secret key with:
#    python -c "import secrets; print(secrets.token_urlsafe(50))"
```

### 3.1 Create the MySQL database

Open `backend/scripts/create_mysql_db.sql`, replace both `CHANGE_ME` values with the `DB_PASSWORD` from your `.env`, then run it as the MySQL root user:

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p -e "source scripts/create_mysql_db.sql"
```

This creates `healthcare_db` (utf8mb4), the user `healthcare_user`, and permission on `test_healthcare_db` so the test runner can create its own database. If you prefer to use an existing MySQL user, set it in `.env` and just run `CREATE DATABASE healthcare_db CHARACTER SET utf8mb4;`.

### 3.2 Migrate, create the first admin, run

```powershell
# 5. Apply migrations
python manage.py migrate

# 6. Create the first administrator (superusers get the ADMIN role)
python manage.py createsuperuser

# 7. (Optional, development only) load demo data
python manage.py seed_demo

# 8. Start the API on http://127.0.0.1:8000
python manage.py runserver
```

Health check: <http://127.0.0.1:8000/api/health/>. The Django admin site is at `/django-admin/`.

---

## 4. Frontend setup (terminal 2, inside `frontend/`)

```powershell
cd frontend
copy .env.example .env      # VITE_API_BASE_URL=http://127.0.0.1:8000/api
npm install
npm run dev                 # http://localhost:5173
```

Production build: `npm run build` (output in `frontend/dist/`). Lint: `npm run lint`.

---

## 5. Accounts

### First admin
Create it with `python manage.py createsuperuser` (section 3.2). There is **no public endpoint that creates admins**: public registration only creates patients, and the doctor application only creates *pending* doctors.

### Doctors
- **Self-service:** a doctor applies at `/register/doctor`. The account can sign in and set up its profile and schedule, but it is hidden from patients until an admin approves it under **Admin → Doctor approvals**.
- **Created by an admin:** **Admin → Doctors → Add doctor** creates an approved account with a temporary password.

### Patients
Patients register at `/register`, or an admin adds them under **Admin → Patients**.

### Development demo accounts (only after `python manage.py seed_demo`)
`seed_demo` refuses to run when `DJANGO_DEBUG=False`. It creates fictional data with `.test` email addresses. All demo accounts share the password defined as `DEMO_PASSWORD` in `backend/admin_panel/management/commands/seed_demo.py`.

| Role | Email |
|------|-------|
| Admin | `admin@medicare.test` |
| Doctor (approved) | `ananya.sharma@medicare.test`, `rohan.mehta@medicare.test`, … (12 doctors, `firstname.lastname@medicare.test`) |
| Doctor (pending approval) | `nikhil.bose@medicare.test`, `ritu.agarwal@medicare.test` |
| Patient | `patient@medicare.test` (Rahul Verma), `aisha.khan@medicare.test`, `sanjay.gupta@medicare.test` |

It also creates 11 specializations, weekly schedules, sample past and upcoming appointments, one released medical record with a prescription, and hospital supply items (some low on stock). **Never run it against a production database.**

---

## 6. Running tests

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python manage.py test
```

The suite (75 tests) covers registration and login validation, JWT refresh, rotation and logout blacklisting, password change, role permissions, object-level access, schedule overlap and break validation, slot generation, double booking (application check **and** the database unique constraint), concurrent booking, rescheduling, cancellation windows, status transitions, medical-record privacy, admin statistics, mock payments and inventory.

`ConcurrentBookingTests` fires five simultaneous booking requests at one slot and expects exactly one success. It needs MySQL (row locks) and is skipped automatically on SQLite.

---

## 7. Key design decisions

### Booking integrity and concurrency
`appointments/services.py` books inside a database transaction:

1. `SELECT … FOR UPDATE` on the doctor row, so bookings for one doctor are serialized.
2. Availability is **recomputed on the server** from schedules, breaks, blocked dates, caps and existing appointments. The slot sent by the browser is never trusted.
3. The patient row is locked and overlapping appointments for the same patient are rejected.
4. The row is saved with a unique `slot_key` (`doctor:date:start`) that is set while the appointment occupies its slot and cleared (NULL) on cancellation. This is a database-level last line of defence; a collision returns **409 Conflict** and the UI asks the patient to pick another slot.

**Overlap policy:** appointments occupy the half-open interval `[start, end)`, so back-to-back slots are allowed. Slots step by the interval's duration from its start time; a slot that would overlap a break is skipped and generation resumes at the break end.

### Status transitions (enforced on the server)
`PENDING → CONFIRMED | CANCELLED`, `CONFIRMED → COMPLETED | CANCELLED`; `COMPLETED` and `CANCELLED` are final. Rescheduling moves a pending/confirmed appointment atomically and returns it to `PENDING` for re-confirmation. Every change is logged in `AppointmentEvent` (shown as the History timeline).

| Action | Patient | Doctor | Admin |
|--------|---------|--------|-------|
| Book | ✔ | | |
| Cancel (reason required) | ✔ until `CANCELLATION_MIN_HOURS` before start | ✔ | ✔ |
| Reschedule | ✔ same window | | ✔ |
| Confirm | | ✔ (own, before start) | ✔ |
| Complete | | ✔ (own, on/after the day) | |

### Security
- Passwords are hashed by Django (PBKDF2). Login is by email; errors are generic.
- JWT access tokens last 15 minutes and are held in memory. Refresh tokens last 7 days, rotate on use, are blacklisted on logout, and all of a user's refresh tokens are revoked on password change. The frontend refreshes transparently and redirects to sign-in when the session expires.
- Every endpoint checks the role on the server (`accounts/permissions.py`). Querysets are scoped per user, so another user's appointment or record returns **404** (no ID probing).
- Medical records are visible only to the treating doctor and, once released, to the patient. Admins cannot read clinical notes, and records are not registered in the Django admin.
- Unhandled errors are logged server-side and return a generic 500 message. CORS only allows `FRONTEND_URL`. Login and registration are rate-limited.
- Accounts are disabled (`is_active = False`), never deleted, so appointment history is preserved.

### Payments
Payments use a **mock adapter** (`payments/services.py`). No money moves and no card data is collected or stored; mock transaction references start with `MOCK-` and the UI labels them as demo payments. A fee record is created with each booking, voided when an unpaid appointment is cancelled, and marked refunded when a paid one is cancelled.

---

## 8. Production notes

- Set `DJANGO_DEBUG=False`, a strong `DJANGO_SECRET_KEY`, and real `DJANGO_ALLOWED_HOSTS`, `FRONTEND_URL` and `CORS_ALLOWED_ORIGINS`.
- Serve Django with a WSGI server (e.g. gunicorn or waitress) behind HTTPS, run `python manage.py collectstatic`, and serve `media/` (doctor photos) from your web server or object storage.
- Build the frontend with `npm run build` and serve `dist/` with SPA fallback to `index.html`.
- Replace the mock payment adapter before accepting real payments.

---

## 9. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "Cannot reach the server" on every page | The API isn't running. Start it with `python manage.py runserver` and check <http://127.0.0.1:8000/api/health/>. If the API log shows the requests returning 200, the browser blocked them (CORS): open the site on `localhost` or `127.0.0.1`. With `DJANGO_DEBUG=True`, any local port works (Vite moves to 5174, 5175… when 5173 is busy). In production, list the site's origin in `CORS_ALLOWED_ORIGINS`. |
| `mysql -p` never accepts the password in an editor's built-in terminal | Some embedded terminals can't pass hidden password prompts to `mysql.exe`. Run the command from a normal PowerShell or Command Prompt window, or use the "MySQL 8.0 Command Line Client" from the Start menu and run `source <path>/backend/scripts/create_mysql_db.sql`. |
| `OperationalError (1045) Access denied` from Django | `DB_USER` / `DB_PASSWORD` in `backend/.env` don't match a MySQL user, or the setup script hasn't been run. |
| Two dev servers running | Close extra `npm run dev` terminals; only one frontend server is needed. |

---

## 10. API

See [docs/API.md](docs/API.md) for every endpoint, or import [docs/postman_collection.json](docs/postman_collection.json) into Postman (set the `baseUrl`, `email` and `password` variables, then run **Auth → Login**).

---

*This application supports appointment booking and record keeping. It does not provide medical advice or diagnosis.*
