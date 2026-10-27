import { useState } from "react";
import { CalendarClock, Pencil, Plus, Search, Stethoscope } from "lucide-react";
import { adminApi, doctorApi, specializationApi } from "../../services";
import { useApi, useDebounce } from "../../hooks/useApi";
import { useToast } from "../../context/ToastContext";
import { ConfirmDialog, Modal } from "../../components/Modal";
import Pagination from "../../components/Pagination";
import { Avatar, EmptyState, ErrorState, PageHeader, SkeletonRows, StatusBadge } from "../../components/ui";
import { formatDate, formatMoney, formatTimeRange, WEEKDAYS } from "../../utils/format";
import { DoctorFormDialog } from "./DoctorDialogs";

export function DoctorScheduleDialog({ doctor, onClose }) {
  const { data, loading, error } = useApi(() => doctorApi.schedule(doctor.id), [doctor.id]);
  return (
    <Modal open onClose={onClose} title={`Schedule · Dr. ${doctor.full_name}`}>
      {loading ? <SkeletonRows rows={4} height={24} /> : error ? <p className="small muted">{error}</p> : (
        <div className="stack">
          {data.schedules.length === 0 ? <p className="small muted">No working hours configured.</p> : (
            <dl>
              {WEEKDAYS.map((day, i) => {
                const items = data.schedules.filter((s) => s.weekday === i);
                return (
                  <div key={day} className="summary-row">
                    <dt>{day}</dt>
                    <dd>{items.length ? items.map((s) => (
                      <div key={s.id}>
                        {formatTimeRange(s.start_time, s.end_time)} · {s.slot_duration}m{!s.is_active && " (inactive)"}
                      </div>
                    )) : <span className="muted" style={{ fontWeight: 400 }}>Off</span>}</dd>
                  </div>
                );
              })}
            </dl>
          )}
          {data.max_appointments_per_day && <p className="small">Daily limit: {data.max_appointments_per_day}</p>}
          {data.blocked_dates.length > 0 && (
            <p className="small">Blocked: {data.blocked_dates.map((b) => `${formatDate(b.date)}${b.reason ? ` (${b.reason})` : ""}`).join(", ")}</p>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function AdminDoctors() {
  const toast = useToast();
  const [filters, setFilters] = useState({ search: "", approval_status: "", specialization: "" });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // "new" | doctor
  const [viewingSchedule, setViewingSchedule] = useState(null);
  const [toggling, setToggling] = useState(null);
  const debounced = useDebounce(filters);
  const specialties = useApi(() => specializationApi.list(), []);
  const params = { ...Object.fromEntries(Object.entries(debounced).filter(([, v]) => v)), page };
  const { data, setData, loading, error, reload } = useApi(() => adminApi.doctors(params), [JSON.stringify(params)]);

  const set = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1); };
  const replace = (doc) => setData({ ...data, results: data.results.map((d) => (d.id === doc.id ? { ...d, ...doc } : d)) });

  return (
    <>
      <PageHeader title="Doctors" description="Create, edit, approve and enable or disable doctor accounts."
                  actions={<button className="btn btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> Add doctor</button>} />
      <div className="card">
        <div className="toolbar">
          <div className="field grow">
            <label className="label" htmlFor="doc-search">Search</label>
            <div className="input-icon"><Search size={16} />
              <input id="doc-search" className="input" placeholder="Name, email, registration, hospital" value={filters.search} onChange={set("search")} />
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="doc-status">Approval</label>
            <select id="doc-status" className="select" value={filters.approval_status} onChange={set("approval_status")}>
              <option value="">All</option><option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option><option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="doc-spec">Specialization</label>
            <select id="doc-spec" className="select" value={filters.specialization} onChange={set("specialization")}>
              <option value="">All</option>
              {specialties.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <SkeletonRows rows={5} /> :
          data.results.length === 0 ? <EmptyState icon={Stethoscope} title="No doctors found" /> : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Doctor</th><th scope="col">Specialization</th><th scope="col">Hospital</th>
                      <th scope="col">Fee</th><th scope="col">Approval</th><th scope="col">Account</th>
                      <th scope="col"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <div className="row">
                            <Avatar name={d.full_name} src={d.photo} size={32} />
                            <div><div className="cell-main">Dr. {d.full_name}</div><div className="cell-sub">{d.email}</div></div>
                          </div>
                        </td>
                        <td>{d.specialization?.name}<div className="cell-sub">{d.license_number}</div></td>
                        <td>{d.hospital}<div className="cell-sub">{d.location}</div></td>
                        <td>{formatMoney(d.consultation_fee)}</td>
                        <td><StatusBadge status={d.approval_status} /></td>
                        <td>{d.is_active ? <span className="badge badge-completed">Active</span> : <span className="badge badge-neutral">Disabled</span>}</td>
                        <td>
                          <div className="row" style={{ justifyContent: "flex-end" }}>
                            <button className="btn btn-ghost btn-icon" onClick={() => setViewingSchedule(d)} aria-label={`View schedule for Dr. ${d.full_name}`} title="Schedule"><CalendarClock size={16} /></button>
                            <button className="btn btn-ghost btn-icon" onClick={() => setEditing(d)} aria-label={`Edit Dr. ${d.full_name}`} title="Edit"><Pencil size={16} /></button>
                            {d.approval_status === "PENDING" && (
                              <button className="btn btn-secondary btn-sm" onClick={async () => {
                                try { replace(await adminApi.approveDoctor(d.id)); toast.success("Doctor approved."); }
                                catch { toast.error("Could not approve this doctor."); }
                              }}>Approve</button>
                            )}
                            <button className={`btn btn-sm ${d.is_active ? "btn-danger-outline" : "btn-secondary"}`} onClick={() => setToggling(d)}>
                              {d.is_active ? "Disable" : "Enable"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} count={data.count} onChange={setPage} />
            </>
          )}
      </div>
      {editing && (
        <DoctorFormDialog doctor={editing === "new" ? null : editing} onClose={() => setEditing(null)}
                          onSaved={() => { setEditing(null); reload(); toast.success("Doctor saved."); }} />
      )}
      {viewingSchedule && <DoctorScheduleDialog doctor={viewingSchedule} onClose={() => setViewingSchedule(null)} />}
      <ConfirmDialog open={Boolean(toggling)} onClose={() => setToggling(null)}
                     tone={toggling?.is_active ? "danger" : "primary"}
                     confirmLabel={toggling?.is_active ? "Disable account" : "Enable account"}
                     title={toggling?.is_active ? "Disable this doctor?" : "Enable this doctor?"}
                     description={toggling?.is_active
                       ? "The doctor will be unable to sign in and will be hidden from patients. Appointment history is preserved."
                       : "The doctor will be able to sign in again."}
                     onConfirm={async () => {
                       replace(await adminApi.setDoctorActive(toggling.id, !toggling.is_active));
                       toast.success(toggling.is_active ? "Doctor disabled." : "Doctor enabled.");
                     }} />
    </>
  );
}
