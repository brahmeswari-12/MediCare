import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Alert, Spinner, TextAreaField } from "./ui";
import { getErrorMessage } from "../utils/errors";

/** Accessible modal: focus moves inside, Escape closes, focus returns on close. */
export function Modal({ open, onClose, title, description, children, footer, size = "" }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const node = dialogRef.current;
    const focusable = node?.querySelector("input, select, textarea, button:not(.modal-close)");
    (focusable || node)?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "Tab" && node) {
        const items = node.querySelectorAll("a[href], button:not(:disabled), input, select, textarea");
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={dialogRef} tabIndex={-1}>
        <div className="modal-header">
          <div>
            <h2 id="modal-title" style={{ fontSize: "var(--text-lg)" }}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="btn btn-ghost btn-icon modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/**
 * Confirmation dialog. If `reasonLabel` is set, a required reason textarea is
 * shown and passed to onConfirm(reason). Errors from onConfirm are displayed.
 */
export function ConfirmDialog({
  open, onClose, onConfirm, title, description, confirmLabel = "Confirm",
  tone = "primary", reasonLabel, reasonPlaceholder,
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) { setReason(""); setError(""); setBusy(false); }
  }, [open]);

  async function handleConfirm() {
    if (reasonLabel && reason.trim().length < 3) {
      setError("Please enter a reason (at least 3 characters).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      description={description}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Go back</button>
          <button className={`btn ${tone === "danger" ? "btn-danger" : "btn-primary"}`} onClick={handleConfirm} disabled={busy}>
            {busy && <Spinner size={16} />} {confirmLabel}
          </button>
        </>
      }
    >
      <div className="stack">
        {error && <Alert type="danger">{error}</Alert>}
        {reasonLabel && (
          <TextAreaField label={reasonLabel} required value={reason} maxLength={1000}
                         placeholder={reasonPlaceholder} onChange={(e) => setReason(e.target.value)} />
        )}
      </div>
    </Modal>
  );
}
