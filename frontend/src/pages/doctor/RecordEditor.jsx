import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { appointmentApi, recordApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import { useForm, validators } from "../../hooks/useForm";
import { useToast } from "../../context/ToastContext";
import { Alert, ErrorState, PageHeader, PageLoader, SubmitButton, TextAreaField, TextField } from "../../components/ui";
import { formatDate, formatTime, todayISO } from "../../utils/format";

const EMPTY = { symptoms: "", diagnosis: "", notes: "", follow_up_instructions: "", follow_up_date: "", is_released: false };

/** Create (/doctor/records/new?appointment=ID) or edit (/doctor/records/:id/edit) a consultation record. */
export default function RecordEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const appointmentId = params.get("appointment");
  const existing = useApi(() => recordApi.get(id), [id], { enabled: Boolean(id) });
  const appointment = useApi(() => appointmentApi.get(appointmentId), [appointmentId], { enabled: !id && Boolean(appointmentId) });
  const form = useForm(EMPTY, (v) => ({
    diagnosis: validators.required(v.diagnosis, "Diagnosis"),
    follow_up_date: v.follow_up_date && v.follow_up_date < todayISO() ? "Follow-up date cannot be in the past." : undefined,
  }));
  const { setValues } = form;

  useEffect(() => {
    if (existing.data) setValues({ ...EMPTY, ...existing.data, follow_up_date: existing.data.follow_up_date || "" });
  }, [existing.data, setValues]);

  if (!id && !appointmentId) {
    return <Alert type="warning">Open an appointment and choose "Write consultation record" to start a new record.</Alert>;
  }
  const loading = id ? existing.loading : appointment.loading;
  const error = id ? existing.error : appointment.error;
  if (loading) return <PageLoader />;
  if (error) return <div className="card"><ErrorState message={error} /></div>;

  const context = id
    ? existing.data.appointment_detail
    : { ...appointment.data, patient_name: appointment.data.patient.full_name };

  const onSubmit = form.handleSubmit(async (v) => {
    const payload = {
      symptoms: v.symptoms, diagnosis: v.diagnosis, notes: v.notes,
      follow_up_instructions: v.follow_up_instructions, follow_up_date: v.follow_up_date || null,
      is_released: v.is_released,
    };
    const saved = id ? await recordApi.update(id, payload) : await recordApi.create({ ...payload, appointment: Number(appointmentId) });
    toast.success(id ? "Record updated." : "Consultation record saved.");
    navigate(`/doctor/records/${saved.id}`, { replace: true });
  });

  return (
    <div className="stack-lg" style={{ maxWidth: 860 }}>
      <div>
        <Link to={id ? `/doctor/records/${id}` : `/doctor/appointments/${appointmentId}`} className="btn btn-ghost btn-sm" style={{ marginLeft: -12 }}>
          <ChevronLeft size={16} /> Back
        </Link>
      </div>
      <PageHeader
        title={id ? "Edit consultation record" : "New consultation record"}
        description={`${context.patient_name} · ${formatDate(context.date)} at ${formatTime(context.start_time)} · ${context.reference}`}
      />
      <form className="card" onSubmit={onSubmit} noValidate>
        <div className="card-body stack-lg">
          {form.formError && <Alert type="danger">{form.formError}</Alert>}
          {!id && appointment.data?.reason && (
            <Alert type="info" title="Patient's reason for visit">{appointment.data.reason}</Alert>
          )}
          <TextAreaField label="Symptoms" rows={3} {...form.field("symptoms")} />
          <TextAreaField label="Diagnosis" required rows={3} {...form.field("diagnosis")} />
          <TextAreaField label="Consultation notes" rows={5} {...form.field("notes")} />
          <TextAreaField label="Follow-up instructions" rows={3} {...form.field("follow_up_instructions")} />
          <TextField label="Follow-up date" type="date" min={todayISO()} {...form.field("follow_up_date")} />
          {!(id && existing.data?.is_released) && (
            <label className="checkbox">
              <input type="checkbox" {...form.field("is_released", { type: "checkbox" })} />
              Share this record with the patient now
            </label>
          )}
          <p className="xs muted">You can add prescriptions after saving the record.</p>
        </div>
        <div className="card-footer form-actions" style={{ marginTop: 0 }}>
          <SubmitButton loading={form.submitting}>{id ? "Save changes" : "Save record"}</SubmitButton>
        </div>
      </form>
    </div>
  );
}
