import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RotateCcw, Search, UserRound } from "lucide-react";
import { doctorApi, specializationApi } from "../../services";
import { useApi, useDebounce } from "../../hooks/useApi";
import DoctorCard, { DoctorCardSkeleton } from "../../components/DoctorCard";
import Pagination from "../../components/Pagination";
import { EmptyState, ErrorState, SelectField, TextField } from "../../components/ui";
import { todayISO } from "../../utils/format";

const FILTER_KEYS = ["search", "specialization", "hospital", "location", "min_fee", "max_fee", "available_on", "ordering"];
const PAGE_SIZE = 9;

export default function Doctors() {
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ""])));
  const page = Number(params.get("page") || 1);
  const specialties = useApi(() => specializationApi.list(), []);

  // Text inputs are debounced before they reach the URL / API.
  const debounced = useDebounce(form, 400);
  useEffect(() => {
    const next = new URLSearchParams();
    FILTER_KEYS.forEach((k) => debounced[k] && next.set(k, debounced[k]));
    // Changing any filter resets pagination to page 1.
    const changed = FILTER_KEYS.some((k) => (params.get(k) || "") !== (debounced[k] || ""));
    if (changed) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const query = params.toString();
  const doctors = useApi(
    () => doctorApi.list({ ...Object.fromEntries(params), page_size: PAGE_SIZE }),
    [query]
  );

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const clear = () => setForm(Object.fromEntries(FILTER_KEYS.map((k) => [k, ""])));
  const setPage = (p) => {
    const next = new URLSearchParams(params);
    next.set("page", p);
    setParams(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const activeFilters = FILTER_KEYS.filter((k) => k !== "ordering" && form[k]).length;

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <h1>Find a doctor</h1>
          <p>Search approved doctors by name, specialty, hospital, city, fee and availability.</p>
        </div>
      </section>
      <div className="container" style={{ paddingTop: 32 }}>
        <div className="directory">
          <aside className="card filters-panel" aria-label="Filters">
            <form className="stack" onSubmit={(e) => e.preventDefault()}>
              <div className="row between">
                <h2 style={{ fontSize: "var(--text-md)" }}>Filters</h2>
                {activeFilters > 0 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
                    <RotateCcw size={14} /> Clear ({activeFilters})
                  </button>
                )}
              </div>
              <div className="field">
                <label className="label" htmlFor="f-search">Search</label>
                <div className="input-icon">
                  <Search size={16} />
                  <input id="f-search" className="input" placeholder="Name, specialty, hospital…"
                         value={form.search} onChange={update("search")} />
                </div>
              </div>
              <SelectField label="Specialization" value={form.specialization} onChange={update("specialization")}>
                <option value="">All specializations</option>
                {specialties.data?.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}
              </SelectField>
              <TextField label="Hospital / clinic" value={form.hospital} onChange={update("hospital")} placeholder="e.g. CityCare" />
              <TextField label="Location" value={form.location} onChange={update("location")} placeholder="City" />
              <div className="row" style={{ alignItems: "flex-start" }}>
                <TextField label="Min fee" type="number" min="0" value={form.min_fee} onChange={update("min_fee")} />
                <TextField label="Max fee" type="number" min="0" value={form.max_fee} onChange={update("max_fee")} />
              </div>
              <TextField label="Available on" type="date" min={todayISO()} value={form.available_on}
                         onChange={update("available_on")} hint="Doctors working on this date" />
            </form>
          </aside>

          <section aria-live="polite">
            <div className="row between" style={{ marginBottom: 16, flexWrap: "wrap" }}>
              <p className="muted small">
                {doctors.data ? `${doctors.data.count} doctor${doctors.data.count === 1 ? "" : "s"} found` : "Searching…"}
              </p>
              <div className="row">
                <label htmlFor="sort" className="small muted">Sort by</label>
                <select id="sort" className="select" style={{ width: 200, height: 36 }} value={form.ordering}
                        onChange={update("ordering")}>
                  <option value="">Name (A–Z)</option>
                  <option value="consultation_fee">Fee: low to high</option>
                  <option value="-consultation_fee">Fee: high to low</option>
                  <option value="-experience_years">Most experienced</option>
                </select>
              </div>
            </div>
            {doctors.error ? (
              <div className="card"><ErrorState message={doctors.error} onRetry={doctors.reload} /></div>
            ) : doctors.loading ? (
              <div className="grid grid-2">{Array.from({ length: 4 }).map((_, i) => <DoctorCardSkeleton key={i} />)}</div>
            ) : doctors.data.results.length === 0 ? (
              <div className="card">
                <EmptyState icon={UserRound} title="No doctors match these filters"
                            description="Try removing a filter or searching for a different specialty or city."
                            action={<button className="btn btn-secondary btn-sm" onClick={clear}>Clear filters</button>} />
              </div>
            ) : (
              <>
                <div className="grid grid-2">
                  {doctors.data.results.map((d) => <DoctorCard key={d.id} doctor={d} />)}
                </div>
                <div className="card mt-6">
                  <Pagination page={page} pageSize={PAGE_SIZE} count={doctors.data.count} onChange={setPage} />
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
