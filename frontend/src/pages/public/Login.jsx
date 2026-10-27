import { useEffect } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarCheck, CalendarClock, ClipboardList, FileText, LayoutDashboard, ShieldCheck, Stethoscope, UserCheck,
  UserRound, Users,
} from "lucide-react";
import { HOME_BY_ROLE, RoleMismatchError, useAuth } from "../../context/AuthContext";
import { useForm, validators } from "../../hooks/useForm";
import { safeNext } from "../../routes/ProtectedRoute";
import { Alert, PasswordField, SubmitButton, TextField } from "../../components/ui";

const DEFAULT_POINTS = [
  [CalendarCheck, "Book real, open appointment slots with verified doctors."],
  [FileText, "Access consultation summaries and prescriptions in one place."],
  [ShieldCheck, "Your records are visible only to you and your treating doctor."],
];

export function AuthAside({ title = "Your health, organised.", points = DEFAULT_POINTS }) {
  return (
    <aside className="auth-aside">
      <h2>{title}</h2>
      <ul>
        {points.map(([Icon, text]) => (
          <li key={text}><Icon size={20} aria-hidden="true" /> <span>{text}</span></li>
        ))}
      </ul>
    </aside>
  );
}

/* Copy and links for each sign-in role. The selector only tailors the page;
   the server decides what an account can do from its real role. */
const ROLES = {
  PATIENT: {
    key: "patient",
    label: "Patient",
    icon: UserRound,
    title: "Patient sign in",
    description: "Book appointments and view your records, prescriptions and payments.",
    asideTitle: "Your health, organised.",
    points: DEFAULT_POINTS,
  },
  DOCTOR: {
    key: "doctor",
    label: "Doctor",
    icon: Stethoscope,
    title: "Doctor sign in",
    description: "Manage your schedule, appointments and consultation records.",
    asideTitle: "Your practice, in one place.",
    points: [
      [CalendarClock, "Set weekly hours, breaks and days off; patients only see real open slots."],
      [UserCheck, "Confirm, complete or cancel appointments with a full history."],
      [ClipboardList, "Write consultation notes and prescriptions, and share them when ready."],
    ],
  },
  ADMIN: {
    key: "admin",
    label: "Admin",
    icon: ShieldCheck,
    title: "Administrator sign in",
    description: "Manage doctors, patients, appointments and platform data.",
    asideTitle: "Run the platform with confidence.",
    points: [
      [UserCheck, "Review and approve doctor applications before they go live."],
      [Users, "Manage patient and doctor accounts without losing history."],
      [LayoutDashboard, "Track appointments and supplies from live statistics."],
    ],
  },
};
const ROLE_BY_KEY = Object.fromEntries(Object.entries(ROLES).map(([role, cfg]) => [cfg.key, role]));

/** Initial role: ?role=doctor, else inferred from ?next=/doctor/..., else patient. */
function initialRole(params) {
  const fromParam = ROLE_BY_KEY[params.get("role")];
  if (fromParam) return fromParam;
  const next = params.get("next") || "";
  return Object.keys(HOME_BY_ROLE).find((role) => next.startsWith(HOME_BY_ROLE[role])) || "PATIENT";
}

function RoleSelector({ value, onChange }) {
  return (
    <fieldset className="segmented" aria-label="Sign in as">
      <legend className="sr-only">Sign in as</legend>
      {Object.entries(ROLES).map(([role, cfg]) => (
        <label key={role} className="segment">
          <input type="radio" name="login-role" value={role} checked={value === role} onChange={() => onChange(role)} />
          <span><cfg.icon size={16} aria-hidden="true" /> {cfg.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export default function Login() {
  const { login, sessionExpired, clearSessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const role = initialRole(params);
  const cfg = ROLES[role];
  const expired = sessionExpired || params.get("expired");
  const form = useForm({ email: "", password: "" }, (v) => ({
    email: validators.required(v.email, "Email") || validators.email(v.email),
    password: validators.required(v.password, "Password"),
  }));
  const { setFormError } = form;

  useEffect(() => () => clearSessionExpired(), [clearSessionExpired]);

  function selectRole(next) {
    const updated = new URLSearchParams(params);
    updated.set("role", ROLES[next].key);
    setParams(updated, { replace: true });
    setFormError("");
  }

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    let user;
    try {
      user = await login(email.trim(), password, role);
    } catch (err) {
      if (err instanceof RoleMismatchError) {
        const actual = ROLES[err.actualRole];
        selectRole(err.actualRole);
        setFormError(`This is ${actual.label === "Admin" ? "an administrator" : `a ${actual.label.toLowerCase()}`} account. `
          + `We've switched to ${actual.label} sign in; select Sign in again to continue.`);
        return;
      }
      throw err;
    }
    const next = safeNext(location.search);
    const allowed = next && next.startsWith(HOME_BY_ROLE[user.role]);
    const publicNext = next && !["/patient", "/doctor", "/admin"].some((p) => next.startsWith(p));
    navigate(allowed || publicNext ? next : HOME_BY_ROLE[user.role], { replace: true });
  });

  return (
    <div className="auth-page">
      <AuthAside title={cfg.asideTitle} points={cfg.points} />
      <div className="auth-main">
        <div className="auth-card stack-lg">
          <RoleSelector value={role} onChange={selectRole} />
          <div>
            <h1>{cfg.title}</h1>
            <p className="muted mt-2">{cfg.description}</p>
          </div>
          {expired && !form.formError && <Alert type="warning">Your session has expired. Please sign in again.</Alert>}
          {form.formError && <Alert type="danger">{form.formError}</Alert>}
          <form className="stack" onSubmit={onSubmit} noValidate>
            <TextField label="Email" type="email" autoComplete="email" required {...form.field("email")} />
            <PasswordField label="Password" autoComplete="current-password" required {...form.field("password")} />
            <SubmitButton loading={form.submitting} className="btn btn-primary btn-lg btn-block">Sign in</SubmitButton>
          </form>
          <div className="small muted stack-sm">
            {role === "PATIENT" && (
              <>
                <span>New patient? <Link to="/register">Create an account</Link></span>
                <span>Forgot your password? Contact the clinic to have it reset.</span>
              </>
            )}
            {role === "DOCTOR" && (
              <>
                <span>New to MediCare? <Link to="/register/doctor">Apply to join as a doctor</Link></span>
                <span>Applications are reviewed by an administrator before your profile is listed.</span>
              </>
            )}
            {role === "ADMIN" && (
              <span>Administrator accounts are created by the platform owner. There is no public sign-up.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
