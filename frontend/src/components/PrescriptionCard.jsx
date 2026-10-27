import { Pill } from "lucide-react";
import { formatDate } from "../utils/format";

export default function PrescriptionCard({ prescription, showContext = false }) {
  const appt = prescription.appointment;
  return (
    <article className="card">
      <div className="card-header">
        <div className="row">
          <span className="specialty-icon" style={{ width: 36, height: 36 }}><Pill size={18} /></span>
          <div>
            <h3 style={{ fontSize: "var(--text-md)" }}>Prescription · {formatDate(prescription.created_at)}</h3>
            {showContext && appt && (
              <p className="small muted">
                Dr. {appt.doctor_name} · {appt.specialization} · for {appt.patient_name} · {appt.reference}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Medicine</th>
              <th scope="col">Dosage</th>
              <th scope="col">Frequency</th>
              <th scope="col">Duration</th>
              <th scope="col">Instructions</th>
            </tr>
          </thead>
          <tbody>
            {prescription.items.map((item) => (
              <tr key={item.id}>
                <td className="cell-main">{item.medicine_name}</td>
                <td>{item.dosage}</td>
                <td>{item.frequency}</td>
                <td>{item.duration}</td>
                <td>{item.instructions || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {prescription.notes && <div className="card-footer small">{prescription.notes}</div>}
    </article>
  );
}
