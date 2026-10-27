import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";
const REFRESH_KEY = "medicare.refresh";

/*
 * Token handling
 * - The short-lived access token is kept in memory only.
 * - The refresh token is kept in localStorage so a page reload keeps the
 *   session. It is rotated on every refresh and blacklisted on logout.
 */
let accessToken = null;
let onSessionExpired = () => {};

export const tokenStore = {
  getAccess: () => accessToken,
  getRefresh: () => {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  set({ access, refresh }) {
    if (access) accessToken = access;
    if (refresh) {
      try {
        localStorage.setItem(REFRESH_KEY, refresh);
      } catch {
        /* storage unavailable: session lasts for this tab only */
      }
    }
  },
  clear() {
    accessToken = null;
    try {
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
  },
};

export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

const api = axios.create({ baseURL: API_BASE_URL, timeout: 20000 });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// One refresh request at a time; concurrent 401s wait for the same promise.
let refreshPromise = null;

export function refreshAccessToken() {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return Promise.reject(new Error("No refresh token"));
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh/`, { refresh })
      .then(({ data }) => {
        tokenStore.set(data);
        return data.access;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthCall = original?.url?.includes("/auth/login") || original?.url?.includes("/auth/refresh");
    if (status === 401 && original && !original._retry && !isAuthCall && tokenStore.getRefresh()) {
      original._retry = true;
      try {
        const newAccess = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (refreshError) {
        tokenStore.clear();
        onSessionExpired();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
