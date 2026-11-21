"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/* ---------- Toasts ---------- */
type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}
export interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
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
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6500 : 3800);
  }, []);
  const toastApi = useRef<ToastApi>({
    success: (t) => push("success", t),
    error: (t) => push("error", t),
    info: (t) => push("info", t),
  });

  const [confirmState, setConfirmState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => setConfirmState({ opts, resolve })),
    [],
  );
  const close = useCallback(
    (v: boolean) => {
      confirmState?.resolve(v);
      setConfirmState(null);
    },
    [confirmState],
  );
  const cancel = useCallback(() => close(false), [close]);

  return (
    <ToastCtx.Provider value={toastApi.current}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        <div className="dec-toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`dec-toast dec-toast-${t.kind}`} role="status">
              {t.text}
            </div>
          ))}
        </div>
        {confirmState && (
          <Modal title={confirmState.opts.title} onClose={cancel} small layer="top">
            <div className="dec-confirm-msg">{confirmState.opts.message}</div>
            <div className="dec-modal-actions">
              <button type="button" className="dec-btn" onClick={cancel}>
                Cancel
              </button>
              <button
                type="button"
                className={`dec-btn ${confirmState.opts.danger ? "dec-btn-danger" : "dec-btn-primary"}`}
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

/* ---------- Overlay plumbing ---------- */
// A stack so Escape only closes the top-most overlay (e.g. a confirm over the item form).
const overlayStack: number[] = [];
let overlaySeq = 0;
function useOverlay(onClose: () => void) {
  const ref = useRef(onClose);
  useEffect(() => {
    ref.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const id = ++overlaySeq;
    overlayStack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && overlayStack[overlayStack.length - 1] === id) ref.current();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      const i = overlayStack.indexOf(id);
      if (i >= 0) overlayStack.splice(i, 1);
      if (overlayStack.length === 0) document.body.style.overflow = "";
    };
  }, []);
}

/* ---------- Modal (centered) ---------- */
export function Modal({
  title,
  onClose,
  children,
  small,
  wide,
  layer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  small?: boolean;
  wide?: boolean;
  layer?: "top";
}) {
  useOverlay(onClose);
  const cls = `dec-modal${small ? " dec-modal-sm" : ""}${wide ? " dec-modal-wide" : ""}`;
  return (
    <div
      className={`dec-overlay${layer === "top" ? " dec-overlay-top" : ""}`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={cls} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dec-modal-head">
          <h3>{title}</h3>
          <button type="button" className="dec-icon-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="dec-modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Sheet: bottom sheet on phones, side panel on desktop ---------- */
export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useOverlay(onClose);
  return (
    <div className="dec-overlay dec-overlay-sheet" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dec-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="dec-sheet-grip" aria-hidden="true" />
        <div className="dec-modal-head">
          <h3>{title}</h3>
          <button type="button" className="dec-icon-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="dec-sheet-body">{children}</div>
        {footer && <div className="dec-sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Small bits ---------- */
export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="dec-loading" role="status">
      <span className="dec-spinner" aria-hidden="true" />
      {label}&hellip;
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="dec-empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="dec-empty-action">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="dec-error-box" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="dec-btn dec-btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export const ICONS = {
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  plus: "M12 5v14M5 12h14",
  sync: "M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9M18 3v4h-4M6 21v-4h4",
  info: "M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  logout: "M10 4H5v16h5M15 8l4 4-4 4M19 12H9",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  left: "M15 5l-7 7 7 7",
  right: "M9 5l7 7-7 7",
  pin: "M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11ZM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
} as const;
