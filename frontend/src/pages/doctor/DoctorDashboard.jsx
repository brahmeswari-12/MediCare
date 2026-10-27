import { Link } from "react-router-dom";
import { Ban, CalendarClock, CalendarDays, CircleCheckBig, CircleX, Hourglass } from "lucide-react";
import { appointmentApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { AppointmentMiniList } from "../../components/AppointmentTable";
import { EmptyState, ErrorState, SkeletonRows, StatCard } from "../../components/ui";
import { formatLongDate, todayISO } from "../../utils/format";

function Panel({ title, link, state, empty }) {
  return (
    <section className="card">
      <div className="card-header">
        <h2>{title}</h2>
        {link && <Link to={link} className="small">View all</Link>}
      </div>
      {state.error ? <ErrorState message={state.error} onRetry={state.reload} />
        : state.loading ? <SkeletonRows rows={3} />
        : state.data.results.length === 0 ? <EmptyState title={empty} />
        : <AppointmentMiniList items={state.data.results} basePath="/doctor/appointments" showPatient />}
    </section>
  );
}

export default function DoctorDashboard() {
  const { user } = useAuth();
  const today = useApi(() => appointmentApi.list({ scope: "today", page_size: 20 }), []);
  const upcoming = useApi(() => appointmentApi.list({ scope: "upcoming", date_from: todayISO(), page_size: 6 }), []);
  const pending = useApi(() => appointmentApi.list({ status: "PENDING", ordering: "date", page_size: 6 }), []);
  const completed = useApi(() => appointmentApi.list({ status: "COMPLETED", page_size: 1 }), []);
  const cancelled = useApi(() => appointmentApi.list({ status: "CANCELLED", page_size: 1 }), []);

  const todayActive = today.data?.results.filter((a) => a.status !== "CANCELLED") || [];

  return (
    <div className="stack-lg">
      <div className="welcome">
        <div>
          <h1>Good day, Dr. {user.full_name.split(" ").slice(-1)[0]}</h1>
          <p>{formatLongDate(todayISO())} · {today.data ? `${todayActive.length} appointment${todayActive.length === 1 ? "" : "s"} today` : "Loading your day…"}</p>
        </div>
        <div className="row-wrap">
          <Link to="/doctor/schedule" className="btn btn-secondary"><CalendarClock size={16} /> Schedule</Link>
          <Link to="/doctor/blocked-dates" className="btn btn-secondary"><Ban size={16} /> Block a date</Link>
        </div>
      </div>

      <div className="grid grid-4">
        <StatCard icon={CalendarDays} label="Today" value={today.data ? todayActive.length : undefined} />
        <StatCard icon={Hourglass} label="Pending confirmation" value={pending.data?.count} tone="warning" />
        <StatCard icon={CircleCheckBig} label="Completed" value={completed.data?.count} tone="success" />
        <StatCard icon={CircleX} label="Cancelled" value={cancelled.data?.count} tone="danger" />
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Panel title="Today's appointments" link="/doctor/appointments" state={today} empty="No appointments today" />
        <Panel title="Awaiting your confirmation" link="/doctor/appointments" state={pending} empty="Nothing waiting for confirmation" />
      </div>
      <Panel title="Upcoming appointments" link="/doctor/appointments" state={upcoming} empty="No upcoming appointments" />
    </div>
  );
}
