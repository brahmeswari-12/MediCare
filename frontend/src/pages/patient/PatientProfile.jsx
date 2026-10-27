import { useEffect } from "react";
import { patientApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import { useForm, validators } from "../../hooks/useForm";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { ChangePasswordForm } from "../shared/AccountSecurity";
import { Alert, ErrorState, PageHeader, PageLoader, SelectField, SubmitButton, TextAreaField, TextField } from "../../components/ui";
import { GENDERS, todayISO } from "../../utils/format";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function PatientProfile() {
  const toast = useToast();
  const { refreshUser } = useAuth();
  const profile = useApi(() => patientApi.profile(), []);
  const form = useForm({}, (v) => ({
    full_name: validators.required(v.full_name, "Full name"),
    phone: validators.required(v.phone, "Phone") || validators.phone(v.phone),
    date_of_birth: validators.required(v.date_of_birth, "Date of birth"),
    address: validators.required(v.address, "Address"),
    emergency_contact_phone: v.emergency_contact_phone ? validators.phone(v.emergency_contact_phone) : undefined,
  }));
  const { setValues } = form;

  useEffect(() => {
    if (profile.data) setValues(profile.data);
  }, [profile.data, setValues]);

  if (profile.loading) return <PageLoader />;
  if (profile.error) return <div className="card"><ErrorState message={profile.error} onRetry={profile.reload} /></div>;

  const onSubmit = form.handleSubmit(async (v) => {
    const fields = ["full_name", "phone", "date_of_birth", "gender", "address", "blood_group",
                    "emergency_contact_name", "emergency_contact_phone"];
    const updated = await patientApi.updateProfile(Object.fromEntries(fields.map((f) => [f, v[f] ?? ""])));
    profile.setData(updated);
    await refreshUser();
    toast.success("Profile updated.");
  });

  return (
    <div className="stack-lg" style={{ maxWidth: 860 }}>
      <PageHeader title="Profile & security" description="Keep your contact and health details up to date." />
      <section className="card">
        <div className="card-header"><h2>Personal details</h2></div>
        <form className="card-body stack-lg" onSubmit={onSubmit} noValidate>
          {form.formError && <Alert type="danger">{form.formError}</Alert>}
          <div className="form-grid">
            <TextField className="span-2" label="Full name" required {...form.field("full_name")} />
            <TextField label="Email" value={profile.data.email} disabled hint="Contact support to change your email." />
            <TextField label="Phone number" type="tel" required {...form.field("phone")} />
            <TextField label="Date of birth" type="date" required max={todayISO()} {...form.field("date_of_birth")} />
            <SelectField label="Gender" required {...form.field("gender")}>
              {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </SelectField>
            <SelectField label="Blood group" {...form.field("blood_group")}>
              <option value="">Not specified</option>
              {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
            </SelectField>
            <div />
            <TextAreaField className="span-2" label="Address" required rows={3} {...form.field("address")} />
            <TextField label="Emergency contact name" {...form.field("emergency_contact_name")} />
            <TextField label="Emergency contact phone" type="tel" {...form.field("emergency_contact_phone")} />
          </div>
          <div className="form-actions"><SubmitButton loading={form.submitting}>Save changes</SubmitButton></div>
        </form>
      </section>
      <ChangePasswordForm />
    </div>
  );
}
