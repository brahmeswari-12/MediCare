import { Link } from "react-router-dom";
import { ArrowRight, CalendarCheck, CalendarClock, CircleCheckBig, Hourglass, Search } from "lucide-react";
import { appointmentApi, doctorApi, patientApi, specializationApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { AppointmentMiniList } from "../../components/AppointmentTable";
import SpecialtyIcon from "../../components/SpecialtyIcon";
import { Avatar, EmptyState, ErrorState, SkeletonRows, StatCard } from "../../components/ui";
import { formatMoney, genderLabel } from "../../utils/format";

export default function PatientDashboard() {
  const { user } = useAuth();
  const profile = useApi(() => patientApi.profile(), []);
  const upcoming = useApi(() => appointmentApi.list({ scope: "upcoming", page_size: 5 }), []);
  const past = useApi(() => appointmentApi.list({ scope: "past", page_size: 5 }), []);
  const pending = useApi(() => appointmentApi.list({ status: "PENDING", page_size: 1 }), []);
  const confirmed = useApi(() => appointmentApi.list({ status: "CONFIRMED", page_size: 1 }), []);
  const completed = useApi(() => appointmentApi.list({ status: "COMPLETED", page_size: 1 }), []);
  const doctors = useApi(() => doctorApi.list({ page_size: 4, ordering: "-experience_years" }), []);
  const specialties = useApi(() => specializationApi.list(), []);

  return (
    <div className="stack-lg">
      <div className="welcome">
        <div>
          <h1>Hello, {user.full_name.split(" ")[0]}</h1>
          <p>Manage your appointments, records and prescriptions in one place.</p>
        </div>
        <Link to="/doctors" className="btn btn-secondary btn-lg"><CalendarCheck size={18} /> Book an appointment</Link>
      </div>

      <div className="grid grid-4">
        <StatCard icon={CalendarClock} label="Upcoming" value={upcoming.data?.count} />
        <StatCard icon={Hourglass} label="Pending confirmation" value={pending.data?.count} tone="warning" />
        <StatCard icon={CalendarCheck} label="Confirmed" value={confirmed.data?.count} tone="teal" />
        <StatCard icon={CircleCheckBig} label="Completed visits" value={completed.data?.count} tone="success" />
      </div>

      <div className="grid layout-aside">
        <div className="stack-lg">
          <section className="card">
            <div className="card-header">
              <h2>Upcoming appointments</h2>
              <Link to="/patient/appointments" className="small">View all</Link>
            </div>
            {upcoming.error ? <ErrorState message={upcoming.error} onRetry={upcoming.reload} />
              : upcoming.loading ? <SkeletonRows rows={3} />
              : upcoming.data.results.length === 0 ? (
                <EmptyState title="No upcoming appointments" description="When you book an appointment it will appear here."
                            action={<Link to="/doctors" className="btn btn-primary btn-sm">Find a doctor</Link>} />
              ) : <AppointmentMiniList items={upcoming.data.results} basePath="/patient/appointments" />}
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Previous appointments</h2>
              <Link to="/patient/appointments" className="small">History</Link>
            </div>
            {past.error ? <ErrorState message={past.error} onRetry={past.reload} />
              : past.loading ? <SkeletonRows rows={3} />
              : past.data.results.length === 0 ? <EmptyState title="No previous appointments" />
              : <AppointmentMiniList items={past.data.results} basePath="/patient/appointments" />}
          </section>
        </div>

        <aside className="stack-lg">
          <section className="card">
            <div className="card-header">
              <h2>My profile</h2>
              <Link to="/patient/profile" className="small">Edit</Link>
            </div>
            <div className="card-body">
              {profile.loading ? <SkeletonRows rows={2} height={20} /> : profile.error ? <p className="small muted">{profile.error}</p> : (
                <div className="stack">
                  <div className="row">
                    <Avatar name={profile.data.full_name} size={48} />
                    <div>
                      <strong className="strong">{profile.data.full_name}</strong>
                      <div className="small muted">{profile.data.email}</div>
                    </div>
                  </div>
                  <dl>
                    <div className="summary-row"><dt>Age</dt><dd>{profile.data.age} years</dd></div>
                    <div className="summary-row"><dt>Gender</dt><dd>{genderLabel(profile.data.gender)}</dd></div>
                    <div className="summary-row"><dt>Phone</dt><dd>{profile.data.phone}</dd></div>
                    {profile.data.blood_group && <div className="summary-row"><dt>Blood group</dt><dd>{profile.data.blood_group}</dd></div>}
                  </dl>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Available doctors</h2>
              <Link to="/doctors" className="small">Browse</Link>
            </div>
            {doctors.loading ? <SkeletonRows rows={3} /> : doctors.error ? <ErrorState message={doctors.error} /> : (
              <ul className="list">
                {doctors.data.results.map((d) => (
                  <li key={d.id} className="list-item">
                    <Avatar name={d.full_name} src={d.photo} size={40} />
                    <div className="grow">
                      <Link to={`/doctors/${d.id}`} className="strong" style={{ color: "var(--gray-900)" }}>Dr. {d.full_name}</Link>
                      <div className="xs muted">{d.specialization.name} · {formatMoney(d.consultation_fee)}</div>
                    </div>
                    <Link to={`/patient/book/${d.id}`} className="btn btn-secondary btn-sm" aria-label={`Book Dr. ${d.full_name}`}>Book</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <section className="card">
        <div className="card-header">
          <h2>Specialties</h2>
          <Link to="/doctors" className="btn btn-ghost btn-sm"><Search size={14} /> Search doctors</Link>
        </div>
        <div className="card-body">
          <div className="row-wrap">
            {specialties.data?.map((s) => (
              <Link key={s.id} to={`/doctors?specialization=${s.slug}`} className="btn btn-secondary btn-sm">
                <SpecialtyIcon name={s.icon} size={15} /> {s.name}
              </Link>
            ))}
            {specialties.data && <Link to="/specialties" className="btn btn-ghost btn-sm">All <ArrowRight size={14} /></Link>}
          </div>
        </div>
      </section>
    </div>
  );
}
