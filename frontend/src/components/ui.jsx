/* Small presentational building blocks shared by every page. */
import { useId, useState } from "react";
import {
  CalendarX, CircleAlert, CircleCheckBig, Eye, EyeOff, Info, LoaderCircle, RotateCcw, TriangleAlert,
} from "lucide-react";
import { initials } from "../utils/format";

export function Spinner({ size = 18, label = "Loading" }) {
  return <LoaderCircle size={size} className="spin" aria-label={label} role="status" />;
}

export function PageLoader() {
  return (
    <div className="page-loader">
      <Spinner size={28} />
    </div>
  );
}

export function Skeleton({ height = 16, width = "100%", style }) {
  return <div className="skeleton" style={{ height, width, ...style }} aria-hidden="true" />;
}

export function SkeletonRows({ rows = 4, height = 56 }) {
  return (
    <div className="stack-sm" style={{ padding: 16 }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={height} />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = CalendarX, title, description, action }) {
  return (
    <div className="state">
      <div className="state-icon">
        <Icon size={22} aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state" role="alert">
      <div className="state-icon danger">
        <CircleAlert size={22} aria-hidden="true" />
      </div>
      <h3>Could not load this section</h3>
      <p>{message}</p>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry}>
          <RotateCcw size={14} /> Try again
        </button>
      )}
    </div>
  );
}

const ALERT_ICONS = { info: Info, success: CircleCheckBig, warning: TriangleAlert, danger: CircleAlert };

export function Alert({ type = "info", children, title }) {
  const Icon = ALERT_ICONS[type];
  return (
    <div className={`alert alert-${type}`} role={type === "danger" ? "alert" : "status"}>
      <Icon size={16} aria-hidden="true" />
      <div>
        {title && <strong style={{ display: "block" }}>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

const STATUS_CLASS = {
  PENDING: "badge-pending",
  CONFIRMED: "badge-confirmed",
  COMPLETED: "badge-completed",
  CANCELLED: "badge-cancelled",
  PAID: "badge-completed",
  REFUNDED: "badge-confirmed",
  VOID: "badge-neutral",
  FAILED: "badge-cancelled",
  APPROVED: "badge-completed",
  REJECTED: "badge-cancelled",
};
const STATUS_LABEL = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", VOID: "Void" };

export function StatusBadge({ status, label }) {
  const text = label || STATUS_LABEL[status] || (status ? status.charAt(0) + status.slice(1).toLowerCase() : "—");
  return <span className={`badge ${STATUS_CLASS[status] || "badge-neutral"}`}>{text}</span>;
}

export function Avatar({ name, src, size = 40 }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {src ? <img src={src} alt="" /> : <span aria-hidden="true">{initials(name)}</span>}
    </span>
  );
}

export function StatCard({ icon: Icon, label, value, tone = "", hint }) {
  return (
    <div className="card stat-card">
      <div className={`stat-icon ${tone}`}>
        <Icon size={20} aria-hidden="true" />
      </div>
      <div>
        <div className="stat-value">{value ?? "—"}</div>
        <div className="stat-label">{label}</div>
        {hint && <div className="xs muted mt-2">{hint}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="row-wrap">{actions}</div>}
    </div>
  );
}

/* ---------- Form fields: label + control + error, wired for accessibility ---------- */
function FieldShell({ id, label, required, error, hint, children, className = "" }) {
  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="label" htmlFor={id}>
          {label}
          {required && <span className="req" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <span className="field-hint" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="field-error" id={`${id}-error`}>{error}</span>}
    </div>
  );
}

function describedBy(id, error, hint) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function TextField({ label, error, hint, required, className, ...props }) {
  const autoId = useId();
  const id = props.id || autoId;
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint} className={className}>
      <input id={id} className="input" required={required} aria-invalid={Boolean(error)}
             aria-describedby={describedBy(id, error, hint)} {...props} />
    </FieldShell>
  );
}

/** Password input with an accessible show/hide toggle. */
export function PasswordField({ label, error, hint, required, className, ...props }) {
  const autoId = useId();
  const id = props.id || autoId;
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint} className={className}>
      <div className="password-input">
        <input id={id} className="input" required={required} aria-invalid={Boolean(error)}
               aria-describedby={describedBy(id, error, hint)} {...props} type={visible ? "text" : "password"} />
        <button type="button" className="password-toggle" onClick={() => setVisible((v) => !v)}
                aria-controls={id} aria-pressed={visible} aria-label={visible ? "Hide password" : "Show password"}
                title={visible ? "Hide password" : "Show password"}>
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </FieldShell>
  );
}

export function SelectField({ label, error, hint, required, className, children, ...props }) {
  const autoId = useId();
  const id = props.id || autoId;
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint} className={className}>
      <select id={id} className="select" required={required} aria-invalid={Boolean(error)}
              aria-describedby={describedBy(id, error, hint)} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({ label, error, hint, required, className, ...props }) {
  const autoId = useId();
  const id = props.id || autoId;
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint} className={className}>
      <textarea id={id} className="textarea" required={required} aria-invalid={Boolean(error)}
                aria-describedby={describedBy(id, error, hint)} {...props} />
    </FieldShell>
  );
}

export function SubmitButton({ loading, children, className = "btn btn-primary", ...props }) {
  return (
    <button type="submit" className={className} disabled={loading || props.disabled} {...props}>
      {loading && <Spinner size={16} label="Saving" />}
      {children}
    </button>
  );
}
