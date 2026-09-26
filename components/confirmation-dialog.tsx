"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

export function ConfirmationDialog({ title, description, confirmLabel, cancelLabel = "Cancel", requiredText, pending = false, onCancel, onConfirm }: {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  requiredText?: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const canConfirm = !pending && (!requiredText || typed === requiredText);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel, pending]);

  return <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onCancel(); }}>
    <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-description">
      <div className="confirm-icon"><AlertTriangle size={17}/></div>
      <h2 id="confirmation-title">{title}</h2>
      <p id="confirmation-description">{description}</p>
      {requiredText && <div className="form-field confirm-input"><label htmlFor="confirmation-required-text">Type <strong>{requiredText}</strong> to confirm</label><input id="confirmation-required-text" className="input" autoComplete="off" value={typed} onChange={(event) => setTyped(event.target.value)}/></div>}
      <div className="confirm-actions"><button ref={cancelRef} type="button" className="button button-secondary button-small" disabled={pending} onClick={onCancel}>{cancelLabel}</button><button type="button" className="button button-danger button-small" disabled={!canConfirm} onClick={onConfirm}>{pending ? "Working…" : confirmLabel}</button></div>
    </section>
  </div>;
}
