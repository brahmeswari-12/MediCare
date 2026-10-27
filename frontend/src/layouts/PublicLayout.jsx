import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Menu, Stethoscope, X } from "lucide-react";
import { HOME_BY_ROLE, useAuth } from "../context/AuthContext";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/doctors", label: "Find doctors" },
  { to: "/specialties", label: "Specialties" },
  { to: "/about", label: "About" },
];

export function Brand({ to = "/" }) {
  return (
    <Link to={to} className="brand" aria-label="MediCare home">
      <span className="brand-mark"><Stethoscope size={19} aria-hidden="true" /></span>
      <span>Medi<em>Care</em></span>
    </Link>
  );
}

function SiteHeader() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  const accountActions = user ? (
    <Link to={HOME_BY_ROLE[user.role]} className="btn btn-primary">
      <LayoutDashboard size={16} /> Dashboard
    </Link>
  ) : (
    <>
      <Link to="/login" className="btn btn-ghost">Sign in</Link>
      <Link to="/register" className="btn btn-primary">Book an appointment</Link>
    </>
  );

  return (
    <header className="site-header">
      <div className="container">
        <Brand />
        <nav className="nav" aria-label="Main">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>{l.label}</NavLink>
          ))}
        </nav>
        <div className="header-actions"><span className="desktop-only row">{accountActions}</span></div>
        <button className="btn btn-ghost btn-icon menu-toggle" aria-expanded={open} aria-controls="mobile-nav"
                aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      <nav id="mobile-nav" className="mobile-nav" hidden={!open} aria-label="Mobile">
        {LINKS.map((l) => <NavLink key={l.to} to={l.to} end={l.end}>{l.label}</NavLink>)}
        <div className="row-wrap mt-2">{accountActions}</div>
      </nav>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="stack-sm">
            <Brand />
            <p className="small" style={{ maxWidth: 340, marginTop: 8 }}>
              Find verified doctors, see real-time availability and manage your appointments in one place.
            </p>
          </div>
          <div>
            <h4>Patients</h4>
            <ul>
              <li><Link to="/doctors">Find a doctor</Link></li>
              <li><Link to="/specialties">Specialties</Link></li>
              <li><Link to="/register">Create an account</Link></li>
            </ul>
          </div>
          <div>
            <h4>Doctors</h4>
            <ul>
              <li><Link to="/register/doctor">Join as a doctor</Link></li>
              <li><Link to="/login?role=doctor">Doctor sign in</Link></li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              <li><Link to="/about">About us</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} MediCare. All rights reserved.</span>
          <span>This platform helps you book consultations. It does not provide medical advice or diagnosis.
            In an emergency, call your local emergency number.</span>
        </div>
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <SiteHeader />
      <main id="main">
        <Outlet />
      </main>
      <SiteFooter />
    </>
  );
}
