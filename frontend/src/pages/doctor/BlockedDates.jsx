import { useState } from "react";
import { Ban, Trash2 } from "lucide-react";
import { scheduleApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import { useForm } from "../../hooks/useForm";
import { useToast } from "../../context/ToastContext";
import { ConfirmDialog } from "../../components/Modal";
import { Alert, EmptyState, ErrorState, PageHeader, SkeletonRows, SubmitButton, TextField } from "../../components/ui";
import { formatLongDate, todayISO } from "../../utils/format";

export default function BlockedDates() {
  const toast = useToast();
  const { data, setData, loading, error, reload } = useApi(() => scheduleApi.blockedDates(), []);
  const [removing, setRemoving] = useState(null);
  const form = useForm({ date: "", reason: "" }, (v) => ({
    date: !v.date ? "Choose a date." : v.date < todayISO() ? "Choose today or a future date." : undefined,
  }));

  const onSubmit = form.handleSubmit(async (v) => {
    const created = await scheduleApi.blockDate(v);
    setData([...(data || []), created].sort((a, b) => a.date.localeCompare(b.date)));
    form.setValues({ date: "", reason: "" });
    toast.success("Date blocked.");
  });

  return (
    <div className="stack-lg">
      <PageHeader title="Blocked dates" description="Mark days off (leave, conferences, holidays). No slots are offered on these dates." />
      <div className="grid layout-aside">
        <section className="card">
          <div className="card-header"><h2>Upcoming blocked dates</h2></div>
          {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <SkeletonRows rows={3} /> :
            data.length === 0 ? <EmptyState icon={Ban} title="No blocked dates" description="You are available on all your scheduled days." /> : (
              <ul className="list">
                {data.map((b) => (
                  <li key={b.id} className="list-item">
                    <span className="stat-icon danger" style={{ width: 36, height: 36 }}><Ban size={16} /></span>
                    <div className="grow">
                      <div className="strong">{formatLongDate(b.date)}</div>
                      <div className="small muted">{b.reason || "No reason given"}</div>
                    </div>
                    <button className="btn btn-ghost btn-icon" onClick={() => setRemoving(b)} aria-label={`Unblock ${b.date}`}>
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </section>
        <section className="card">
          <div className="card-header"><h2>Block a date</h2></div>
          <form className="card-body stack" onSubmit={onSubmit} noValidate>
            {form.formError && <Alert type="danger">{form.formError}</Alert>}
            <TextField label="Date" type="date" min={todayISO()} required {...form.field("date")} />
            <TextField label="Reason" placeholder="e.g. Medical conference" hint="Visible to you and administrators only." {...form.field("reason")} />
            <p className="xs muted">Dates with active appointments cannot be blocked. Cancel or reschedule those first.</p>
            <SubmitButton loading={form.submitting}>Block date</SubmitButton>
          </form>
        </section>
      </div>
      <ConfirmDialog open={Boolean(removing)} onClose={() => setRemoving(null)} confirmLabel="Unblock"
                     title="Make this date available again?"
                     description={removing ? `${formatLongDate(removing.date)} will be bookable according to your weekly schedule.` : ""}
                     onConfirm={async () => {
                       await scheduleApi.unblockDate(removing.id);
                       setData(data.filter((b) => b.id !== removing.id));
                       toast.success("Date unblocked.");
                     }} />
    </div>
  );
}
