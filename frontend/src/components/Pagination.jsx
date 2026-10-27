import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ page, pageSize = 10, count, onChange }) {
  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));
  if (!count) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);
  return (
    <nav className="pagination" aria-label="Pagination">
      <span>
        Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{count}</strong>
      </span>
      <div className="row">
        <button className="btn btn-secondary btn-sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft size={14} /> Previous
        </button>
        <span className="small">Page {page} of {totalPages}</span>
        <button className="btn btn-secondary btn-sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
          Next <ChevronRight size={14} />
        </button>
      </div>
    </nav>
  );
}
