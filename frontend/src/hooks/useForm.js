import { useCallback, useState } from "react";
import { getErrorMessage, getFieldErrors } from "../utils/errors";

/**
 * Small form helper: values, field errors (client + server), submit state.
 *   const form = useForm(initial, validate);
 *   <TextField {...form.field("email")} />
 *   <form onSubmit={form.handleSubmit(async (values) => api.save(values))}>
 */
export function useForm(initialValues, validate) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const setValue = useCallback((name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));
  }, []);

  const field = (name, { type } = {}) => ({
    name,
    value: type === "checkbox" ? undefined : values[name] ?? "",
    checked: type === "checkbox" ? Boolean(values[name]) : undefined,
    error: errors[name],
    onChange: (e) => setValue(name, type === "checkbox" ? e.target.checked : e.target.value),
  });

  const handleSubmit = (onValid) => async (event) => {
    event?.preventDefault();
    setFormError("");
    const clientErrors = validate ? validate(values) : {};
    const hasErrors = Object.values(clientErrors).some(Boolean);
    setErrors(clientErrors);
    if (hasErrors) {
      setFormError("Please correct the highlighted fields.");
      return;
    }
    setSubmitting(true);
    try {
      await onValid(values);
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      setErrors(fieldErrors);
      const hasField = Object.keys(fieldErrors).length > 0;
      setFormError(hasField && !err.response?.data?.detail ? "Please correct the highlighted fields." : getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return { values, setValues, setValue, errors, setErrors, formError, setFormError, submitting, field, handleSubmit };
}

export const validators = {
  required: (v, label = "This field") => (String(v ?? "").trim() ? undefined : `${label} is required.`),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || "") ? undefined : "Enter a valid email address."),
  phone: (v) => (/^\+?[0-9][0-9\s-]{6,18}[0-9]$/.test((v || "").trim()) ? undefined : "Enter a valid phone number."),
  password: (v) => {
    if (!v || v.length < 8) return "Use at least 8 characters.";
    if (/^\d+$/.test(v)) return "Password cannot be entirely numeric.";
    return undefined;
  },
};
