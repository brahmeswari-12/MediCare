import { Link } from "react-router-dom";
import {
  CalendarCheck, CalendarDays, CircleCheckBig, CircleX, Hourglass, Package, Stethoscope, UserCheck, Users,
} from "lucide-react";
import { adminApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import { AppointmentMiniList } from "../../components/AppointmentTable";
import { Alert, EmptyState, ErrorState, PageHeader, PageLoader, StatCard } from "../../components/ui";
import { formatDate } from "../../utils/format";

const STATUS_COLORS = {
  pending: "#f79009",
  confirmed: "#2563eb",
  completed: "#0d9488",
  cancelled: "#d92d20",
};

function DailyChart({ days }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <figure style={{ margin: 0 }}>
      <div className="chart-bars" role="img"
           aria-label={`Appointments per day for the last 14 days: ${days.map((d) => `${formatDate(d.date, { day: "numeric", month: "short" })} ${d.count}`).join(", ")}`}>
        {days.map((d) => (
          <div key={d.date} className="chart-bar" title={`${formatDate(d.date)}: ${d.count}`}>
            <span className="xs strong">{d.count || ""}</span>
            <div className="bar" style={{ height: `${(d.count / max) * 100}%` }} />
            <span className="lbl">{new Date(`${d.date}T00:00:00`).getDate()}</span>
          </div>
        ))}
      </div>
      <figcaption className="xs muted mt-2">Appointments by visit date, last 14 days</figcaption>
    </figure>
  );
}

function StatusBreakdown({ appointments }) {
  const total = Math.max(1, appointments.pending + appointments.confirmed + appointments.completed + appointments.cancelled);
  return (
    <div>
      <div className="status-bar" role="img" aria-label="Appointment status distribution">
        {Object.entries(STATUS_COLORS).map(([key, color]) => (
          <div key={key} style={{ width: `${(appointments[key] / total) * 100}%`, background: color }} />
        ))}
      </div>
      <div className="legend">
        {Object.entries(STATUS_COLORS).map(([key, color]) => (
          <span key={key}><i style={{ background: color }} /> {key[0].toUpperCase() + key.slice(1)} · {appointments[key]}</span>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data, loading, error, reload } = useApi(() => adminApi.dashboard(), []);
  if (loading) return <PageLoader />;
  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;
  const { patients, doctors, appointments } = data;
  const maxSpec = Math.max(1, ...data.appointments_by_specialization.map((s) => s.count));

  return (
    <div className="stack-lg">
      <PageHeader title="Admin dashboard" description="Live platform statistics from the database." />
      {doctors.pending > 0 && (
        <Alert type="warning" title={`${doctors.pending} doctor application${doctors.pending === 1 ? "" : "s"} awaiting review`}>
          <Link to="/admin/approvals">Review applications</Link>
        </Alert>
      )}
      <div className="grid grid-4">
        <StatCard icon={Users} label="Active patients" value={patients.active} hint={`${patients.total} registered`} />
        <StatCard icon={Stethoscope} label="Approved doctors" value={doctors.approved} tone="teal" hint={`${doctors.total} total`} />
        <StatCard icon={CalendarDays} label="Total appointments" value={appointments.total} hint={`${appointments.today} today`} />
        <StatCard icon={UserCheck} label="Pending applications" value={doctors.pending} tone="warning" />
      </div>
      <div className="grid grid-4">
        <StatCard icon={Hourglass} label="Pending" value={appointments.pending} tone="warning" />
        <StatCard icon={CalendarCheck} label="Confirmed" value={appointments.confirmed} />
        <StatCard icon={CircleCheckBig} label="Completed" value={appointments.completed} tone="success" />
        <StatCard icon={CircleX} label="Cancelled" value={appointments.cancelled} tone="danger" />
      </div>

      <div className="grid layout-aside">
        <section className="card">
          <div className="card-header"><h2>Appointment activity</h2></div>
          <div className="card-body stack-lg">
            <DailyChart days={data.appointments_last_14_days} />
            <StatusBreakdown appointments={appointments} />
          </div>
        </section>
        <section className="card">
          <div className="card-header"><h2>By specialization</h2></div>
          <div className="card-body">
            {data.appointments_by_specialization.length === 0 ? <p className="small muted">No appointments yet.</p> :
              data.appointments_by_specialization.map((s) => (
                <div key={s.name} className="hbar">
                  <span className="small" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                  <div className="track"><div className="fill" style={{ width: `${(s.count / maxSpec) * 100}%` }} /></div>
                  <span className="small strong text-right">{s.count}</span>
                </div>
              ))}
            <hr className="divider" />
            <div className="row between small">
              <span className="row"><Package size={16} /> Supplies low on stock</span>
              <Link to="/admin/supplies" className="strong">{data.inventory.low_stock} of {data.inventory.items}</Link>
            </div>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <h2>Recent bookings</h2>
          <Link to="/admin/appointments" className="small">All appointments</Link>
        </div>
        {data.recent_appointments.length === 0 ? <EmptyState title="No appointments yet" /> :
          <AppointmentMiniList items={data.recent_appointments} basePath="/admin/appointments" showPatient />}
      </section>
    </div>
  );
}
