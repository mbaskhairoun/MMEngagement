"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/* ---------- Toasts ---------- */
type ToastKind = "success" | "error";
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}
interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
}
const ToastCtx = createContext<ToastApi | null>(null);

/* ---------- Confirm ---------- */
export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}
type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const push = useCallback((kind: ToastKind, text: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3500);
  }, []);
  const toastApi = useRef<ToastApi>({
    success: (t) => push("success", t),
    error: (t) => push("error", t),
  });

  const [confirmState, setConfirmState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => setConfirmState({ opts, resolve })),
    [],
  );
  const close = (v: boolean) => {
    confirmState?.resolve(v);
    setConfirmState(null);
  };

  return (
    <ToastCtx.Provider value={toastApi.current}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        <div className="adm-toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`adm-toast adm-toast-${t.kind}`} role="status">
              {t.text}
            </div>
          ))}
        </div>
        {confirmState && (
          <Modal title={confirmState.opts.title} onClose={() => close(false)} small>
            <div className="adm-confirm-msg">{confirmState.opts.message}</div>
            <div className="adm-modal-actions">
              <button className="adm-btn" onClick={() => close(false)}>
                Cancel
              </button>
              <button
                className={`adm-btn ${confirmState.opts.danger ? "adm-btn-danger" : "adm-btn-primary"}`}
                onClick={() => close(true)}
                autoFocus
              >
                {confirmState.opts.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </Modal>
        )}
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast outside UiProvider");
  return c;
}
export function useConfirm(): ConfirmFn {
  const c = useContext(ConfirmCtx);
  if (!c) throw new Error("useConfirm outside UiProvider");
  return c;
}

/* ---------- Modal ---------- */
export function Modal({
  title,
  onClose,
  children,
  small,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  small?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="adm-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`adm-modal${small ? " adm-modal-sm" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="adm-modal-head">
          <h3>{title}</h3>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="adm-modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Small bits ---------- */
export function StatusBadge({ status }: { status: "attending" | "declined" | "pending" }) {
  const label = status === "attending" ? "Attending" : status === "declined" ? "Declined" : "Pending";
  return <span className={`adm-badge adm-badge-${status}`}>{label}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="adm-page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="adm-muted">{subtitle}</p>}
      </div>
      {actions && <div className="adm-page-actions">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="adm-stat">
      <div className="adm-stat-value">{value}</div>
      <div className="adm-stat-label">{label}</div>
      {hint && <div className="adm-stat-hint">{hint}</div>}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return <div className="adm-loading">{label}&hellip;</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="adm-empty">{children}</div>;
}

/** Download a text blob as a file. */
export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
