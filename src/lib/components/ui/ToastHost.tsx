import React, { useEffect, useState } from 'react';
import { ToastProvider, useToast } from './toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

export type ToastPayload = {
  title?: string;
  description?: string;
  variant?: 'default' | 'success' | 'destructive' | 'warning';
  duration?: number;
};

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'destructive';
};

type PendingConfirm = ConfirmOptions & {
  resolve: (confirmed: boolean) => void;
};

function ToastBridge() {
  const { toast } = useToast();

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ToastPayload>).detail || {};
      toast(detail);
    };

    window.addEventListener('app:toast', handler as EventListener);

    (window as typeof window & { showToast?: (detail: ToastPayload) => void }).showToast = (detail: ToastPayload) => {
      toast(detail || {});
    };

    return () => {
      window.removeEventListener('app:toast', handler as EventListener);
      delete (window as typeof window & { showToast?: (detail: ToastPayload) => void }).showToast;
    };
  }, [toast]);

  return null;
}

function ConfirmBridge({ state, onComplete }: { state: PendingConfirm | null; onComplete: (confirmed: boolean) => void }) {
  const open = Boolean(state);
  const tone = state?.tone === 'destructive' ? 'btn-destructive' : 'btn-primary';

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && state) {
          onComplete(false);
        }
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{state?.title || 'Are you sure?'}</DialogTitle>
          {state?.description ? <DialogDescription>{state.description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => onComplete(false)}
          >
            {state?.cancelLabel || 'Cancel'}
          </button>
          <button
            type="button"
            className={`btn ${tone}`}
            onClick={() => onComplete(true)}
          >
            {state?.confirmLabel || 'Confirm'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ToastHost() {
  const [confirmState, setConfirmState] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    (window as typeof window & { requestConfirm?: (options: ConfirmOptions) => Promise<boolean> }).requestConfirm = (
      options: ConfirmOptions
    ) => {
      return new Promise<boolean>((resolve) => {
        setConfirmState({
          resolve,
          ...options,
        });
      });
    };

    return () => {
      delete (window as typeof window & { requestConfirm?: (options: ConfirmOptions) => Promise<boolean> }).requestConfirm;
    };
  }, []);

  const handleConfirmComplete = (confirmed: boolean) => {
    if (confirmState) {
      confirmState.resolve(confirmed);
      setConfirmState(null);
    }
  };

  return (
    <ToastProvider>
      <ToastBridge />
      <ConfirmBridge state={confirmState} onComplete={handleConfirmComplete} />
    </ToastProvider>
  );
}
