import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Users } from "lucide-react";
import { patientApi } from "../../services";
import { useApi, useDebounce } from "../../hooks/useApi";
import Pagination from "../../components/Pagination";
import { Avatar, EmptyState, ErrorState, PageHeader, SkeletonRows } from "../../components/ui";
import { formatDate, genderLabel } from "../../utils/format";

export default function DoctorPatients() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounce(search);
  const { data, loading, error, reload } = useApi(() => patientApi.list({ search: q, page }), [q, page]);

  return (
    <>
      <PageHeader title="My patients" description="Patients who have booked appointments with you." />
      <div className="card">
        <div className="toolbar">
          <div className="field grow">
            <label className="label" htmlFor="pt-search">Search</label>
            <div className="input-icon">
              <Search size={16} />
              <input id="pt-search" className="input" placeholder="Name, email or phone" value={search}
                     onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </div>
        </div>
        {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <SkeletonRows rows={4} /> :
          data.results.length === 0 ? <EmptyState icon={Users} title="No patients found" /> : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Patient</th><th scope="col">Age / gender</th><th scope="col">Contact</th>
                      <th scope="col">Visits</th><th scope="col">Last appointment</th><th scope="col"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((p) => (
                      <tr key={p.id}>
                        <td><div className="row"><Avatar name={p.full_name} size={32} /><span className="cell-main">{p.full_name}</span></div></td>
                        <td>{p.age} · {genderLabel(p.gender)}{p.blood_group && ` · ${p.blood_group}`}</td>
                        <td><div>{p.phone}</div><div className="cell-sub">{p.email}</div></td>
                        <td>{p.appointment_count ?? "—"}</td>
                        <td>{p.last_visit ? formatDate(p.last_visit) : "—"}</td>
                        <td className="text-right">
                          <Link to={`/doctor/records?patient=${p.id}`} className="btn btn-secondary btn-sm">Records</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} count={data.count} onChange={setPage} />
            </>
          )}
      </div>
    </>
  );
}
