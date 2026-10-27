import { useEffect, useState } from "react";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { doctorApi, scheduleApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import { useForm } from "../../hooks/useForm";
import { useToast } from "../../context/ToastContext";
import { ConfirmDialog, Modal } from "../../components/Modal";
import { Alert, ErrorState, PageHeader, SkeletonRows, Spinner, SelectField, TextField } from "../../components/ui";
import { formatTimeRange, WEEKDAYS } from "../../utils/format";

const EMPTY = {
  weekday: "0", start_time: "09:00", end_time: "13:00", slot_duration: "30",
  break_start: "", break_end: "", max_appointments: "", is_active: true,
};

function validate(v) {
  const errors = {};
  if (!v.start_time) errors.start_time = "Required.";
  if (!v.end_time) errors.end_time = "Required.";
  if (v.start_time && v.end_time && v.end_time <= v.start_time) errors.end_time = "End time must be after start time.";
  if (Boolean(v.break_start) !== Boolean(v.break_end)) errors.break_end = "Provide both break times or neither.";
  if (v.break_start && v.break_end) {
    if (v.break_end <= v.break_start) errors.break_end = "Break end must be after break start.";
    else if (v.break_start <= v.start_time || v.break_end >= v.end_time) errors.break_start = "Break must be inside working hours.";
  }
  if (!v.slot_duration || Number(v.slot_duration) < 5) errors.slot_duration = "At least 5 minutes.";
  return errors;
}

function ScheduleDialog({ initial, onClose, onSaved }) {
  const form = useForm(initial ? { ...EMPTY, ...initial, weekday: String(initial.weekday) } : EMPTY, validate);
  const onSubmit = form.handleSubmit(async (v) => {
    const payload = {
      weekday: Number(v.weekday), start_time: v.start_time, end_time: v.end_time,
      slot_duration: Number(v.slot_duration), break_start: v.break_start || null, break_end: v.break_end || null,
      max_appointments: v.max_appointments === "" || v.max_appointments === null ? null : Number(v.max_appointments),
      is_active: v.is_active,
    };
    const saved = initial ? await scheduleApi.update(initial.id, payload) : await scheduleApi.create(payload);
    onSaved(saved);
  });

  return (
    <Modal open onClose={onClose} title={initial ? "Edit working hours" : "Add working hours"}
           description="Each interval generates bookable slots of the chosen length. Add a second interval for split shifts."
           footer={
             <>
               <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
               <button className="btn btn-primary" onClick={onSubmit} disabled={form.submitting}>
                 {form.submitting && <Spinner size={16} />} Save
               </button>
             </>
           }>
      <form className="stack" onSubmit={onSubmit} noValidate>
        {form.formError && <Alert type="danger">{form.formError}</Alert>}
        <div className="form-grid">
          <SelectField className="span-2" label="Day of week" required {...form.field("weekday")}>
            {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </SelectField>
          <TextField label="Start time" type="time" required {...form.field("start_time")} />
          <TextField label="End time" type="time" required {...form.field("end_time")} />
          <TextField label="Break start" type="time" hint="Optional" {...form.field("break_start")} />
          <TextField label="Break end" type="time" {...form.field("break_end")} />
          <SelectField label="Appointment duration" required {...form.field("slot_duration")}>
            {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </SelectField>
          <TextField label="Max appointments (this interval)" type="number" min="1" hint="Leave empty for no limit"
                     {...form.field("max_appointments")} />
          <label className="checkbox span-2">
            <input type="checkbox" {...form.field("is_active", { type: "checkbox" })} /> Active (accepting bookings)
          </label>
        </div>
      </form>
    </Modal>
  );
}

function DailyCap() {
  const toast = useToast();
  const me = useApi(() => doctorApi.me(), []);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (me.data) setValue(me.data.max_appointments_per_day ?? "");
  }, [me.data]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await doctorApi.updateMe({ max_appointments_per_day: value === "" ? null : Number(value) });
      toast.success("Daily limit saved.");
    } catch {
      toast.error("Could not save the daily limit. Enter a positive whole number or leave it empty.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card card-body row-wrap" onSubmit={save} style={{ alignItems: "flex-end" }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <TextField label="Maximum appointments per day" type="number" min="1" value={value}
                   onChange={(e) => setValue(e.target.value)} disabled={me.loading}
                   hint="Applies across all intervals on a day. Leave empty for no daily limit." />
      </div>
      <button className="btn btn-secondary" type="submit" disabled={saving || me.loading}>
        {saving && <Spinner size={16} />} Save limit
      </button>
    </form>
  );
}

export default function DoctorSchedule() {
  const toast = useToast();
  const { data, setData, loading, error, reload } = useApi(() => scheduleApi.list(), []);
  const [editing, setEditing] = useState(null); // null | "new" | schedule
  const [deleting, setDeleting] = useState(null);

  const byDay = WEEKDAYS.map((name, i) => ({ name, i, items: (data || []).filter((s) => s.weekday === i) }));

  function handleSaved(saved) {
    const exists = data.some((s) => s.id === saved.id);
    const next = exists ? data.map((s) => (s.id === saved.id ? saved : s)) : [...data, saved];
    setData(next.sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)));
    setEditing(null);
    toast.success("Working hours saved.");
  }

  return (
    <div className="stack-lg">
      <PageHeader title="Weekly schedule" description="Set the hours patients can book. Existing bookings are not affected by changes."
                  actions={<button className="btn btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> Add working hours</button>} />
      <DailyCap />
      <section className="card">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <SkeletonRows rows={7} height={44} /> : (
          <ul className="list">
            {byDay.map((day) => (
              <li key={day.name} className="list-item" style={{ alignItems: "flex-start" }}>
                <div style={{ width: 120 }} className="strong">{day.name}</div>
                <div className="grow stack-sm">
                  {day.items.length === 0 ? <span className="muted small">Not working</span> : day.items.map((s) => (
                    <div key={s.id} className="row-wrap" style={{ justifyContent: "space-between" }}>
                      <div className="row-wrap">
                        <span className="badge badge-confirmed no-dot"><CalendarClock size={12} /> {formatTimeRange(s.start_time, s.end_time)}</span>
                        <span className="small muted">
                          {s.slot_duration} min slots
                          {s.break_start && ` · break ${formatTimeRange(s.break_start, s.break_end)}`}
                          {s.max_appointments && ` · max ${s.max_appointments}`}
                        </span>
                        {!s.is_active && <span className="badge badge-neutral">Inactive</span>}
                      </div>
                      <div className="row">
                        <button className="btn btn-ghost btn-icon" onClick={() => setEditing(s)} aria-label={`Edit ${day.name} ${s.start_time}`}><Pencil size={16} /></button>
                        <button className="btn btn-ghost btn-icon" onClick={() => setDeleting(s)} aria-label={`Delete ${day.name} ${s.start_time}`}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {editing && <ScheduleDialog initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} tone="danger" confirmLabel="Delete"
                     title="Delete these working hours?"
                     description="Patients will no longer be able to book these slots. Existing appointments are kept."
                     onConfirm={async () => {
                       await scheduleApi.remove(deleting.id);
                       setData(data.filter((s) => s.id !== deleting.id));
                       toast.success("Working hours removed.");
                     }} />
    </div>
  );
}
