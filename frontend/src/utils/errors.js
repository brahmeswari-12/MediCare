/** Turn an axios error into a user-facing message. Never exposes raw internals. */
export function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;
  if (!error.response) {
    if (error.code === "ECONNABORTED") return "The server took too long to respond. Please try again.";
    if (error.message === "No refresh token") return "Your session has expired. Please sign in again.";
    return "Cannot reach the server. Check your connection and that the API is running.";
  }
  const { status, data } = error.response;
  if (status === 401) return data?.detail || "Your session has expired. Please sign in again.";
  if (status === 403) return data?.detail || "You do not have permission to do this.";
  if (status === 404) return "The requested item was not found.";
  if (status === 429) return "Too many attempts. Please wait a minute and try again.";
  if (status >= 500) return "The server encountered an error. Please try again later.";
  if (data && typeof data === "object") {
    if (typeof data.detail === "string") return data.detail;
    const first = Object.values(data)[0];
    if (Array.isArray(first) && first.length) return String(first[0]);
    if (typeof first === "string") return first;
  }
  return fallback;
}

/** Field-level validation errors from DRF: { field: "first message" }. */
export function getFieldErrors(error) {
  const data = error?.response?.status === 400 ? error.response.data : null;
  if (!data || typeof data !== "object") return {};
  const out = {};
  Object.entries(data).forEach(([key, value]) => {
    if (key === "detail" || key === "non_field_errors") return;
    if (Array.isArray(value)) out[key] = String(value[0]);
    else if (typeof value === "string") out[key] = value;
    else if (value && typeof value === "object") out[key] = "Please check this field.";
  });
  return out;
}
