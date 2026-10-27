import { Link, useSearchParams } from "react-router-dom";
import { RecordList } from "../patient/PatientRecords";
import { PageHeader } from "../../components/ui";

export default function DoctorRecords() {
  const [params] = useSearchParams();
  const patient = params.get("patient");
  return (
    <>
      <PageHeader
        title="Consultation records"
        description={patient ? "Records for the selected patient." : "Records you have written for your appointments."}
        actions={patient && <Link to="/doctor/records" className="btn btn-secondary">Show all records</Link>}
      />
      <p className="small muted" style={{ marginTop: -12, marginBottom: 16 }}>
        To write a new record, open a confirmed or completed appointment and choose "Write consultation record".
      </p>
      <RecordList basePath="/doctor/records" showPatient params={patient ? { appointment__patient: patient } : {}} />
    </>
  );
}
