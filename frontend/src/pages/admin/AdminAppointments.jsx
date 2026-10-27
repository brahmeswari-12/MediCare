import { adminApi } from "../../services";
import AppointmentTable from "../../components/AppointmentTable";
import { PageHeader } from "../../components/ui";

export default function AdminAppointments() {
  return (
    <>
      <PageHeader title="Appointments" description="Search and filter every appointment. Open one to review its history or cancel it." />
      <AppointmentTable fetcher={adminApi.appointments} basePath="/admin/appointments" showPatient withSearch
                        withSpecialization defaultTab="all" />
    </>
  );
}
