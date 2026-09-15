"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { TONE_CLASSES, type Tone } from "@/lib/ui/tone";

export interface ToastMessage {
  readonly id: number;
  readonly title: string;
  readonly description?: string;
  readonly tone: Tone;
}

interface ToastContextValue {
  readonly push: (toast: Omit<ToastMessage, "id">) => void;
  readonly dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 6_000;

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const TONE_ICON: Record<Tone, typeof Info> = {
  neutral: Info,
  info: Info,
  positive: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

/**
 * Transient messages.
 *
 * Errors used to render as a red paragraph wedged above whichever panel produced them, which meant
 * a failed simulation command shifted the layout and a failure on a panel you had scrolled past was
 * invisible. A toast is the right shape for something that is true for a moment and then isn't.
 */
export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<readonly ToastMessage[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((toast: Omit<ToastMessage, "id">) => {
    setToasts((current) => {
      // Re-raising the same message shouldn't stack — a retry loop would otherwise bury the screen.
      if (current.some((t) => t.title === toast.title && t.description === toast.description)) {
        return current;
      }
      return [...current, { ...toast, id: nextId.current++ }];
    });
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-toast)] flex flex-col items-center gap-2 p-4 sm:items-end"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
}) {
  const Icon = TONE_ICON[toast.tone];

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg p-3",
        "bg-surface/90 shadow-lg ring-1 ring-edge backdrop-blur-xl",
        "motion-safe:animate-[toast-in_var(--duration-base)_var(--ease-out)]",
      )}
    >
      <Icon size={16} aria-hidden className={cn("mt-0.5 shrink-0", TONE_CLASSES[toast.tone].text)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-content">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-xs text-secondary">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-m-1 shrink-0 rounded p-1 text-muted transition-colors hover:text-content"
      >
        <X size={14} />
      </button>
    </div>
  );
}
