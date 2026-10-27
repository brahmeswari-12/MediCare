import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { doctorApi } from "../services";
import { useApi } from "../hooks/useApi";
import { addDays, formatLongDate, formatTime, parseDate, toISODate, WEEKDAYS_SHORT } from "../utils/format";
import { Alert, EmptyState, ErrorState, Skeleton } from "./ui";

const WINDOW = 14;

/**
 * Two-step picker: a 14-day date strip (dates with free slots are enabled),
 * then the time slots for the chosen date. Every value shown comes from the
 * availability API; the backend re-validates the chosen slot when booking.
 */
export default function SlotPicker({ doctorId, date, startTime, onDateChange, onSlotChange, refreshKey = 0 }) {
  const [windowStart, setWindowStart] = useState(() => new Date(new Date().setHours(0, 0, 0, 0)));
  const today = new Date(new Date().setHours(0, 0, 0, 0));

  const dates = useApi(
    () => doctorApi.availableDates(doctorId, { start: toISODate(windowStart), days: WINDOW }),
    [doctorId, windowStart.getTime(), refreshKey]
  );
  const slots = useApi(() => doctorApi.availability(doctorId, date), [doctorId, date, refreshKey], {
    enabled: Boolean(date),
  });

  // Auto-select the first available date in the window if nothing is chosen.
  useEffect(() => {
    if (!date && dates.data) {
      const first = dates.data.find((d) => d.available);
      if (first) onDateChange(first.date);
    }
  }, [dates.data, date, onDateChange]);

  const canGoBack = windowStart > today;

  return (
    <div className="stack-lg">
      <div>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 className="small strong" style={{ fontSize: "var(--text-sm)" }}>Select a date</h3>
          <div className="row">
            <button type="button" className="btn btn-secondary btn-icon btn-sm" disabled={!canGoBack}
                    onClick={() => setWindowStart(addDays(windowStart, -WINDOW))} aria-label="Previous two weeks">
              <ChevronLeft size={16} />
            </button>
            <button type="button" className="btn btn-secondary btn-icon btn-sm"
                    onClick={() => setWindowStart(addDays(windowStart, WINDOW))} aria-label="Next two weeks">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        {dates.loading ? (
          <div className="date-strip">
            {Array.from({ length: WINDOW }).map((_, i) => <Skeleton key={i} height={74} />)}
          </div>
        ) : dates.error ? (
          <ErrorState message={dates.error} onRetry={dates.reload} />
        ) : (
          <>
            <div className="date-strip" role="group" aria-label="Available dates">
              {dates.data.map((d) => {
                const day = parseDate(d.date);
                const wd = (day.getDay() + 6) % 7;
                return (
                  <button
                    type="button" key={d.date} className="date-cell" disabled={!d.available}
                    aria-pressed={d.date === date}
                    aria-label={`${formatLongDate(d.date)}, ${d.available ? `${d.free_slots} slots free` : "unavailable"}`}
                    onClick={() => { onDateChange(d.date); onSlotChange(null); }}
                  >
                    <span className="dow">{WEEKDAYS_SHORT[wd]}</span>
                    <span className="dom">{day.getDate()}</span>
                    <span className="avail">{d.available ? `${d.free_slots} free` : "—"}</span>
                  </button>
                );
              })}
            </div>
            {!dates.data.some((d) => d.available) && (
              <div className="mt-4">
                <Alert type="info">No free slots in these two weeks. Use the arrows to check later dates.</Alert>
              </div>
            )}
          </>
        )}
      </div>

      {date && (
        <div>
          <h3 className="small strong" style={{ fontSize: "var(--text-sm)", marginBottom: 12 }}>
            Available times on {formatLongDate(date)}
          </h3>
          {slots.loading ? (
            <div className="slot-grid">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={40} />)}</div>
          ) : slots.error ? (
            <ErrorState message={slots.error} onRetry={slots.reload} />
          ) : !slots.data?.slots.length ? (
            <EmptyState icon={Clock} title="No slots on this date" description={slots.data?.message} />
          ) : (
            <>
              <div className="slot-grid" role="group" aria-label="Available time slots">
                {slots.data.slots.map((s) => (
                  <button
                    type="button" key={s.start_time} className="slot" disabled={!s.available}
                    aria-pressed={s.start_time === startTime}
                    title={s.available ? "" : s.reason === "booked" ? "Already booked" : "Unavailable"}
                    onClick={() => onSlotChange(s)}
                  >
                    {formatTime(s.start_time)}
                  </button>
                ))}
              </div>
              {!slots.data.available && <div className="mt-4"><Alert type="warning">{slots.data.message}</Alert></div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
