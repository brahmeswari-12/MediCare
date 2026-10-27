import { appointmentApi } from "../../services";
import AppointmentTable, { APPOINTMENT_TABS } from "../../components/AppointmentTable";
import { PageHeader } from "../../components/ui";

const TABS = [{ key: "today", label: "Today", params: { scope: "today" } }, ...APPOINTMENT_TABS];

export default function DoctorAppointments() {
  return (
    <>
      <PageHeader title="Appointments" description="Confirm requests, complete consultations and review history." />
      <AppointmentTable fetcher={appointmentApi.list} basePath="/doctor/appointments" showPatient showDoctor={false}
                        withSearch tabs={TABS} defaultTab="today" />
    </>
  );
}
