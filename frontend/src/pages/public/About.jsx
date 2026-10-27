import { Link } from "react-router-dom";
import { CalendarCheck, ShieldCheck, Stethoscope, Users } from "lucide-react";

export default function About() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <h1>About MediCare</h1>
          <p>Connecting patients with verified doctors through simple, transparent online booking.</p>
        </div>
      </section>
      <div className="container" style={{ paddingTop: 40 }}>
        <div className="grid grid-2" style={{ alignItems: "start", gap: 48 }}>
          <div className="stack">
            <h2>Our approach</h2>
            <p>
              MediCare brings patients, doctors and clinic administrators onto one platform. Patients find the right
              specialist and book a real, open slot. Doctors control their own hours, breaks and leave. Administrators
              verify every doctor before their profile goes live.
            </p>
            <p>
              Medical records and prescriptions are written by the treating doctor and shared with the patient only
              when the doctor releases them. Administrators manage the platform but cannot read clinical notes.
            </p>
            <div className="alert alert-info">
              MediCare is a booking and records platform. It does not provide medical advice, diagnosis or emergency
              services. In an emergency, contact your local emergency number immediately.
            </div>
          </div>
          <div className="grid grid-2">
            {[
              [Users, "For patients", "Search, book, reschedule and keep your history in one place."],
              [Stethoscope, "For doctors", "Manage schedules, appointments, consultation notes and prescriptions."],
              [ShieldCheck, "Verified profiles", "Doctor accounts are approved by administrators before listing."],
              [CalendarCheck, "No double booking", "Every booking is re-checked by the server at the moment you confirm."],
            ].map(([Icon, title, text]) => (
              <div key={title} className="card card-body stack-sm">
                <span className="feature-icon"><Icon size={20} /></span>
                <h3 style={{ fontSize: "var(--text-md)" }}>{title}</h3>
                <p className="small muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="cta-band mt-6" style={{ marginTop: 48 }}>
          <div>
            <h2>Ready to see a doctor?</h2>
            <p>Browse specialists and book your next appointment online.</p>
          </div>
          <Link to="/doctors" className="btn btn-secondary btn-lg">Find a doctor</Link>
        </div>
      </div>
    </>
  );
}
