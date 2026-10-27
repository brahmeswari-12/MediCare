import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Building2, ChevronLeft, MapPin } from "lucide-react";
import { appointmentApi, doctorApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import SlotPicker from "../../components/SlotPicker";
import { Alert, Avatar, ErrorState, PageLoader, Spinner, TextAreaField } from "../../components/ui";
import { formatLongDate, formatMoney, formatTimeRange } from "../../utils/format";
import { getErrorMessage } from "../../utils/errors";

const STEPS = ["Date & time", "Reason", "Review"];

function Steps({ current }) {
  return (
    <ol className="steps" aria-label="Booking progress">
      {STEPS.map((label, i) => (
        <li key={label} className={i < current ? "done" : i === current ? "current" : ""}
            aria-current={i === current ? "step" : undefined}>
          <span className="dot">{i + 1}</span> {label}
          {i < STEPS.length - 1 && <span className="sep" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

export default function BookAppointment() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const doctor = useApi(() => doctorApi.get(doctorId), [doctorId]);
  const [step, setStep] = useState(0);
  const [date, setDate] = useState(null);
  const [slot, setSlot] = useState(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const onDateChange = useCallback((d) => setDate(d), []);

  if (doctor.loading) return <PageLoader />;
  if (doctor.error) return <div className="card"><ErrorState message={doctor.error} onRetry={doctor.reload} /></div>;
  const d = doctor.data;

  function next() {
    setError("");
    if (step === 1) {
      if (reason.trim().length < 5) {
        setReasonError("Please describe the reason for your visit (at least 5 characters).");
        return;
      }
      setReasonError("");
    }
    setStep(step + 1);
  }

  async function confirm() {
    setSubmitting(true);
    setError("");
    try {
      const appt = await appointmentApi.create({
        doctor: d.id, date, start_time: slot.start_time, reason: reason.trim(),
      });
      navigate(`/patient/appointments/${appt.id}/confirmation`, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      // The slot was taken (or became invalid) since it was shown: pick again.
      if (err.response?.status === 409 || err.response?.data?.start_time || err.response?.data?.date) {
        setSlot(null);
        setStep(0);
        setRefreshKey((k) => k + 1);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="stack-lg">
      <div>
        <Link to={`/doctors/${d.id}`} className="btn btn-ghost btn-sm" style={{ marginLeft: -12 }}>
          <ChevronLeft size={16} /> Doctor profile
        </Link>
      </div>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1>Book an appointment</h1>
          <p>Choose a time that suits you. The doctor will confirm your booking.</p>
        </div>
      </div>

      <div className="grid layout-aside">
        <section className="card">
          <div className="card-body">
            <Steps current={step} />
            {error && <div style={{ marginBottom: 16 }}><Alert type="danger">{error}</Alert></div>}

            {step === 0 && (
              <SlotPicker doctorId={d.id} date={date} startTime={slot?.start_time} refreshKey={refreshKey}
                          onDateChange={onDateChange} onSlotChange={setSlot} />
            )}

            {step === 1 && (
              <TextAreaField label="Reason for consultation" required rows={5} maxLength={1000} value={reason}
                             error={reasonError} onChange={(e) => setReason(e.target.value)}
                             placeholder="Describe your symptoms or the purpose of the visit"
                             hint="Shared only with your doctor." />
            )}

            {step === 2 && (
              <div className="stack">
                <h3>Review your booking</h3>
                <dl>
                  <div className="summary-row"><dt>Doctor</dt><dd>Dr. {d.full_name}</dd></div>
                  <div className="summary-row"><dt>Specialization</dt><dd>{d.specialization.name}</dd></div>
                  <div className="summary-row"><dt>Date</dt><dd>{formatLongDate(date)}</dd></div>
                  <div className="summary-row"><dt>Time</dt><dd>{formatTimeRange(slot.start_time, slot.end_time)}</dd></div>
                  <div className="summary-row"><dt>Location</dt><dd>{d.hospital}, {d.location}</dd></div>
                  <div className="summary-row"><dt>Reason</dt><dd style={{ fontWeight: 500, maxWidth: 360 }}>{reason}</dd></div>
                  <div className="summary-row"><dt>Consultation fee</dt><dd>{formatMoney(d.consultation_fee)}</dd></div>
                </dl>
                <Alert type="info">
                  The slot is checked again when you confirm. Your appointment starts as pending until the doctor confirms it.
                </Alert>
              </div>
            )}

            <div className="form-actions mt-6">
              {step > 0 && (
                <button className="btn btn-secondary" onClick={() => setStep(step - 1)} disabled={submitting}>Back</button>
              )}
              {step < 2 ? (
                <button className="btn btn-primary" onClick={next} disabled={step === 0 && !slot}>Continue</button>
              ) : (
                <button className="btn btn-primary" onClick={confirm} disabled={submitting}>
                  {submitting && <Spinner size={16} />} Confirm booking
                </button>
              )}
            </div>
          </div>
        </section>

        <aside className="card">
          <div className="card-body stack">
            <div className="row">
              <Avatar name={d.full_name} src={d.photo} size={56} />
              <div>
                <strong className="strong">Dr. {d.full_name}</strong>
                <div className="small muted">{d.specialization.name}</div>
              </div>
            </div>
            <div className="doctor-meta" style={{ marginTop: 0 }}>
              <span><Building2 size={15} /> {d.hospital}</span>
              <span><MapPin size={15} /> {d.location}</span>
            </div>
            <hr className="divider" />
            <dl>
              <div className="summary-row"><dt>Date</dt><dd>{date ? formatLongDate(date) : "—"}</dd></div>
              <div className="summary-row"><dt>Time</dt><dd>{slot ? formatTimeRange(slot.start_time, slot.end_time) : "—"}</dd></div>
              <div className="summary-row"><dt>Fee</dt><dd>{formatMoney(d.consultation_fee)}</dd></div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
