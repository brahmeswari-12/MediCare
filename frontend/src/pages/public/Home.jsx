import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CalendarCheck, Clock, FileText, Search, ShieldCheck, Stethoscope } from "lucide-react";
import { doctorApi, specializationApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import DoctorCard, { DoctorCardSkeleton } from "../../components/DoctorCard";
import SpecialtyIcon from "../../components/SpecialtyIcon";
import { ErrorState, Skeleton } from "../../components/ui";

export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const specialties = useApi(() => specializationApi.list(), []);
  const doctors = useApi(() => doctorApi.list({ page_size: 6, ordering: "-experience_years" }), []);

  function handleSearch(e) {
    e.preventDefault();
    navigate(`/doctors${query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ""}`);
  }

  return (
    <>
      <section className="hero">
        <div className="container">
          <div>
            <span className="eyebrow"><ShieldCheck size={14} /> Verified doctors only</span>
            <h1>Book trusted doctors <span>in minutes</span>, not days.</h1>
            <p className="hero-lead">
              Search by specialty, hospital or city, see real-time availability and confirm your appointment
              online. Your history, records and prescriptions stay in one secure place.
            </p>
            <form className="hero-search" onSubmit={handleSearch} role="search">
              <label htmlFor="hero-q" className="sr-only">Search doctors</label>
              <div className="input-icon" style={{ flex: 1 }}>
                <Search size={18} />
                <input id="hero-q" className="input" placeholder="Doctor name, specialty, hospital or city"
                       value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-lg" type="submit">Find doctors</button>
            </form>
            <div className="hero-stats">
              <div>
                <strong>{doctors.data ? doctors.data.count : "–"}</strong>
                <span>Approved doctors</span>
              </div>
              <div>
                <strong>{specialties.data ? specialties.data.length : "–"}</strong>
                <span>Specialties</span>
              </div>
              <div>
                <strong>Real-time</strong>
                <span>Slot availability</span>
              </div>
            </div>
          </div>
          <div className="hero-panel" aria-label="How booking works">
            <h3 style={{ marginBottom: 8 }}>Booking takes three steps</h3>
            {[
              ["Choose a doctor", "Filter by specialty, location and fee to find the right fit."],
              ["Pick a time", "Only genuinely open slots from the doctor's schedule are shown."],
              ["Get confirmed", "Receive an appointment ID instantly and track its status."],
            ].map(([title, text], i) => (
              <div className="step" key={title}>
                <span className="step-num">{i + 1}</span>
                <div>
                  <strong className="strong">{title}</strong>
                  <p className="small muted">{text}</p>
                </div>
              </div>
            ))}
            <Link to="/doctors" className="btn btn-teal btn-block mt-4">
              Start booking <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Browse by specialty</h2>
              <p>Consult specialists across the most common areas of care.</p>
            </div>
            <Link to="/specialties" className="btn btn-secondary">All specialties <ArrowRight size={16} /></Link>
          </div>
          {specialties.error ? (
            <ErrorState message={specialties.error} onRetry={specialties.reload} />
          ) : (
            <div className="grid grid-4">
              {specialties.loading
                ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={88} />)
                : specialties.data.slice(0, 8).map((s) => (
                    <Link key={s.id} to={`/doctors?specialization=${s.slug}`} className="card card-link specialty-card">
                      <span className="specialty-icon"><SpecialtyIcon name={s.icon} /></span>
                      <div>
                        <h3>{s.name}</h3>
                        <p>{s.doctor_count} doctor{s.doctor_count === 1 ? "" : "s"}</p>
                      </div>
                    </Link>
                  ))}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Experienced doctors</h2>
              <p>Every profile is reviewed and approved by our administrators before it can be booked.</p>
            </div>
            <Link to="/doctors" className="btn btn-secondary">View all doctors <ArrowRight size={16} /></Link>
          </div>
          {doctors.error ? (
            <ErrorState message={doctors.error} onRetry={doctors.reload} />
          ) : (
            <div className="grid grid-3">
              {doctors.loading
                ? Array.from({ length: 3 }).map((_, i) => <DoctorCardSkeleton key={i} />)
                : doctors.data.results.map((d) => <DoctorCard key={d.id} doctor={d} />)}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="grid grid-4">
            {[
              [CalendarCheck, "Live availability", "Slots come straight from each doctor's working hours, breaks and leave."],
              [Clock, "Easy rescheduling", "Move or cancel appointments online within the clinic's policy."],
              [FileText, "Records in one place", "View consultation summaries and prescriptions once your doctor releases them."],
              [ShieldCheck, "Private by design", "Only you and your treating doctor can see your medical records."],
            ].map(([Icon, title, text]) => (
              <div className="feature" key={title}>
                <span className="feature-icon"><Icon size={20} aria-hidden="true" /></span>
                <div>
                  <h3 style={{ fontSize: "var(--text-md)" }}>{title}</h3>
                  <p className="small muted mt-2">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="cta-band">
            <div>
              <h2>Are you a doctor?</h2>
              <p>Join the platform, publish your schedule and let patients book you online.</p>
            </div>
            <Link to="/register/doctor" className="btn btn-secondary btn-lg">
              <Stethoscope size={18} /> Apply as a doctor
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
