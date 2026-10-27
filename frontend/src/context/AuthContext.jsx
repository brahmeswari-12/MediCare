import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../services";
import { refreshAccessToken, setSessionExpiredHandler, tokenStore } from "../services/api";

const AuthContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const HOME_BY_ROLE = { PATIENT: "/patient", DOCTOR: "/doctor", ADMIN: "/admin" };

/** Thrown by login() when the account's role differs from the role chosen on the sign-in page. */
export class RoleMismatchError extends Error {
  constructor(actualRole) {
    super(`This account has the ${actualRole} role.`);
    this.name = "RoleMismatchError";
    this.actualRole = actualRole;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);

  // Restore a session from the stored refresh token on first load.
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!tokenStore.getRefresh()) {
        setInitializing(false);
        return;
      }
      try {
        await refreshAccessToken();
        const me = await authApi.me();
        if (!cancelled) setUser(me);
      } catch {
        tokenStore.clear();
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setSessionExpired(true);
    });
  }, []);

  /**
   * expectedRole (optional) is a convenience check for the sign-in page's role
   * selector, not a security boundary: the server authorizes every request by
   * the account's real role. On a mismatch the new session is revoked before it
   * is stored, so no redirect happens and the page can explain what went wrong.
   */
  const login = useCallback(async (email, password, expectedRole) => {
    const result = await authApi.login(email, password);
    if (expectedRole && result.user.role !== expectedRole) {
      tokenStore.set({ access: result.access }); // logout requires an authenticated request
      try {
        await authApi.logout(result.refresh);
      } catch {
        // The unused refresh token expires on its own.
      }
      tokenStore.clear();
      throw new RoleMismatchError(result.user.role);
    }
    tokenStore.set(result);
    setSessionExpired(false);
    setLoggedOut(false);
    setUser(result.user);
    return result.user;
  }, []);

  const registerPatient = useCallback(async (payload) => {
    const result = await authApi.register(payload);
    tokenStore.set(result);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    const refresh = tokenStore.getRefresh();
    try {
      if (refresh) await authApi.logout(refresh);
    } catch {
      // The local session is cleared regardless; the token expires on its own.
    }
    tokenStore.clear();
    setLoggedOut(true);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await authApi.me();
    setUser(me);
    return me;
  }, []);

  const value = useMemo(
    () => ({
      user,
      initializing,
      sessionExpired,
      loggedOut,
      clearSessionExpired: () => setSessionExpired(false),
      isAuthenticated: Boolean(user),
      login,
      logout,
      registerPatient,
      refreshUser,
    }),
    [user, initializing, sessionExpired, loggedOut, login, logout, registerPatient, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
