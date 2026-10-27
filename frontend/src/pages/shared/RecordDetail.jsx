import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Pencil, Plus, Send } from "lucide-react";
import { recordApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { ConfirmDialog } from "../../components/Modal";
import PrescriptionCard from "../../components/PrescriptionCard";
import PrescriptionForm from "../doctor/PrescriptionForm";
import { Alert, ErrorState, PageLoader } from "../../components/ui";
import { formatDate, formatDateTime, formatTime } from "../../utils/format";

export default function RecordDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const isDoctor = user.role === "DOCTOR";
  const base = isDoctor ? "/doctor" : "/patient";
  const { data: record, setData, loading, error, reload } = useApi(() => recordApi.get(id), [id]);
  const [releasing, setReleasing] = useState(false);
  const [addingRx, setAddingRx] = useState(false);

  if (loading) return <PageLoader />;
  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;
  const appt = record.appointment_detail;

  return (
    <div className="stack-lg">
      <div>
        <Link to={`${base}/records`} className="btn btn-ghost btn-sm" style={{ marginLeft: -12 }}>
          <ChevronLeft size={16} /> {isDoctor ? "Consultation records" : "Medical records"}
        </Link>
      </div>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <div className="row-wrap">
            <h1>Consultation record</h1>
            {isDoctor && (
              <span className={`badge ${record.is_released ? "badge-completed" : "badge-neutral"}`}>
                {record.is_released ? "Shared with patient" : "Draft – not shared"}
              </span>
            )}
          </div>
          <p>
            {formatDate(appt.date)} at {formatTime(appt.start_time)} · Dr. {appt.doctor_name} ({appt.specialization})
            {isDoctor && ` · ${appt.patient_name}`} · <Link to={`${base}/appointments/${appt.id}`}>{appt.reference}</Link>
          </p>
        </div>
        {isDoctor && (
          <div className="row-wrap">
            <Link to={`/doctor/records/${record.id}/edit`} className="btn btn-secondary"><Pencil size={16} /> Edit</Link>
            {!record.is_released && (
              <button className="btn btn-primary" onClick={() => setReleasing(true)}><Send size={16} /> Share with patient</button>
            )}
          </div>
        )}
      </div>

      {isDoctor && !record.is_released && (
        <Alert type="info">The patient cannot see this record or its prescriptions until you share it.</Alert>
      )}

      <section className="card">
        <div className="card-header"><h2>Clinical summary</h2></div>
        <div className="card-body">
          <dl className="kv">
            {record.symptoms && (<><dt>Symptoms</dt><dd style={{ whiteSpace: "pre-line" }}>{record.symptoms}</dd></>)}
            <dt>Diagnosis</dt><dd style={{ whiteSpace: "pre-line" }}>{record.diagnosis}</dd>
            {record.notes && (<><dt>Consultation notes</dt><dd style={{ whiteSpace: "pre-line" }}>{record.notes}</dd></>)}
            {record.follow_up_instructions && (
              <><dt>Follow-up instructions</dt><dd style={{ whiteSpace: "pre-line" }}>{record.follow_up_instructions}</dd></>
            )}
            {record.follow_up_date && (<><dt>Follow-up date</dt><dd>{formatDate(record.follow_up_date)}</dd></>)}
            <dt>Last updated</dt><dd>{formatDateTime(record.updated_at)}</dd>
          </dl>
        </div>
      </section>

      <div className="row between">
        <h2 style={{ fontSize: "var(--text-lg)" }}>Prescriptions</h2>
        {isDoctor && !addingRx && (
          <button className="btn btn-secondary btn-sm" onClick={() => setAddingRx(true)}><Plus size={14} /> Add prescription</button>
        )}
      </div>
      {addingRx && (
        <PrescriptionForm recordId={record.id} onCancel={() => setAddingRx(false)}
                          onSaved={(rx) => {
                            setData({ ...record, prescriptions: [rx, ...record.prescriptions] });
                            setAddingRx(false);
                            toast.success("Prescription added.");
                          }} />
      )}
      {record.prescriptions.length === 0 && !addingRx ? (
        <div className="card card-body muted small">No prescriptions were issued for this consultation.</div>
      ) : (
        record.prescriptions.map((p) => <PrescriptionCard key={p.id} prescription={p} />)
      )}

      <p className="xs muted">
        This record summarises your consultation. It is not a substitute for professional medical advice; contact your
        doctor with any questions about your treatment.
      </p>

      <ConfirmDialog
        open={releasing} onClose={() => setReleasing(false)} confirmLabel="Share with patient"
        title="Share this record with the patient?"
        description="The patient will be able to view the diagnosis, notes and prescriptions. Shared records cannot be withdrawn."
        onConfirm={async () => {
          const updated = await recordApi.update(record.id, { is_released: true });
          setData(updated);
          toast.success("Record shared with the patient.");
        }}
      />
    </div>
  );
}
