import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Ban, CalendarCheck, CalendarClock, CalendarDays, ClipboardList, CreditCard, FileText, Globe, LayoutDashboard,
  LogOut, Menu, Package, Pill, Search, Stethoscope, Tags, UserCheck, UserRound, Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Alert, Avatar } from "../components/ui";
import { Brand } from "./PublicLayout";

const NAV = {
  PATIENT: [
    { section: "Overview" },
    { to: "/patient", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/doctors", label: "Find doctors", icon: Search },
    { section: "My care" },
    { to: "/patient/appointments", label: "Appointments", icon: CalendarCheck },
    { to: "/patient/records", label: "Medical records", icon: FileText },
    { to: "/patient/prescriptions", label: "Prescriptions", icon: Pill },
    { to: "/patient/payments", label: "Payments", icon: CreditCard },
    { section: "Account" },
    { to: "/patient/profile", label: "Profile & security", icon: UserRound },
  ],
  DOCTOR: [
    { section: "Overview" },
    { to: "/doctor", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/doctor/appointments", label: "Appointments", icon: CalendarCheck },
    { section: "Availability" },
    { to: "/doctor/schedule", label: "Weekly schedule", icon: CalendarClock },
    { to: "/doctor/blocked-dates", label: "Blocked dates", icon: Ban },
    { section: "Clinical" },
    { to: "/doctor/patients", label: "My patients", icon: Users },
    { to: "/doctor/records", label: "Consultation records", icon: ClipboardList },
    { to: "/doctor/prescriptions", label: "Prescriptions", icon: Pill },
    { section: "Account" },
    { to: "/doctor/profile", label: "Profile & security", icon: UserRound },
  ],
  ADMIN: [
    { section: "Overview" },
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    { section: "Management" },
    { to: "/admin/approvals", label: "Doctor approvals", icon: UserCheck },
    { to: "/admin/doctors", label: "Doctors", icon: Stethoscope },
    { to: "/admin/patients", label: "Patients", icon: Users },
    { to: "/admin/appointments", label: "Appointments", icon: CalendarDays },
    { to: "/admin/specializations", label: "Specializations", icon: Tags },
    { to: "/admin/supplies", label: "Hospital supplies", icon: Package },
    { section: "Account" },
    { to: "/admin/account", label: "Account security", icon: UserRound },
  ],
};

const ROLE_LABEL = { PATIENT: "Patient", DOCTOR: "Doctor", ADMIN: "Administrator" };

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location.pathname]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const displayName = user.role === "DOCTOR" ? `Dr. ${user.full_name}` : user.full_name;

  return (
    <div className="app-shell">
      <a href="#app-main" className="skip-link">Skip to content</a>
      <div className={`sidebar-overlay ${open ? "open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Dashboard navigation">
        <div className="sidebar-brand"><Brand to={user.role === "ADMIN" ? "/admin" : "/"} /></div>
        <nav className="sidebar-nav">
          {NAV[user.role].map((item) =>
            item.section ? (
              <div key={item.section} className="sidebar-label">{item.section}</div>
            ) : (
              <NavLink key={item.to} to={item.to} end={item.end} className="sidebar-link">
                <item.icon size={18} aria-hidden="true" /> {item.label}
              </NavLink>
            )
          )}
        </nav>
        <div className="sidebar-user">
          <Avatar name={user.full_name} size={36} />
          <div className="who">
            <strong>{displayName}</strong>
            <span>{ROLE_LABEL[user.role]}</span>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={handleLogout} aria-label="Sign out" title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon menu-toggle" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <div className="spacer" />
          {user.role !== "ADMIN" && (
            <Link to="/" className="btn btn-ghost btn-sm"><Globe size={15} /> Public site</Link>
          )}
          {user.role === "PATIENT" && (
            <Link to="/doctors" className="btn btn-primary btn-sm"><CalendarCheck size={15} /> Book appointment</Link>
          )}
        </header>
        <main id="app-main" className="app-content">
          {user.role === "DOCTOR" && user.approval_status !== "APPROVED" && (
            <div style={{ marginBottom: 20 }}>
              {user.approval_status === "REJECTED" ? (
                <Alert type="danger" title="Your application was not approved">
                  {user.rejection_reason || "Please contact the administrator for details."}
                </Alert>
              ) : (
                <Alert type="warning" title="Awaiting administrator approval">
                  You can complete your profile and set up your schedule now. Patients will be able to find and
                  book you once an administrator approves your account.
                </Alert>
              )}
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
