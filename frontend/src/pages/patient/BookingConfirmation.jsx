import { Link, useParams } from "react-router-dom";
import { CircleCheckBig } from "lucide-react";
import { appointmentApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import { ErrorState, PageLoader, StatusBadge } from "../../components/ui";
import { formatLongDate, formatMoney, formatTimeRange } from "../../utils/format";

export default function BookingConfirmation() {
  const { id } = useParams();
  const { data: a, loading, error, reload } = useApi(() => appointmentApi.get(id), [id]);
  if (loading) return <PageLoader />;
  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;

  return (
    <div className="card" style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="card-body stack-lg" style={{ textAlign: "center" }}>
        <div className="success-mark"><CircleCheckBig size={32} aria-hidden="true" /></div>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)" }}>Appointment requested</h1>
          <p className="muted mt-2">
            Your booking with Dr. {a.doctor.full_name} has been received and is awaiting the doctor's confirmation.
          </p>
        </div>
        <div>
          <div className="small muted">Appointment ID</div>
          <div className="reference mt-2" style={{ fontSize: "var(--text-lg)" }}>{a.reference}</div>
        </div>
        <dl style={{ textAlign: "left" }}>
          <div className="summary-row"><dt>Doctor</dt><dd>Dr. {a.doctor.full_name} · {a.doctor.specialization.name}</dd></div>
          <div className="summary-row"><dt>Date</dt><dd>{formatLongDate(a.date)}</dd></div>
          <div className="summary-row"><dt>Time</dt><dd>{formatTimeRange(a.start_time, a.end_time)}</dd></div>
          <div className="summary-row"><dt>Location</dt><dd>{a.doctor.hospital}, {a.doctor.location}</dd></div>
          <div className="summary-row"><dt>Status</dt><dd><StatusBadge status={a.status} /></dd></div>
          {a.payment && <div className="summary-row"><dt>Fee</dt><dd>{formatMoney(a.payment.amount, a.payment.currency)} · {a.payment.status.toLowerCase()}</dd></div>}
        </dl>
        <div className="row-wrap" style={{ justifyContent: "center" }}>
          <Link to={`/patient/appointments/${a.id}`} className="btn btn-primary">View appointment</Link>
          <Link to="/patient/appointments" className="btn btn-secondary">All appointments</Link>
        </div>
      </div>
    </div>
  );
}
