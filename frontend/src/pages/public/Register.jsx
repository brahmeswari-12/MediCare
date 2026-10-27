import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useForm, validators } from "../../hooks/useForm";
import { Alert, SelectField, SubmitButton, TextAreaField, TextField } from "../../components/ui";
import { GENDERS, todayISO } from "../../utils/format";
import { AuthAside } from "./Login";

const INITIAL = {
  full_name: "", email: "", phone: "", password: "", confirm_password: "",
  date_of_birth: "", gender: "", address: "",
};

// eslint-disable-next-line react-refresh/only-export-components
export function validatePatient(v) {
  return {
    full_name: validators.required(v.full_name, "Full name"),
    email: validators.required(v.email, "Email") || validators.email(v.email),
    phone: validators.required(v.phone, "Phone number") || validators.phone(v.phone),
    password: validators.password(v.password),
    confirm_password: v.password !== v.confirm_password ? "Passwords do not match." : undefined,
    date_of_birth: !v.date_of_birth ? "Date of birth is required."
      : v.date_of_birth >= todayISO() ? "Date of birth must be in the past." : undefined,
    gender: validators.required(v.gender, "Gender"),
    address: validators.required(v.address, "Address"),
  };
}

export function PatientFields({ form, withPassword = true }) {
  return (
    <div className="form-grid">
      <TextField className="span-2" label="Full name" required autoComplete="name" {...form.field("full_name")} />
      <TextField label="Email" type="email" required autoComplete="email" {...form.field("email")} />
      <TextField label="Phone number" type="tel" required autoComplete="tel" placeholder="+91 98765 43210" {...form.field("phone")} />
      {withPassword && (
        <>
          <TextField label="Password" type="password" required autoComplete="new-password"
                     hint="At least 8 characters, not only numbers." {...form.field("password")} />
          <TextField label="Confirm password" type="password" required autoComplete="new-password" {...form.field("confirm_password")} />
        </>
      )}
      <TextField label="Date of birth" type="date" required max={todayISO()} {...form.field("date_of_birth")} />
      <SelectField label="Gender" required {...form.field("gender")}>
        <option value="">Select…</option>
        {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
      </SelectField>
      <TextAreaField className="span-2" label="Address" required rows={3} autoComplete="street-address" {...form.field("address")} />
    </div>
  );
}

export default function Register() {
  const { registerPatient } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const form = useForm(INITIAL, validatePatient);

  const onSubmit = form.handleSubmit(async (values) => {
    await registerPatient({ ...values, email: values.email.trim() });
    toast.success("Welcome! Your account has been created.");
    navigate("/patient", { replace: true });
  });

  return (
    <div className="auth-page">
      <AuthAside title="Create your patient account" />
      <div className="auth-main">
        <div className="auth-card wide stack-lg">
          <div>
            <h1>Create an account</h1>
            <p className="muted mt-2">Register as a patient to book and manage appointments.</p>
          </div>
          {form.formError && <Alert type="danger">{form.formError}</Alert>}
          <form className="stack-lg" onSubmit={onSubmit} noValidate>
            <PatientFields form={form} />
            <SubmitButton loading={form.submitting} className="btn btn-primary btn-lg btn-block">Create account</SubmitButton>
          </form>
          <p className="small muted">
            Already registered? <Link to="/login">Sign in</Link> · Doctor? <Link to="/register/doctor">Apply here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
