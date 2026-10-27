import { Link } from "react-router-dom";
import { Briefcase, Building2, GraduationCap, MapPin } from "lucide-react";
import { Avatar } from "./ui";
import { formatMoney } from "../utils/format";

export default function DoctorCard({ doctor }) {
  return (
    <article className="card doctor-card">
      <div className="card-body">
        <Avatar name={doctor.full_name} src={doctor.photo} size={64} />
        <div style={{ minWidth: 0 }}>
          <h3>
            <Link to={`/doctors/${doctor.id}`} style={{ color: "inherit" }}>Dr. {doctor.full_name}</Link>
          </h3>
          <span className="badge badge-teal no-dot mt-2">{doctor.specialization?.name}</span>
          <div className="doctor-meta">
            <span><GraduationCap size={15} /> {doctor.qualifications}</span>
            <span><Briefcase size={15} /> {doctor.experience_years} years experience</span>
            <span><Building2 size={15} /> {doctor.hospital}</span>
            <span><MapPin size={15} /> {doctor.location}</span>
          </div>
        </div>
      </div>
      <div className="card-footer">
        <span className="fee">
          {formatMoney(doctor.consultation_fee)} <small>/ consultation</small>
        </span>
        <Link to={`/doctors/${doctor.id}`} className="btn btn-primary btn-sm">
          View &amp; book
        </Link>
      </div>
    </article>
  );
}

export function DoctorCardSkeleton() {
  return (
    <div className="card doctor-card" aria-hidden="true">
      <div className="card-body">
        <div className="skeleton" style={{ width: 64, height: 64, borderRadius: "50%" }} />
        <div className="stack-sm" style={{ flex: 1 }}>
          <div className="skeleton" style={{ height: 18, width: "60%" }} />
          <div className="skeleton" style={{ height: 14, width: "35%" }} />
          <div className="skeleton" style={{ height: 14, width: "80%" }} />
          <div className="skeleton" style={{ height: 14, width: "70%" }} />
        </div>
      </div>
      <div className="card-footer"><div className="skeleton" style={{ height: 20, width: "40%" }} /></div>
    </div>
  );
}
