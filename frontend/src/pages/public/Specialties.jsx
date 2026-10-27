import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { specializationApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import SpecialtyIcon from "../../components/SpecialtyIcon";
import { ErrorState, Skeleton } from "../../components/ui";

export default function Specialties() {
  const { data, loading, error, reload } = useApi(() => specializationApi.list(), []);
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <h1>Medical specialties</h1>
          <p>Choose a specialty to see the doctors available for it.</p>
        </div>
      </section>
      <div className="container" style={{ paddingTop: 32 }}>
        {error ? (
          <div className="card"><ErrorState message={error} onRetry={reload} /></div>
        ) : (
          <div className="grid grid-3">
            {loading
              ? Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} height={132} />)
              : data.map((s) => (
                  <Link key={s.id} to={`/doctors?specialization=${s.slug}`} className="card card-link">
                    <div className="specialty-card" style={{ flexDirection: "column" }}>
                      <span className="specialty-icon"><SpecialtyIcon name={s.icon} /></span>
                      <div>
                        <h3>{s.name}</h3>
                        <p>{s.description || "Specialist consultations."}</p>
                      </div>
                      <span className="small strong row" style={{ color: "var(--primary-600)", gap: 6 }}>
                        {s.doctor_count} doctor{s.doctor_count === 1 ? "" : "s"} <ArrowRight size={14} />
                      </span>
                    </div>
                  </Link>
                ))}
          </div>
        )}
      </div>
    </>
  );
}
