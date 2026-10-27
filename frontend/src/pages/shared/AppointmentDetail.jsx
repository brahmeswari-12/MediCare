import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Building2, CalendarClock, CalendarDays, ChevronLeft, CircleCheckBig, ClipboardList, Clock, CreditCard, FileText,
  MapPin, Phone, UserRound, X,
} from "lucide-react";
import { appointmentApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { ConfirmDialog, Modal } from "../../components/Modal";
import SlotPicker from "../../components/SlotPicker";
import { Alert, Avatar, ErrorState, PageLoader, Spinner, StatusBadge } from "../../components/ui";
import { formatDateTime, formatLongDate, formatMoney, formatTimeRange, genderLabel, titleCase } from "../../utils/format";
import { getErrorMessage } from "../../utils/errors";

const BASE = { PATIENT: "/patient", DOCTOR: "/doctor", ADMIN: "/admin" };

function RescheduleDialog({ appointment, open, onClose, onDone }) {
  const [date, setDate] = useState(null);
  const [slot, setSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const updated = await appointmentApi.reschedule(appointment.id, { date, start_time: slot.start_time });
      onDone(updated);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      if (err.response?.status === 409) { setSlot(null); setRefreshKey((k) => k + 1); }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="modal-lg" title="Reschedule appointment"
           description={`Currently ${formatLongDate(appointment.date)}, ${formatTimeRange(appointment.start_time, appointment.end_time)}. The doctor will need to confirm the new time.`}
           footer={
             <>
               <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
               <button className="btn btn-primary" onClick={submit} disabled={!slot || busy}>
                 {busy && <Spinner size={16} />} Move appointment
               </button>
             </>
           }>
      <div className="stack">
        {error && <Alert type="danger">{error}</Alert>}
        <SlotPicker doctorId={appointment.doctor.id} date={date} startTime={slot?.start_time}
                    onDateChange={setDate} onSlotChange={setSlot} refreshKey={refreshKey} />
      </div>
    </Modal>
  );
}

export default function AppointmentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data: appt, setData, loading, error, reload } = useApi(() => appointmentApi.get(id), [id]);
  const [dialog, setDialog] = useState(null); // "cancel" | "confirm" | "complete" | "reschedule"
  const close = useCallback(() => setDialog(null), []);

  if (loading) return <PageLoader />;
  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;

  const base = BASE[user.role];
  const a = appt.actions;
  const isDoctor = user.role === "DOCTOR";
  const run = (fn, message) => async (reason) => {
    const updated = await fn(reason);
    setData(updated);
    toast.success(message);
  };

  return (
    <div className="stack-lg">
      <div>
        <Link to={`${base}/appointments`} className="btn btn-ghost btn-sm" style={{ marginLeft: -12 }}>
          <ChevronLeft size={16} /> Appointments
        </Link>
      </div>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <div className="row-wrap">
            <h1>Appointment {appt.reference}</h1>
            <StatusBadge status={appt.status} />
          </div>
          <p>Booked {formatDateTime(appt.created_at)}</p>
        </div>
        <div className="row-wrap">
          {a.can_confirm && (
            <button className="btn btn-primary" onClick={() => setDialog("confirm")}>
              <CircleCheckBig size={16} /> Confirm
            </button>
          )}
          {a.can_complete && (
            <button className="btn btn-teal" onClick={() => setDialog("complete")}>
              <CircleCheckBig size={16} /> Mark completed
            </button>
          )}
          {a.can_write_record && (
            <button className="btn btn-secondary" onClick={() => navigate(`/doctor/records/new?appointment=${appt.id}`)}>
              <ClipboardList size={16} /> Write consultation record
            </button>
          )}
          {a.can_reschedule && (
            <button className="btn btn-secondary" onClick={() => setDialog("reschedule")}>
              <CalendarClock size={16} /> Reschedule
            </button>
          )}
          {a.can_cancel && (
            <button className="btn btn-danger-outline" onClick={() => setDialog("cancel")}>
              <X size={16} /> Cancel
            </button>
          )}
        </div>
      </div>

      {appt.status === "CANCELLED" && (
        <Alert type="danger" title={`Cancelled${appt.cancelled_by_role ? ` by ${titleCase(appt.cancelled_by_role)}` : ""}`}>
          {appt.cancellation_reason}
        </Alert>
      )}
      {user.role === "PATIENT" && appt.status === "PENDING" && (
        <Alert type="info">Waiting for the doctor to confirm this appointment.</Alert>
      )}
      {user.role === "PATIENT" && ["PENDING", "CONFIRMED"].includes(appt.status) && !a.can_cancel && (
        <Alert type="warning">This appointment is too close to its start time to change online. Please contact the clinic.</Alert>
      )}

      <div className="grid layout-aside">
        <div className="stack-lg">
          <section className="card">
            <div className="card-header"><h2>Appointment</h2></div>
            <div className="card-body">
              <dl className="kv">
                <dt><CalendarDays size={14} style={{ verticalAlign: -2 }} /> Date</dt><dd>{formatLongDate(appt.date)}</dd>
                <dt><Clock size={14} style={{ verticalAlign: -2 }} /> Time</dt><dd>{formatTimeRange(appt.start_time, appt.end_time)}</dd>
                <dt>Reason for visit</dt><dd style={{ whiteSpace: "pre-line" }}>{appt.reason}</dd>
                <dt>Appointment ID</dt><dd><span className="reference">{appt.reference}</span></dd>
              </dl>
            </div>
          </section>

          {(isDoctor || user.role === "ADMIN") && (
            <section className="card">
              <div className="card-header"><h2>Patient</h2></div>
              <div className="card-body row" style={{ alignItems: "flex-start" }}>
                <Avatar name={appt.patient.full_name} size={48} />
                <dl className="kv" style={{ flex: 1 }}>
                  <dt>Name</dt><dd>{appt.patient.full_name}</dd>
                  <dt>Age / gender</dt><dd>{appt.patient.age} years · {genderLabel(appt.patient.gender)}</dd>
                  {appt.patient.blood_group && (<><dt>Blood group</dt><dd>{appt.patient.blood_group}</dd></>)}
                  <dt><Phone size={14} style={{ verticalAlign: -2 }} /> Phone</dt><dd>{appt.patient.phone || "—"}</dd>
                  <dt>Email</dt><dd>{appt.patient.email}</dd>
                </dl>
              </div>
            </section>
          )}

          {appt.has_medical_record && user.role !== "ADMIN" && (
            <section className="card card-body row between">
              <div className="row">
                <span className="feature-icon"><FileText size={18} /></span>
                <div>
                  <strong className="strong">Consultation record available</strong>
                  <p className="small muted">Diagnosis, notes and prescriptions for this visit.</p>
                </div>
              </div>
              <Link to={`${base}/records/${appt.medical_record_id}`} className="btn btn-secondary btn-sm">Open record</Link>
            </section>
          )}

          <section className="card">
            <div className="card-header"><h2>History</h2></div>
            <div className="card-body">
              <ol className="timeline">
                {appt.events.map((e) => (
                  <li key={e.id}>
                    <strong className="strong">{titleCase(e.action)}</strong>
                    <span className="muted"> · {e.actor_name}{e.actor_role ? ` (${titleCase(e.actor_role)})` : ""}</span>
                    <div className="xs muted">{formatDateTime(e.created_at)}</div>
                    {e.note && <div className="small mt-2">{e.note}</div>}
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>

        <aside className="stack-lg">
          <section className="card">
            <div className="card-header"><h2>Doctor</h2></div>
            <div className="card-body stack">
              <div className="row">
                <Avatar name={appt.doctor.full_name} src={appt.doctor.photo} size={48} />
                <div>
                  <strong className="strong">Dr. {appt.doctor.full_name}</strong>
                  <div className="small muted">{appt.doctor.specialization.name}</div>
                </div>
              </div>
              <div className="doctor-meta" style={{ marginTop: 0 }}>
                <span><Building2 size={15} /> {appt.doctor.hospital}</span>
                <span><MapPin size={15} /> {appt.doctor.address || appt.doctor.location}</span>
                {user.role !== "PATIENT" && <span><UserRound size={15} /> {appt.doctor.qualifications}</span>}
              </div>
            </div>
          </section>
          {appt.payment && (
            <section className="card">
              <div className="card-header"><h2><CreditCard size={16} style={{ verticalAlign: -2, marginRight: 6 }} />Payment</h2></div>
              <div className="card-body">
                <dl>
                  <div className="summary-row"><dt>Consultation fee</dt><dd>{formatMoney(appt.payment.amount, appt.payment.currency)}</dd></div>
                  <div className="summary-row"><dt>Status</dt><dd><StatusBadge status={appt.payment.status} /></dd></div>
                </dl>
                {user.role === "PATIENT" && appt.payment.status === "PENDING" && appt.status !== "CANCELLED" && (
                  <Link to="/patient/payments" className="btn btn-secondary btn-sm btn-block mt-4">Go to payments</Link>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={dialog === "cancel"} onClose={close} tone="danger" confirmLabel="Cancel appointment"
        title="Cancel this appointment?"
        description="The time slot will be released. This cannot be undone."
        reasonLabel="Reason for cancellation" reasonPlaceholder="Let the other party know why"
        onConfirm={run((reason) => appointmentApi.cancel(appt.id, reason), "Appointment cancelled.")}
      />
      <ConfirmDialog
        open={dialog === "confirm"} onClose={close} confirmLabel="Confirm appointment"
        title="Confirm this appointment?"
        description={`${appt.patient.full_name} will see the appointment as confirmed.`}
        onConfirm={run(() => appointmentApi.confirm(appt.id), "Appointment confirmed.")}
      />
      <ConfirmDialog
        open={dialog === "complete"} onClose={close} confirmLabel="Mark completed"
        title="Mark as completed?"
        description="Use this after the consultation has taken place. You can still add a consultation record."
        onConfirm={run(() => appointmentApi.complete(appt.id), "Appointment marked as completed.")}
      />
      {dialog === "reschedule" && (
        <RescheduleDialog appointment={appt} open onClose={close}
                          onDone={(updated) => { setData(updated); toast.success("Appointment rescheduled."); }} />
      )}
    </div>
  );
}
