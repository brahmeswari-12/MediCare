import { doctorApi, adminApi, specializationApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import { useForm, validators } from "../../hooks/useForm";
import { Modal } from "../../components/Modal";
import { Alert, SelectField, Spinner, TextAreaField, TextField } from "../../components/ui";

const FIELDS = ["full_name", "phone", "specialization_id", "license_number", "qualifications", "experience_years",
  "hospital", "location", "address", "consultation_fee", "bio", "max_appointments_per_day"];

/** Create (doctor = null) or edit a doctor account as an administrator. */
export function DoctorFormDialog({ doctor, onClose, onSaved }) {
  const isNew = !doctor;
  const specialties = useApi(() => specializationApi.list(), []);
  const form = useForm(
    isNew
      ? { full_name: "", email: "", phone: "", password: "", specialization_id: "", license_number: "", qualifications: "",
          experience_years: "", hospital: "", location: "", address: "", consultation_fee: "", bio: "", approve: true }
      : { ...doctor, specialization_id: doctor.specialization?.id ?? "", max_appointments_per_day: doctor.max_appointments_per_day ?? "" },
    (v) => ({
      full_name: validators.required(v.full_name, "Full name"),
      email: isNew ? validators.required(v.email, "Email") || validators.email(v.email) : undefined,
      password: isNew ? validators.password(v.password) : undefined,
      specialization_id: validators.required(v.specialization_id, "Specialization"),
      license_number: validators.required(v.license_number, "Registration number"),
      qualifications: validators.required(v.qualifications, "Qualifications"),
      experience_years: v.experience_years === "" ? "Required." : undefined,
      hospital: validators.required(v.hospital, "Hospital"),
      location: validators.required(v.location, "Location"),
      consultation_fee: v.consultation_fee === "" ? "Required." : undefined,
    })
  );

  const onSubmit = form.handleSubmit(async (v) => {
    const payload = Object.fromEntries(FIELDS.map((k) => [k, v[k]]));
    payload.max_appointments_per_day = v.max_appointments_per_day === "" ? null : Number(v.max_appointments_per_day);
    if (isNew) {
      delete payload.max_appointments_per_day;
      onSaved(await doctorApi.create({ ...payload, email: v.email.trim(), password: v.password, approve: v.approve }));
    } else {
      onSaved(await adminApi.updateDoctor(doctor.id, payload));
    }
  });

  return (
    <Modal open onClose={onClose} size="modal-lg" title={isNew ? "Add doctor" : `Edit Dr. ${doctor.full_name}`}
           description={isNew ? "Creates a doctor login. Share the temporary password securely; the doctor should change it after signing in." : undefined}
           footer={
             <>
               <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
               <button className="btn btn-primary" onClick={onSubmit} disabled={form.submitting}>
                 {form.submitting && <Spinner size={16} />} {isNew ? "Create doctor" : "Save changes"}
               </button>
             </>
           }>
      <form className="stack" onSubmit={onSubmit} noValidate>
        {form.formError && <Alert type="danger">{form.formError}</Alert>}
        <div className="form-grid">
          <TextField label="Full name" required {...form.field("full_name")} />
          {isNew ? <TextField label="Email" type="email" required {...form.field("email")} />
            : <TextField label="Email" value={doctor.email} disabled />}
          <TextField label="Phone" type="tel" {...form.field("phone")} />
          {isNew && <TextField label="Temporary password" type="password" autoComplete="new-password" required {...form.field("password")} />}
          <SelectField label="Specialization" required {...form.field("specialization_id")}>
            <option value="">Select…</option>
            {specialties.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectField>
          <TextField label="Registration number" required {...form.field("license_number")} />
          <TextField label="Qualifications" required {...form.field("qualifications")} />
          <TextField label="Years of experience" type="number" min="0" required {...form.field("experience_years")} />
          <TextField label="Hospital / clinic" required {...form.field("hospital")} />
          <TextField label="City / location" required {...form.field("location")} />
          <TextField label="Consultation fee (₹)" type="number" min="0" required {...form.field("consultation_fee")} />
          {!isNew && <TextField label="Max appointments per day" type="number" min="1" {...form.field("max_appointments_per_day")} />}
          <TextField className="span-2" label="Clinic address" {...form.field("address")} />
          <TextAreaField className="span-2" label="Biography" rows={3} {...form.field("bio")} />
          {isNew && (
            <label className="checkbox span-2">
              <input type="checkbox" {...form.field("approve", { type: "checkbox" })} /> Approve immediately (listed and bookable)
            </label>
          )}
        </div>
      </form>
    </Modal>
  );
}
