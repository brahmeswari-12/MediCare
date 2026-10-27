import { Link } from "react-router-dom";
import { CalendarCheck } from "lucide-react";
import { appointmentApi } from "../../services";
import AppointmentTable from "../../components/AppointmentTable";
import { PageHeader } from "../../components/ui";

export default function PatientAppointments() {
  return (
    <>
      <PageHeader
        title="My appointments"
        description="Upcoming visits, pending requests and your appointment history."
        actions={<Link to="/doctors" className="btn btn-primary"><CalendarCheck size={16} /> Book new</Link>}
      />
      <AppointmentTable fetcher={appointmentApi.list} basePath="/patient/appointments"
                        emptyAction={<Link to="/doctors" className="btn btn-primary btn-sm">Find a doctor</Link>} />
    </>
  );
}
