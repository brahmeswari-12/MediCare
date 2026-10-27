import { useState } from "react";
import { Briefcase, Building2, GraduationCap, IndianRupee, MapPin, UserCheck } from "lucide-react";
import { adminApi } from "../../services";
import { useApi } from "../../hooks/useApi";
import { useToast } from "../../context/ToastContext";
import { ConfirmDialog } from "../../components/Modal";
import { Avatar, EmptyState, ErrorState, PageHeader, SkeletonRows } from "../../components/ui";
import { formatDateTime, formatMoney } from "../../utils/format";

export default function AdminApprovals() {
  const toast = useToast();
  const { data, setData, loading, error, reload } = useApi(
    () => adminApi.doctors({ approval_status: "PENDING", page_size: 50 }), []
  );
  const [action, setAction] = useState(null); // { type: "approve" | "reject", doctor }
  const remove = (id) => setData({ ...data, count: data.count - 1, results: data.results.filter((d) => d.id !== id) });

  return (
    <>
      <PageHeader title="Doctor approvals" description="Verify credentials before a doctor becomes visible and bookable." />
      {error ? <div className="card"><ErrorState message={error} onRetry={reload} /></div> :
        loading ? <div className="card"><SkeletonRows rows={3} height={100} /></div> :
        data.results.length === 0 ? (
          <div className="card"><EmptyState icon={UserCheck} title="No pending applications" description="New doctor applications will appear here." /></div>
        ) : (
          <div className="stack-lg">
            {data.results.map((d) => (
              <article key={d.id} className="card">
                <div className="card-body row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 20 }}>
                  <Avatar name={d.full_name} src={d.photo} size={56} />
                  <div className="stack-sm" style={{ flex: 1, minWidth: 260 }}>
                    <div className="row-wrap">
                      <h3>Dr. {d.full_name}</h3>
                      <span className="badge badge-teal no-dot">{d.specialization?.name}</span>
                    </div>
                    <span className="small muted">{d.email} · {d.phone || "no phone"} · applied {formatDateTime(d.created_at)}</span>
                    <div className="doctor-meta" style={{ flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
                      <span><GraduationCap size={15} /> {d.qualifications}</span>
                      <span><Briefcase size={15} /> {d.experience_years} yrs</span>
                      <span><Building2 size={15} /> {d.hospital}</span>
                      <span><MapPin size={15} /> {d.location}</span>
                      <span><IndianRupee size={15} /> {formatMoney(d.consultation_fee)}</span>
                    </div>
                    <span className="small"><strong>Registration number:</strong> {d.license_number}</span>
                    {d.bio && <p className="small muted">{d.bio}</p>}
                  </div>
                  <div className="row">
                    <button className="btn btn-danger-outline" onClick={() => setAction({ type: "reject", doctor: d })}>Reject</button>
                    <button className="btn btn-primary" onClick={() => setAction({ type: "approve", doctor: d })}>Approve</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      <ConfirmDialog open={action?.type === "approve"} onClose={() => setAction(null)} confirmLabel="Approve"
                     title="Approve this doctor?" description="The profile becomes visible and patients can book appointments."
                     onConfirm={async () => {
                       await adminApi.approveDoctor(action.doctor.id);
                       remove(action.doctor.id);
                       toast.success(`Dr. ${action.doctor.full_name} approved.`);
                     }} />
      <ConfirmDialog open={action?.type === "reject"} onClose={() => setAction(null)} tone="danger" confirmLabel="Reject"
                     title="Reject this application?" description="The doctor will see the reason when they sign in."
                     reasonLabel="Reason" reasonPlaceholder="e.g. Registration number could not be verified"
                     onConfirm={async (reason) => {
                       await adminApi.rejectDoctor(action.doctor.id, reason);
                       remove(action.doctor.id);
                       toast.success("Application rejected.");
                     }} />
    </>
  );
}
