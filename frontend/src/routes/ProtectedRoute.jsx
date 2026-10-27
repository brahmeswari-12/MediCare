import { Navigate, Outlet, useLocation } from "react-router-dom";
import { HOME_BY_ROLE, useAuth } from "../context/AuthContext";
import { PageLoader } from "../components/ui";

/**
 * Client-side guard for navigation only. Every API call is authorized again
 * by the backend, so hiding a route here is never the security boundary.
 */
export default function ProtectedRoute({ roles }) {
  const { user, initializing, sessionExpired, loggedOut } = useAuth();
  const location = useLocation();

  if (initializing) return <PageLoader />;
  if (!user) {
    if (loggedOut) return <Navigate to="/login" replace />;
    const params = new URLSearchParams({ next: location.pathname + location.search });
    if (sessionExpired) params.set("expired", "1");
    return <Navigate to={`/login?${params}`} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  }
  return <Outlet />;
}

/** Redirects signed-in users away from login/register pages. */
export function GuestOnly({ children }) {
  const { user, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return <PageLoader />;
  if (user) return <Navigate to={safeNext(location.search) || HOME_BY_ROLE[user.role]} replace />;
  return children;
}

/** Only allow same-site relative redirects from ?next= (prevents open redirects). */
// eslint-disable-next-line react-refresh/only-export-components
export function safeNext(search) {
  const next = new URLSearchParams(search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}
