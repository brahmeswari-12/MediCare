import { useState } from "react";
import { Pill } from "lucide-react";
import { prescriptionApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import Pagination from "../../components/Pagination";
import PrescriptionCard from "../../components/PrescriptionCard";
import { EmptyState, ErrorState, PageHeader, SkeletonRows } from "../../components/ui";

export function PrescriptionList({ emptyText }) {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi(() => prescriptionApi.list({ page }), [page]);
  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;
  if (loading) return <div className="card"><SkeletonRows rows={3} height={90} /></div>;
  if (!data.results.length) return <div className="card"><EmptyState icon={Pill} title="No prescriptions" description={emptyText} /></div>;
  return (
    <div className="stack-lg">
      {data.results.map((p) => <PrescriptionCard key={p.id} prescription={p} showContext />)}
      {data.count > 10 && <div className="card"><Pagination page={page} count={data.count} onChange={setPage} /></div>}
    </div>
  );
}

export default function PatientPrescriptions() {
  return (
    <>
      <PageHeader title="Prescriptions" description="Medicines prescribed to you, as shared by your doctors." />
      <PrescriptionList emptyText="Prescriptions appear here once your doctor shares a consultation record." />
    </>
  );
}
