import React,
  {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type HTMLAttributes,
    type ReactNode,
  } from 'react';
import { createPortal } from 'react-dom';
type ClassValue = string | null | undefined | false;

function cn(...classes: ClassValue[]) {
  return classes.filter(Boolean).join(' ');
}

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext(component: string) {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error(`${component} must be used within a <Dialog>`);
  }
  return context;
}

export interface DialogProps {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Dialog({ children, open, defaultOpen, onOpenChange }: DialogProps) {
  const isControlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean>(defaultOpen ?? false);
  const actualOpen = isControlled ? (open as boolean) : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const value = useMemo(() => ({ open: actualOpen, setOpen }), [actualOpen, setOpen]);

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

export interface DialogTriggerProps {
  asChild?: boolean;
  children: React.ReactElement;
}

export function DialogTrigger({ asChild, children }: DialogTriggerProps) {
  const { setOpen } = useDialogContext('DialogTrigger');
  const child = React.Children.only(children);

  const handleClick = (event: React.MouseEvent) => {
    child.props?.onClick?.(event);
    if (!event.defaultPrevented) {
      setOpen(true);
    }
  };

  if (asChild) {
    return React.cloneElement(child, { onClick: handleClick });
  }

  return React.cloneElement(child, { onClick: handleClick });
}

interface DialogPortalProps {
  children: ReactNode;
}

function DialogPortal({ children }: DialogPortalProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

export interface DialogContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  containerClassName?: string;
  overlayClassName?: string;
}

export const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(function DialogContent(
  { children, className, containerClassName, overlayClassName, ...rest },
  forwardedRef
) {
  const { open, setOpen } = useDialogContext('DialogContent');
  const contentRef = useRef<HTMLDivElement | null>(null);

  const assignRef = useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef]
  );

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const node = contentRef.current;
    node?.focus({ preventScroll: true });

    return () => {
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <DialogPortal>
      <div className={cn('fixed inset-0 z-50 flex items-center justify-center', containerClassName)}>
        <div
          className={cn('absolute inset-0 bg-black/40 backdrop-blur-sm', overlayClassName)}
          onClick={() => setOpen(false)}
        />
        <div
          ref={assignRef}
          role="dialog"
          aria-modal="true"
          className={cn(
            'relative z-10 w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-xl outline-none focus-visible:ring-2 focus-visible:ring-primary',
            className
          )}
          tabIndex={-1}
          {...rest}
        >
          {children}
        </div>
      </div>
    </DialogPortal>
  );
});

export function DialogHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mb-4 flex flex-col space-y-1 text-center sm:text-left', className)}>{children}</div>;
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}>{children}</div>;
}

export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('text-lg font-semibold leading-none tracking-tight', className)}>{children}</h3>;
}

export function DialogDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-sm text-muted-foreground', className)}>{children}</p>;
}

export interface DialogCloseProps {
  children: React.ReactElement;
}

export function DialogClose({ children }: DialogCloseProps) {
  const { setOpen } = useDialogContext('DialogClose');
  const child = React.Children.only(children);

  const handleClick = (event: React.MouseEvent) => {
    child.props?.onClick?.(event);
    if (!event.defaultPrevented) {
      setOpen(false);
    }
  };

  return React.cloneElement(child, { onClick: handleClick });
}

export function useDialog() {
  return useDialogContext('useDialog');
}
