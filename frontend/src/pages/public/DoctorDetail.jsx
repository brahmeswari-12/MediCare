import { Link, useNavigate, useParams } from "react-router-dom";
import { Briefcase, Building2, CalendarCheck, ChevronLeft, Clock, GraduationCap, MapPin } from "lucide-react";
import { doctorApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { Alert, Avatar, ErrorState, PageLoader } from "../../components/ui";
import { formatDate, formatMoney, formatTimeRange, WEEKDAYS } from "../../utils/format";

export default function DoctorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const doctor = useApi(() => doctorApi.get(id), [id]);
  const schedule = useApi(() => doctorApi.schedule(id), [id]);

  if (doctor.loading) return <PageLoader />;
  if (doctor.error) {
    return <div className="container" style={{ paddingTop: 48 }}><div className="card"><ErrorState message={doctor.error} onRetry={doctor.reload} /></div></div>;
  }
  const d = doctor.data;

  function handleBook() {
    const target = `/patient/book/${d.id}`;
    if (!user) navigate(`/login?next=${encodeURIComponent(target)}`);
    else navigate(target);
  }

  const byDay = WEEKDAYS.map((name, wd) => ({
    name,
    intervals: (schedule.data?.schedules || []).filter((s) => s.weekday === wd),
  }));

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <Link to="/doctors" className="btn btn-ghost btn-sm" style={{ marginLeft: -12, marginBottom: 12 }}>
            <ChevronLeft size={16} /> All doctors
          </Link>
          <div className="row" style={{ gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
            <Avatar name={d.full_name} src={d.photo} size={104} />
            <div className="stack-sm" style={{ flex: 1, minWidth: 240 }}>
              <h1>Dr. {d.full_name}</h1>
              <div className="row-wrap">
                <span className="badge badge-teal no-dot">{d.specialization?.name}</span>
                <span className="small muted">{d.qualifications}</span>
              </div>
              <div className="doctor-meta" style={{ flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
                <span><Briefcase size={15} /> {d.experience_years} years experience</span>
                <span><Building2 size={15} /> {d.hospital}</span>
                <span><MapPin size={15} /> {d.location}</span>
              </div>
            </div>
            <div className="card card-body" style={{ minWidth: 260 }}>
              <div className="small muted">Consultation fee</div>
              <div className="stat-value" style={{ margin: "4px 0 16px" }}>{formatMoney(d.consultation_fee)}</div>
              {user && user.role !== "PATIENT" ? (
                <Alert type="info">Only patient accounts can book appointments.</Alert>
              ) : (
                <button className="btn btn-primary btn-block btn-lg" onClick={handleBook}>
                  <CalendarCheck size={18} /> Book appointment
                </button>
              )}
              {!user && <p className="xs muted mt-2">You'll be asked to sign in or create a free account.</p>}
            </div>
          </div>
        </div>
      </section>

      <div className="container" style={{ paddingTop: 32 }}>
        <div className="grid layout-aside">
          <div className="stack-lg">
            <section className="card">
              <div className="card-header"><h2>About</h2></div>
              <div className="card-body stack">
                <p style={{ whiteSpace: "pre-line" }}>{d.bio || "This doctor has not added a biography yet."}</p>
                <dl className="kv">
                  <dt>Specialization</dt><dd>{d.specialization?.name}</dd>
                  <dt>Qualifications</dt><dd>{d.qualifications}</dd>
                  <dt>Experience</dt><dd>{d.experience_years} years</dd>
                  <dt>Hospital / clinic</dt><dd>{d.hospital}</dd>
                  {d.address && (<><dt>Address</dt><dd>{d.address}</dd></>)}
                </dl>
              </div>
            </section>
          </div>
          <aside className="stack-lg">
            <section className="card">
              <div className="card-header"><h2><Clock size={16} style={{ verticalAlign: -2, marginRight: 6 }} />Weekly hours</h2></div>
              <div className="card-body">
                {schedule.loading ? <div className="skeleton" style={{ height: 160 }} /> : schedule.error ? (
                  <p className="small muted">{schedule.error}</p>
                ) : (
                  <ul className="list">
                    {byDay.map((day) => (
                      <li key={day.name} className="summary-row">
                        <span className="muted">{day.name}</span>
                        <span className="strong small" style={{ textAlign: "right" }}>
                          {day.intervals.length
                            ? day.intervals.map((i) => <div key={i.id}>{formatTimeRange(i.start_time, i.end_time)}</div>)
                            : <span className="muted" style={{ fontWeight: 400 }}>Closed</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {schedule.data?.blocked_dates?.length > 0 && (
                  <p className="xs muted mt-4">
                    Unavailable on: {schedule.data.blocked_dates.slice(0, 5).map((b) => formatDate(b.date)).join(", ")}
                    {schedule.data.blocked_dates.length > 5 && "…"}
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
