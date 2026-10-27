import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Upload } from "lucide-react";
import { doctorApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import { useForm, validators } from "../../hooks/useForm";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { ChangePasswordForm } from "../shared/AccountSecurity";
import { Alert, Avatar, ErrorState, PageHeader, PageLoader, Spinner, StatusBadge, SubmitButton, TextAreaField, TextField } from "../../components/ui";
import { getErrorMessage } from "../../utils/errors";

const EDITABLE = ["full_name", "phone", "qualifications", "experience_years", "hospital", "location", "address", "consultation_fee", "bio"];

export default function DoctorProfile() {
  const toast = useToast();
  const { refreshUser } = useAuth();
  const me = useApi(() => doctorApi.me(), []);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const form = useForm({}, (v) => ({
    full_name: validators.required(v.full_name, "Full name"),
    phone: v.phone ? validators.phone(v.phone) : undefined,
    qualifications: validators.required(v.qualifications, "Qualifications"),
    hospital: validators.required(v.hospital, "Hospital"),
    location: validators.required(v.location, "Location"),
    consultation_fee: v.consultation_fee === "" || Number(v.consultation_fee) < 0 ? "Enter a valid fee." : undefined,
  }));
  const { setValues } = form;
  useEffect(() => { if (me.data) setValues(me.data); }, [me.data, setValues]);

  if (me.loading) return <PageLoader />;
  if (me.error) return <div className="card"><ErrorState message={me.error} onRetry={me.reload} /></div>;
  const d = me.data;

  const onSubmit = form.handleSubmit(async (v) => {
    const updated = await doctorApi.updateMe(Object.fromEntries(EDITABLE.map((k) => [k, v[k]])));
    me.setData(updated);
    await refreshUser();
    toast.success("Profile updated.");
  });

  async function uploadPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file.");
    if (file.size > 2 * 1024 * 1024) return toast.error("Photo must be 2 MB or smaller.");
    const body = new FormData();
    body.append("photo", file);
    setUploading(true);
    try {
      me.setData(await doctorApi.updateMe(body));
      toast.success("Photo updated.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="stack-lg" style={{ maxWidth: 900 }}>
      <PageHeader title="Profile & security" description="This information appears on your public profile."
                  actions={d.approval_status === "APPROVED" && (
                    <Link to={`/doctors/${d.id}`} className="btn btn-secondary"><ExternalLink size={16} /> View public profile</Link>
                  )} />
      <section className="card card-body photo-upload" style={{ flexWrap: "wrap" }}>
        <Avatar name={d.full_name} src={d.photo} size={80} />
        <div className="stack-sm" style={{ flex: 1 }}>
          <div className="row-wrap">
            <strong className="strong">Dr. {d.full_name}</strong>
            <StatusBadge status={d.approval_status} />
          </div>
          <span className="small muted">{d.specialization?.name} · Registration {d.license_number} · {d.email}</span>
          <span className="xs muted">Specialization and registration number are verified credentials and can only be changed by an administrator.</span>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadPhoto} />
        <button className="btn btn-secondary" onClick={() => fileRef.current.click()} disabled={uploading}>
          {uploading ? <Spinner size={16} /> : <Upload size={16} />} Upload photo
        </button>
      </section>

      <section className="card">
        <div className="card-header"><h2>Professional details</h2></div>
        <form className="card-body stack-lg" onSubmit={onSubmit} noValidate>
          {form.formError && <Alert type="danger">{form.formError}</Alert>}
          <div className="form-grid">
            <TextField label="Full name" required {...form.field("full_name")} />
            <TextField label="Phone" type="tel" {...form.field("phone")} />
            <TextField className="span-2" label="Qualifications" required {...form.field("qualifications")} />
            <TextField label="Years of experience" type="number" min="0" max="70" {...form.field("experience_years")} />
            <TextField label="Consultation fee (₹)" type="number" min="0" required {...form.field("consultation_fee")} />
            <TextField label="Hospital / clinic" required {...form.field("hospital")} />
            <TextField label="City / location" required {...form.field("location")} />
            <TextField className="span-2" label="Clinic address" {...form.field("address")} />
            <TextAreaField className="span-2" label="Professional biography" rows={5} {...form.field("bio")} />
          </div>
          <div className="form-actions"><SubmitButton loading={form.submitting}>Save changes</SubmitButton></div>
        </form>
      </section>
      <ChangePasswordForm />
    </div>
  );
}
