import { useState } from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { recordApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import Pagination from "../../components/Pagination";
import { EmptyState, ErrorState, PageHeader, SkeletonRows } from "../../components/ui";
import { formatDate } from "../../utils/format";

/** Used by both patients (released records only, enforced by the API) and doctors. */
export function RecordList({ basePath, showPatient = false, params = {} }) {
  const [page, setPage] = useState(1);
  const key = JSON.stringify(params);
  const { data, loading, error, reload } = useApi(() => recordApi.list({ ...params, page }), [page, key]);

  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;
  return (
    <div className="card">
      {loading ? <SkeletonRows rows={4} /> : data.results.length === 0 ? (
        <EmptyState icon={FileText} title="No records yet"
                    description={showPatient ? "Records you write after consultations will appear here."
                      : "Your doctor shares a consultation summary here after your visit."} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Visit date</th>
                  {showPatient ? <th scope="col">Patient</th> : <th scope="col">Doctor</th>}
                  <th scope="col">Diagnosis</th>
                  <th scope="col">Prescriptions</th>
                  {showPatient && <th scope="col">Status</th>}
                  <th scope="col"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap">
                      <div className="cell-main">{formatDate(r.appointment_detail.date)}</div>
                      <div className="cell-sub">{r.appointment_detail.reference}</div>
                    </td>
                    <td>
                      {showPatient ? <span className="cell-main">{r.appointment_detail.patient_name}</span> : (
                        <>
                          <div className="cell-main">Dr. {r.appointment_detail.doctor_name}</div>
                          <div className="cell-sub">{r.appointment_detail.specialization}</div>
                        </>
                      )}
                    </td>
                    <td style={{ maxWidth: 320 }}>{r.diagnosis.length > 80 ? `${r.diagnosis.slice(0, 80)}…` : r.diagnosis}</td>
                    <td>{r.prescriptions.length}</td>
                    {showPatient && (
                      <td>
                        <span className={`badge ${r.is_released ? "badge-completed" : "badge-neutral"}`}>
                          {r.is_released ? "Shared" : "Draft"}
                        </span>
                      </td>
                    )}
                    <td className="text-right"><Link to={`${basePath}/${r.id}`} className="btn btn-secondary btn-sm">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} count={data.count} onChange={setPage} />
        </>
      )}
    </div>
  );
}

export default function PatientRecords() {
  return (
    <>
      <PageHeader title="Medical records" description="Consultation summaries shared with you by your doctors." />
      <RecordList basePath="/patient/records" />
    </>
  );
}
