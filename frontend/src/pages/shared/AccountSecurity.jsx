import { Lock } from "lucide-react";
import { authApi } from "../../services";
import { tokenStore } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useForm, validators } from "../../hooks/useForm";
import { Alert, PageHeader, SubmitButton, TextField } from "../../components/ui";

export function ChangePasswordForm() {
  const toast = useToast();
  const form = useForm({ current_password: "", new_password: "", confirm_password: "" }, (v) => ({
    current_password: validators.required(v.current_password, "Current password"),
    new_password: validators.password(v.new_password),
    confirm_password: v.new_password !== v.confirm_password ? "Passwords do not match." : undefined,
  }));

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await authApi.changePassword(values);
    tokenStore.set(result); // other sessions are signed out; this one gets fresh tokens
    form.setValues({ current_password: "", new_password: "", confirm_password: "" });
    toast.success("Password updated. Other devices have been signed out.");
  });

  return (
    <section className="card">
      <div className="card-header">
        <h2><Lock size={16} style={{ verticalAlign: -2, marginRight: 6 }} />Change password</h2>
      </div>
      <form className="card-body stack" onSubmit={onSubmit} noValidate>
        {form.formError && <Alert type="danger">{form.formError}</Alert>}
        <TextField label="Current password" type="password" autoComplete="current-password" required {...form.field("current_password")} />
        <div className="form-grid">
          <TextField label="New password" type="password" autoComplete="new-password" required
                     hint="At least 8 characters, not only numbers." {...form.field("new_password")} />
          <TextField label="Confirm new password" type="password" autoComplete="new-password" required {...form.field("confirm_password")} />
        </div>
        <div className="form-actions"><SubmitButton loading={form.submitting}>Update password</SubmitButton></div>
      </form>
    </section>
  );
}

export default function AccountSecurity() {
  const { user } = useAuth();
  return (
    <div className="stack-lg" style={{ maxWidth: 720 }}>
      <PageHeader title="Account security" description={`Signed in as ${user.email}`} />
      <ChangePasswordForm />
    </div>
  );
}
