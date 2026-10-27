import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarX, Search } from "lucide-react";
import { useApi, useDebounce } from "../hooks/useApi";
import { specializationApi } from "../services";
import Pagination from "./Pagination";
import { Avatar, EmptyState, ErrorState, SkeletonRows, StatusBadge } from "./ui";
import { formatDate, formatTimeRange } from "../utils/format";

// eslint-disable-next-line react-refresh/only-export-components
export const APPOINTMENT_TABS = [
  { key: "upcoming", label: "Upcoming", params: { scope: "upcoming" } },
  { key: "pending", label: "Pending", params: { status: "PENDING" } },
  { key: "confirmed", label: "Confirmed", params: { status: "CONFIRMED" } },
  { key: "completed", label: "Completed", params: { status: "COMPLETED" } },
  { key: "cancelled", label: "Cancelled", params: { status: "CANCELLED" } },
  { key: "all", label: "All", params: {} },
];

/**
 * Filterable, paginated appointment list shared by patient, doctor and admin pages.
 * `fetcher(params)` is the role-appropriate API call; the backend scopes results.
 */
export default function AppointmentTable({
  fetcher, basePath, showPatient = false, showDoctor = true, withSearch = false,
  withSpecialization = false, tabs = APPOINTMENT_TABS, defaultTab = "upcoming", emptyAction,
}) {
  const [tab, setTab] = useState(defaultTab);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: "", date_from: "", date_to: "", specialization: "" });
  const debounced = useDebounce(filters, 350);
  const specialties = useApi(() => specializationApi.list(), [], { enabled: withSpecialization });

  const tabParams = tabs.find((t) => t.key === tab)?.params || {};
  const params = { ...tabParams, page };
  Object.entries(debounced).forEach(([k, v]) => v && (params[k] = v));
  const key = JSON.stringify(params);
  const { data, loading, error, reload } = useApi(() => fetcher(params), [key]);

  const setFilter = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1); };

  return (
    <div className="card">
      <div className="tabs" role="tablist" style={{ padding: "0 16px" }}>
        {tabs.map((t) => (
          <button key={t.key} role="tab" className="tab" aria-selected={tab === t.key}
                  onClick={() => { setTab(t.key); setPage(1); }}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="toolbar">
        {withSearch && (
          <div className="field grow">
            <label className="label" htmlFor="appt-search">Search</label>
            <div className="input-icon">
              <Search size={16} />
              <input id="appt-search" className="input" placeholder="Patient, doctor or appointment ID"
                     value={filters.search} onChange={setFilter("search")} />
            </div>
          </div>
        )}
        {withSpecialization && (
          <div className="field">
            <label className="label" htmlFor="appt-spec">Specialization</label>
            <select id="appt-spec" className="select" value={filters.specialization} onChange={setFilter("specialization")}>
              <option value="">All</option>
              {specialties.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label className="label" htmlFor="appt-from">From</label>
          <input id="appt-from" type="date" className="input" value={filters.date_from} onChange={setFilter("date_from")} />
        </div>
        <div className="field">
          <label className="label" htmlFor="appt-to">To</label>
          <input id="appt-to" type="date" className="input" value={filters.date_to} onChange={setFilter("date_to")} />
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <SkeletonRows rows={5} />
      ) : data.results.length === 0 ? (
        <EmptyState icon={CalendarX} title="No appointments found"
                    description="Nothing matches this view. Try another tab or clear the date filters." action={emptyAction} />
      ) : (
        <>
          <div className="table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Date &amp; time</th>
                  {showPatient && <th scope="col">Patient</th>}
                  {showDoctor && <th scope="col">Doctor</th>}
                  <th scope="col">Reason</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap">
                      <div className="cell-main">{formatDate(a.date)}</div>
                      <div className="cell-sub">{formatTimeRange(a.start_time, a.end_time)}</div>
                    </td>
                    {showPatient && (
                      <td>
                        <div className="row">
                          <Avatar name={a.patient.full_name} size={32} />
                          <div>
                            <div className="cell-main">{a.patient.full_name}</div>
                            <div className="cell-sub">{a.patient.age} yrs · {a.patient.phone}</div>
                          </div>
                        </div>
                      </td>
                    )}
                    {showDoctor && (
                      <td>
                        <div className="cell-main">Dr. {a.doctor.full_name}</div>
                        <div className="cell-sub">{a.doctor.specialization.name}</div>
                      </td>
                    )}
                    <td style={{ maxWidth: 260 }}>
                      <div className="cell-sub" style={{ color: "var(--gray-700)", fontSize: "var(--text-sm)" }}>
                        {a.reason.length > 70 ? `${a.reason.slice(0, 70)}…` : a.reason}
                      </div>
                      <div className="cell-sub">{a.reference}</div>
                    </td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className="text-right">
                      <Link to={`${basePath}/${a.id}`} className="btn btn-secondary btn-sm">View</Link>
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
  );
}

/** Compact list used on dashboards. */
export function AppointmentMiniList({ items, basePath, showPatient }) {
  return (
    <ul className="list">
      {items.map((a) => {
        const d = new Date(`${a.date}T00:00:00`);
        return (
          <li key={a.id} className="list-item">
            <div className="date-chip" aria-hidden="true">
              <div className="m">{d.toLocaleDateString("en-IN", { month: "short" })}</div>
              <div className="d">{d.getDate()}</div>
            </div>
            <div className="grow">
              <Link to={`${basePath}/${a.id}`} className="strong" style={{ color: "var(--gray-900)" }}>
                {showPatient ? a.patient.full_name : `Dr. ${a.doctor.full_name}`}
              </Link>
              <div className="small muted">
                {formatDate(a.date, { weekday: "short", day: "numeric", month: "short" })} · {formatTimeRange(a.start_time, a.end_time)}
                {!showPatient && ` · ${a.doctor.specialization.name}`}
              </div>
            </div>
            <StatusBadge status={a.status} />
          </li>
        );
      })}
    </ul>
  );
}
