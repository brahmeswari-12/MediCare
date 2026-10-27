import { useState } from "react";
import { Eye, Pencil, Plus, Search, Users } from "lucide-react";
import { adminApi } from "../../services";
import { useApi, useDebounce } from "../../hooks/useApi";
import { useForm } from "../../hooks/useForm";
import { useToast } from "../../context/ToastContext";
import { ConfirmDialog, Modal } from "../../components/Modal";
import Pagination from "../../components/Pagination";
import { Alert, Avatar, EmptyState, ErrorState, PageHeader, SkeletonRows, Spinner } from "../../components/ui";
import { PatientFields, validatePatient } from "../public/Register";
import { formatDate, formatDateTime, genderLabel } from "../../utils/format";

function PatientFormDialog({ patient, onClose, onSaved }) {
  const isNew = !patient;
  const form = useForm(
    isNew ? { full_name: "", email: "", phone: "", password: "", confirm_password: "", date_of_birth: "", gender: "", address: "" }
      : { ...patient },
    (v) => {
      const errors = validatePatient(v);
      if (!isNew) { delete errors.password; delete errors.confirm_password; delete errors.email; }
      return errors;
    }
  );
  const onSubmit = form.handleSubmit(async (v) => {
    if (isNew) onSaved(await adminApi.createPatient(v));
    else {
      const fields = ["full_name", "phone", "date_of_birth", "gender", "address", "blood_group"];
      onSaved(await adminApi.updatePatient(patient.id, Object.fromEntries(fields.map((f) => [f, v[f] ?? ""]))));
    }
  });
  return (
    <Modal open onClose={onClose} size="modal-lg" title={isNew ? "Add patient" : `Edit ${patient.full_name}`}
           footer={
             <>
               <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
               <button className="btn btn-primary" onClick={onSubmit} disabled={form.submitting}>
                 {form.submitting && <Spinner size={16} />} {isNew ? "Create patient" : "Save changes"}
               </button>
             </>
           }>
      <form className="stack" onSubmit={onSubmit} noValidate>
        {form.formError && <Alert type="danger">{form.formError}</Alert>}
        {!isNew && <Alert type="info">Email: {patient.email} (cannot be changed here)</Alert>}
        <PatientFields form={isNew ? form : { ...form, field: (n) => (n === "email" ? { value: patient.email, disabled: true, onChange: () => {} } : form.field(n)) }}
                       withPassword={isNew} />
      </form>
    </Modal>
  );
}

function PatientViewDialog({ patient, onClose }) {
  return (
    <Modal open onClose={onClose} title={patient.full_name} description={patient.email}>
      <dl className="kv">
        <dt>Phone</dt><dd>{patient.phone}</dd>
        <dt>Date of birth</dt><dd>{formatDate(patient.date_of_birth)} ({patient.age} years)</dd>
        <dt>Gender</dt><dd>{genderLabel(patient.gender)}</dd>
        <dt>Blood group</dt><dd>{patient.blood_group || "—"}</dd>
        <dt>Address</dt><dd>{patient.address}</dd>
        <dt>Emergency contact</dt><dd>{patient.emergency_contact_name ? `${patient.emergency_contact_name} · ${patient.emergency_contact_phone}` : "—"}</dd>
        <dt>Appointments</dt><dd>{patient.appointment_count}</dd>
        <dt>Registered</dt><dd>{formatDateTime(patient.date_joined)}</dd>
        <dt>Account</dt><dd>{patient.is_active ? "Active" : "Disabled"}</dd>
      </dl>
    </Modal>
  );
}

export default function AdminPatients() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null); // {type, patient}
  const q = useDebounce(search);
  const params = { search: q, page, ...(status ? { user__is_active: status } : {}) };
  const { data, setData, loading, error, reload } = useApi(() => adminApi.patients(params), [JSON.stringify(params)]);
  const replace = (p) => setData({ ...data, results: data.results.map((x) => (x.id === p.id ? p : x)) });

  return (
    <>
      <PageHeader title="Patients" description="Search, view and manage patient accounts. Accounts are disabled, never deleted, to keep history."
                  actions={<button className="btn btn-primary" onClick={() => setDialog({ type: "edit", patient: null })}><Plus size={16} /> Add patient</button>} />
      <div className="card">
        <div className="toolbar">
          <div className="field grow">
            <label className="label" htmlFor="p-search">Search</label>
            <div className="input-icon"><Search size={16} />
              <input id="p-search" className="input" placeholder="Name, email or phone" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="p-status">Account</label>
            <select id="p-status" className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All</option><option value="true">Active</option><option value="false">Disabled</option>
            </select>
          </div>
        </div>
        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <SkeletonRows rows={5} /> :
          data.results.length === 0 ? <EmptyState icon={Users} title="No patients found" /> : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Patient</th><th scope="col">Contact</th><th scope="col">Age / gender</th>
                      <th scope="col">Appointments</th><th scope="col">Account</th><th scope="col"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((p) => (
                      <tr key={p.id}>
                        <td><div className="row"><Avatar name={p.full_name} size={32} />
                          <div><div className="cell-main">{p.full_name}</div><div className="cell-sub">Joined {formatDate(p.date_joined)}</div></div></div></td>
                        <td>{p.email}<div className="cell-sub">{p.phone}</div></td>
                        <td>{p.age} · {genderLabel(p.gender)}</td>
                        <td>{p.appointment_count}</td>
                        <td>{p.is_active ? <span className="badge badge-completed">Active</span> : <span className="badge badge-neutral">Disabled</span>}</td>
                        <td>
                          <div className="row" style={{ justifyContent: "flex-end" }}>
                            <button className="btn btn-ghost btn-icon" onClick={() => setDialog({ type: "view", patient: p })} aria-label={`View ${p.full_name}`}><Eye size={16} /></button>
                            <button className="btn btn-ghost btn-icon" onClick={() => setDialog({ type: "edit", patient: p })} aria-label={`Edit ${p.full_name}`}><Pencil size={16} /></button>
                            <button className={`btn btn-sm ${p.is_active ? "btn-danger-outline" : "btn-secondary"}`} onClick={() => setDialog({ type: "toggle", patient: p })}>
                              {p.is_active ? "Disable" : "Enable"}
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
      {dialog?.type === "view" && <PatientViewDialog patient={dialog.patient} onClose={() => setDialog(null)} />}
      {dialog?.type === "edit" && (
        <PatientFormDialog patient={dialog.patient} onClose={() => setDialog(null)}
                           onSaved={() => { setDialog(null); reload(); toast.success("Patient saved."); }} />
      )}
      <ConfirmDialog open={dialog?.type === "toggle"} onClose={() => setDialog(null)}
                     tone={dialog?.patient?.is_active ? "danger" : "primary"}
                     confirmLabel={dialog?.patient?.is_active ? "Disable account" : "Enable account"}
                     title={dialog?.patient?.is_active ? "Disable this patient?" : "Enable this patient?"}
                     description={dialog?.patient?.is_active ? "The patient will not be able to sign in. Their appointment history is kept." : "The patient will be able to sign in again."}
                     onConfirm={async () => {
                       replace(await adminApi.setPatientActive(dialog.patient.id, !dialog.patient.is_active));
                       toast.success("Account updated.");
                     }} />
    </>
  );
}
