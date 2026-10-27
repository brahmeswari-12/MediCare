import { useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { paymentApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import { useToast } from "../../context/ToastContext";
import { Modal } from "../../components/Modal";
import Pagination from "../../components/Pagination";
import { Alert, EmptyState, ErrorState, PageHeader, SkeletonRows, Spinner, StatusBadge } from "../../components/ui";
import { formatDate, formatDateTime, formatMoney } from "../../utils/format";
import { getErrorMessage } from "../../utils/errors";

const METHODS = [
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "NETBANKING", label: "Net banking" },
];

function PayDialog({ payment, onClose, onPaid }) {
  const [method, setMethod] = useState("UPI");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setBusy(true);
    setError("");
    try {
      onPaid(await paymentApi.pay(payment.id, method));
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Pay consultation fee"
           description={`${payment.appointment_reference} · Dr. ${payment.doctor_name}`}
           footer={
             <>
               <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
               <button className="btn btn-primary" onClick={pay} disabled={busy}>
                 {busy && <Spinner size={16} />} Pay {formatMoney(payment.amount, payment.currency)}
               </button>
             </>
           }>
      <div className="stack">
        <Alert type="warning" title="Demo payment">
          This environment uses a mock payment provider. No money is charged and no card details are collected.
        </Alert>
        {error && <Alert type="danger">{error}</Alert>}
        <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="stack-sm">
          <legend className="label" style={{ marginBottom: 8 }}>Payment method</legend>
          {METHODS.map((m) => (
            <label key={m.value} className="checkbox">
              <input type="radio" name="method" value={m.value} checked={method === m.value} onChange={() => setMethod(m.value)} />
              {m.label}
            </label>
          ))}
        </fieldset>
      </div>
    </Modal>
  );
}

export default function PatientPayments() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState(null);
  const { data, setData, loading, error, reload } = useApi(() => paymentApi.list({ page }), [page]);

  return (
    <>
      <PageHeader title="Payments" description="Consultation fees for your appointments." />
      <div className="card">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <SkeletonRows rows={4} /> :
          data.results.length === 0 ? <EmptyState icon={CreditCard} title="No payments yet" /> : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Appointment</th>
                      <th scope="col">Doctor</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Status</th>
                      <th scope="col">Transaction</th>
                      <th scope="col"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <Link to={`/patient/appointments/${p.appointment_id}`} className="cell-main">{p.appointment_reference}</Link>
                          <div className="cell-sub">{formatDate(p.appointment_date)}</div>
                        </td>
                        <td>Dr. {p.doctor_name}</td>
                        <td className="cell-main">{formatMoney(p.amount, p.currency)}</td>
                        <td><StatusBadge status={p.status} /></td>
                        <td>
                          {p.transaction_reference ? (
                            <>
                              <div className="cell-sub" style={{ fontFamily: "monospace" }}>{p.transaction_reference}</div>
                              <div className="cell-sub">{formatDateTime(p.paid_at)}{p.is_mock && " · demo"}</div>
                            </>
                          ) : "—"}
                        </td>
                        <td className="text-right">
                          {p.status === "PENDING" && p.appointment_status !== "CANCELLED" && (
                            <button className="btn btn-primary btn-sm" onClick={() => setPaying(p)}>Pay now</button>
                          )}
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
      {paying && (
        <PayDialog payment={paying} onClose={() => setPaying(null)}
                   onPaid={(updated) => {
                     setData({ ...data, results: data.results.map((p) => (p.id === updated.id ? updated : p)) });
                     toast.success("Payment recorded (demo).");
                   }} />
      )}
    </>
  );
}
