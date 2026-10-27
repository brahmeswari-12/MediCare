import { useState } from "react";
import { Boxes, Package, PackageX, Pencil, Plus, Search, Trash2, TriangleAlert } from "lucide-react";
import { inventoryApi } from "../../services";
import { useApi, useDebounce } from "../../hooks/useApi";
import { useForm, validators } from "../../hooks/useForm";
import { useToast } from "../../context/ToastContext";
import { ConfirmDialog, Modal } from "../../components/Modal";
import Pagination from "../../components/Pagination";
import { Alert, EmptyState, ErrorState, PageHeader, SkeletonRows, Spinner, StatCard, TextAreaField, TextField } from "../../components/ui";
import { formatDateTime } from "../../utils/format";

const EMPTY = { name: "", sku: "", category: "", quantity: "0", unit: "units", minimum_stock_level: "0", supplier: "", notes: "" };

function SupplyDialog({ item, onClose, onSaved }) {
  const form = useForm(item ? { ...item } : EMPTY, (v) => ({
    name: validators.required(v.name, "Name"),
    sku: validators.required(v.sku, "SKU"),
    quantity: v.quantity === "" || Number(v.quantity) < 0 ? "Enter 0 or more." : undefined,
    minimum_stock_level: v.minimum_stock_level === "" || Number(v.minimum_stock_level) < 0 ? "Enter 0 or more." : undefined,
  }));
  const onSubmit = form.handleSubmit(async (v) => {
    const payload = { ...v, quantity: Number(v.quantity), minimum_stock_level: Number(v.minimum_stock_level) };
    onSaved(item ? await inventoryApi.update(item.id, payload) : await inventoryApi.create(payload));
  });
  return (
    <Modal open onClose={onClose} size="modal-lg" title={item ? "Edit supply item" : "Add supply item"}
           footer={
             <>
               <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
               <button className="btn btn-primary" onClick={onSubmit} disabled={form.submitting}>{form.submitting && <Spinner size={16} />} Save</button>
             </>
           }>
      <form className="stack" onSubmit={onSubmit} noValidate>
        {form.formError && <Alert type="danger">{form.formError}</Alert>}
        <div className="form-grid">
          <TextField className="span-2" label="Item name" required {...form.field("name")} />
          <TextField label="SKU / identifier" required {...form.field("sku")} />
          <TextField label="Category" {...form.field("category")} />
          <TextField label="Quantity in stock" type="number" min="0" required {...form.field("quantity")} />
          <TextField label="Unit" {...form.field("unit")} />
          <TextField label="Minimum stock level" type="number" min="0" required hint="Low-stock alert at or below this" {...form.field("minimum_stock_level")} />
          <TextField label="Supplier" {...form.field("supplier")} />
          <TextAreaField className="span-2" label="Notes" rows={2} {...form.field("notes")} />
        </div>
      </form>
    </Modal>
  );
}

export default function AdminSupplies() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const q = useDebounce(search);
  const params = { search: q, page, ...(lowOnly ? { low_stock: "true" } : {}) };
  const list = useApi(() => inventoryApi.list(params), [JSON.stringify(params)]);
  const stats = useApi(() => inventoryApi.stats(), []);
  const refresh = () => { list.reload(); stats.reload(); };

  return (
    <>
      <PageHeader title="Hospital supplies" description="Track stock levels and get alerted when items run low."
                  actions={<button className="btn btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> Add item</button>} />
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <StatCard icon={Package} label="Items tracked" value={stats.data?.total_items} />
        <StatCard icon={Boxes} label="Total units" value={stats.data?.total_units} tone="teal" />
        <StatCard icon={TriangleAlert} label="Low stock" value={stats.data?.low_stock_items} tone="warning" />
        <StatCard icon={PackageX} label="Out of stock" value={stats.data?.out_of_stock_items} tone="danger" />
      </div>
      {stats.data?.low_stock_items > 0 && !lowOnly && (
        <div style={{ marginBottom: 16 }}>
          <Alert type="warning" title={`${stats.data.low_stock_items} item(s) at or below minimum stock`}>
            <button className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }} onClick={() => { setLowOnly(true); setPage(1); }}>Show low-stock items</button>
          </Alert>
        </div>
      )}
      <div className="card">
        <div className="toolbar" style={{ alignItems: "center" }}>
          <div className="field grow">
            <label className="label" htmlFor="s-search">Search</label>
            <div className="input-icon"><Search size={16} />
              <input id="s-search" className="input" placeholder="Name, SKU, supplier or category" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </div>
          <label className="checkbox" style={{ marginTop: 22 }}>
            <input type="checkbox" checked={lowOnly} onChange={(e) => { setLowOnly(e.target.checked); setPage(1); }} /> Low stock only
          </label>
        </div>
        {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.loading && !list.data ? <SkeletonRows rows={5} /> :
          list.data.results.length === 0 ? <EmptyState icon={Package} title="No supply items" /> : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Item</th><th scope="col">Category</th><th scope="col">In stock</th><th scope="col">Minimum</th>
                      <th scope="col">Supplier</th><th scope="col">Last updated</th><th scope="col"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.results.map((s) => (
                      <tr key={s.id}>
                        <td><div className="cell-main">{s.name}</div><div className="cell-sub">{s.sku}</div></td>
                        <td>{s.category || "—"}</td>
                        <td>
                          <span className="strong">{s.quantity}</span> <span className="muted small">{s.unit}</span>
                          {s.quantity === 0 ? <span className="badge badge-cancelled" style={{ marginLeft: 8 }}>Out</span>
                            : s.is_low_stock && <span className="badge badge-pending" style={{ marginLeft: 8 }}>Low</span>}
                        </td>
                        <td>{s.minimum_stock_level}</td>
                        <td>{s.supplier || "—"}</td>
                        <td className="small">{formatDateTime(s.updated_at)}</td>
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
              <Pagination page={page} count={list.data.count} onChange={setPage} />
            </>
          )}
      </div>
      {editing && <SupplyDialog item={editing === "new" ? null : editing} onClose={() => setEditing(null)}
                                onSaved={() => { setEditing(null); refresh(); toast.success("Item saved."); }} />}
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} tone="danger" confirmLabel="Delete"
                     title={`Delete ${deleting?.name}?`} description="This removes the item from inventory tracking."
                     onConfirm={async () => { await inventoryApi.remove(deleting.id); refresh(); toast.success("Item deleted."); }} />
    </>
  );
}
