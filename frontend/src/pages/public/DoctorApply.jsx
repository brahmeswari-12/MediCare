import { useState } from "react";
import { Link } from "react-router-dom";
import { CircleCheckBig } from "lucide-react";
import { authApi, specializationApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import { useForm, validators } from "../../hooks/useForm";
import { Alert, SelectField, SubmitButton, TextAreaField, TextField } from "../../components/ui";
import { AuthAside } from "./Login";

const INITIAL = {
  full_name: "", email: "", phone: "", password: "", confirm_password: "", specialization_id: "",
  license_number: "", qualifications: "", experience_years: "", hospital: "", location: "",
  consultation_fee: "", bio: "",
};

function validate(v) {
  return {
    full_name: validators.required(v.full_name, "Full name"),
    email: validators.required(v.email, "Email") || validators.email(v.email),
    phone: validators.required(v.phone, "Phone number") || validators.phone(v.phone),
    password: validators.password(v.password),
    confirm_password: v.password !== v.confirm_password ? "Passwords do not match." : undefined,
    specialization_id: validators.required(v.specialization_id, "Specialization"),
    license_number: validators.required(v.license_number, "Registration number"),
    qualifications: validators.required(v.qualifications, "Qualifications"),
    experience_years: v.experience_years === "" || v.experience_years < 0 ? "Enter years of experience." : undefined,
    hospital: validators.required(v.hospital, "Hospital / clinic"),
    location: validators.required(v.location, "Location"),
    consultation_fee: v.consultation_fee === "" || v.consultation_fee < 0 ? "Enter a valid fee." : undefined,
  };
}

export default function DoctorApply() {
  const specialties = useApi(() => specializationApi.list(), []);
  const form = useForm(INITIAL, validate);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = form.handleSubmit(async (values) => {
    await authApi.applyAsDoctor({ ...values, email: values.email.trim() });
    setSubmitted(true);
    window.scrollTo({ top: 0 });
  });

  return (
    <div className="auth-page">
      <AuthAside title="Grow your practice online" />
      <div className="auth-main">
        <div className="auth-card wide stack-lg">
          {submitted ? (
            <div className="state">
              <div className="success-mark"><CircleCheckBig size={32} /></div>
              <h1 style={{ fontSize: "var(--text-xl)" }}>Application received</h1>
              <p>
                Thank you. An administrator will verify your registration details. You can sign in now to complete
                your profile and set your schedule; patients can book you once you are approved.
              </p>
              <Link to="/login" className="btn btn-primary">Go to sign in</Link>
            </div>
          ) : (
            <>
              <div>
                <h1>Apply as a doctor</h1>
                <p className="muted mt-2">Your profile is reviewed by an administrator before it becomes bookable.</p>
              </div>
              {form.formError && <Alert type="danger">{form.formError}</Alert>}
              <form className="stack-lg" onSubmit={onSubmit} noValidate>
                <div className="form-grid">
                  <TextField className="span-2" label="Full name" required hint="Without the 'Dr.' prefix" {...form.field("full_name")} />
                  <TextField label="Email" type="email" required autoComplete="email" {...form.field("email")} />
                  <TextField label="Phone number" type="tel" required {...form.field("phone")} />
                  <TextField label="Password" type="password" required autoComplete="new-password" {...form.field("password")} />
                  <TextField label="Confirm password" type="password" required autoComplete="new-password" {...form.field("confirm_password")} />
                  <SelectField label="Specialization" required {...form.field("specialization_id")}>
                    <option value="">Select…</option>
                    {specialties.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </SelectField>
                  <TextField label="Medical registration number" required {...form.field("license_number")} />
                  <TextField label="Qualifications" required placeholder="MBBS, MD (General Medicine)" {...form.field("qualifications")} />
                  <TextField label="Years of experience" type="number" min="0" max="70" required {...form.field("experience_years")} />
                  <TextField label="Hospital / clinic" required {...form.field("hospital")} />
                  <TextField label="City / location" required {...form.field("location")} />
                  <TextField label="Consultation fee (₹)" type="number" min="0" step="1" required {...form.field("consultation_fee")} />
                  <TextAreaField className="span-2" label="Professional biography" rows={4} {...form.field("bio")} />
                </div>
                <SubmitButton loading={form.submitting} className="btn btn-primary btn-lg btn-block">Submit application</SubmitButton>
              </form>
              <p className="small muted">Already applied? <Link to="/login">Sign in</Link></p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
