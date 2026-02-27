import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type ToastVariant = 'default' | 'success' | 'destructive' | 'warning';

type ToastRecord = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextValue = {
  toast: (toast: Omit<ToastRecord, 'id'> & { id?: string }) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 4500;

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const timers = useRef<Map<string, number>>(new Map());
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const [isClient, setIsClient] = useState(false);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timeoutId = timers.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    ({ id: providedId, duration = DEFAULT_DURATION, ...rest }: Omit<ToastRecord, 'id'> & { id?: string }) => {
      const id = providedId ?? generateId();
      const record: ToastRecord = {
        id,
        duration,
        variant: rest.variant ?? 'default',
        title: rest.title,
        description: rest.description,
      };

      setToasts((prev) => [...prev.filter((item) => item.id !== id), record]);

      if (typeof window !== 'undefined') {
        const timeoutId = window.setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timeoutId);
      }

      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    setIsClient(true);

    return () => {
      timers.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timers.current.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {isClient ? <ToastViewport toasts={toasts} dismiss={dismiss} /> : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return context;
}

interface ToastViewportProps {
  toasts: ToastRecord[];
  dismiss: (id: string) => void;
}

function ToastViewport({ toasts, dismiss }: ToastViewportProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>,
    document.body
  );
}

interface ToastItemProps {
  toast: ToastRecord;
  onDismiss: () => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { variant = 'default', title, description } = toast;

  const variantClasses: Record<ToastVariant, string> = {
    default: 'border-border bg-background text-foreground',
    success: 'border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
    destructive: 'border-destructive/40 bg-destructive text-destructive-foreground',
    warning: 'border-amber-500/40 bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-50',
  };
  const descriptionClasses: Record<ToastVariant, string> = {
    default: 'text-muted-foreground',
    success: 'text-emerald-900/90 dark:text-emerald-100/90',
    destructive: 'text-destructive-foreground/90',
    warning: 'text-amber-900/90 dark:text-amber-50/90',
  };

  return (
    <div
      role="status"
      className={`w-full max-w-sm rounded-lg border px-4 py-3 shadow-lg transition-all ${variantClasses[variant]}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          {title ? <p className="text-sm font-semibold leading-tight">{title}</p> : null}
          {description ? <p className={`mt-1 text-sm ${descriptionClasses[variant]}`}>{description}</p> : null}
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          className="rounded-md p-1 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
