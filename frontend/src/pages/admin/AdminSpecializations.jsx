import { useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { specializationApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import { useForm, validators } from "../../hooks/useForm";
import { useToast } from "../../context/ToastContext";
import { ConfirmDialog, Modal } from "../../components/Modal";
import SpecialtyIcon, { ICON_KEYS } from "../../components/SpecialtyIcon";
import { Alert, EmptyState, ErrorState, PageHeader, SelectField, SkeletonRows, Spinner, TextAreaField, TextField } from "../../components/ui";

function SpecializationDialog({ item, onClose, onSaved }) {
  const form = useForm(item ? { ...item } : { name: "", description: "", icon: "stethoscope", is_active: true },
    (v) => ({ name: validators.required(v.name, "Name") }));
  const onSubmit = form.handleSubmit(async (v) => {
    const payload = { name: v.name.trim(), description: v.description, icon: v.icon, is_active: v.is_active };
    onSaved(item ? await specializationApi.update(item.id, payload) : await specializationApi.create(payload));
  });
  return (
    <Modal open onClose={onClose} title={item ? "Edit specialization" : "Add specialization"}
           footer={
             <>
               <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
               <button className="btn btn-primary" onClick={onSubmit} disabled={form.submitting}>{form.submitting && <Spinner size={16} />} Save</button>
             </>
           }>
      <form className="stack" onSubmit={onSubmit} noValidate>
        {form.formError && <Alert type="danger">{form.formError}</Alert>}
        <TextField label="Name" required {...form.field("name")} />
        <TextAreaField label="Description" rows={3} {...form.field("description")} />
        <div className="row" style={{ alignItems: "flex-end" }}>
          <SelectField label="Icon" className="w-full" {...form.field("icon")}>
            {ICON_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </SelectField>
          <span className="specialty-icon"><SpecialtyIcon name={form.values.icon} /></span>
        </div>
        <label className="checkbox"><input type="checkbox" {...form.field("is_active", { type: "checkbox" })} /> Active (shown to patients)</label>
      </form>
    </Modal>
  );
}

export default function AdminSpecializations() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => specializationApi.list(), []);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  return (
    <>
      <PageHeader title="Specializations" description="Categories patients use to find doctors."
                  actions={<button className="btn btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> Add specialization</button>} />
      <div className="card">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <SkeletonRows rows={6} /> :
          data.length === 0 ? <EmptyState icon={Tags} title="No specializations" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th scope="col">Name</th><th scope="col">Description</th><th scope="col">Approved doctors</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {data.map((s) => (
                    <tr key={s.id}>
                      <td><div className="row"><span className="specialty-icon" style={{ width: 34, height: 34 }}><SpecialtyIcon name={s.icon} size={17} /></span><span className="cell-main">{s.name}</span></div></td>
                      <td style={{ maxWidth: 380 }} className="small">{s.description || "—"}</td>
                      <td>{s.doctor_count}</td>
                      <td>{s.is_active ? <span className="badge badge-completed">Active</span> : <span className="badge badge-neutral">Hidden</span>}</td>
                      <td>
                        <div className="row" style={{ justifyContent: "flex-end" }}>
                          <button className="btn btn-ghost btn-icon" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}><Pencil size={16} /></button>
                          <button className="btn btn-ghost btn-icon" onClick={() => setDeleting(s)} aria-label={`Delete ${s.name}`}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
      {editing && (
        <SpecializationDialog item={editing === "new" ? null : editing} onClose={() => setEditing(null)}
                              onSaved={() => { setEditing(null); reload(); toast.success("Specialization saved."); }} />
      )}
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} tone="danger" confirmLabel="Delete"
                     title={`Delete ${deleting?.name}?`}
                     description="Specializations used by any doctor cannot be deleted; deactivate them instead."
                     onConfirm={async () => { await specializationApi.remove(deleting.id); reload(); toast.success("Specialization deleted."); }} />
    </>
  );
}
