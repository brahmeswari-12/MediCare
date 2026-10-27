import { PrescriptionList } from "../patient/PatientPrescriptions";
import { PageHeader } from "../../components/ui";

export default function DoctorPrescriptions() {
  return (
    <>
      <PageHeader title="Prescriptions" description="Prescriptions you have issued. Add new ones from a consultation record." />
      <PrescriptionList emptyText="Open a consultation record and choose 'Add prescription' to issue one." />
    </>
  );
}
