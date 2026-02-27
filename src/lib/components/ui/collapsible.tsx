import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type HTMLAttributes,
  type ReactNode
} from 'react';

type ClassValue = string | null | undefined | false;

function cn(...classes: ClassValue[]) {
  return classes.filter(Boolean).join(' ');
}

interface CollapsibleContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

function useCollapsibleContext(component: string) {
  const context = useContext(CollapsibleContext);
  if (!context) {
    throw new Error(`${component} must be used within a <Collapsible>`);
  }
  return context;
}

export interface CollapsibleProps {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Collapsible({ children, open, defaultOpen, onOpenChange }: CollapsibleProps) {
  const isControlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean>(defaultOpen ?? true);
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

  return (
    <CollapsibleContext.Provider value={value}>
      <div data-state={actualOpen ? 'open' : 'closed'}>{children}</div>
    </CollapsibleContext.Provider>
  );
}

export interface CollapsibleTriggerProps {
  asChild?: boolean;
  children: React.ReactElement;
}

export function CollapsibleTrigger({ asChild, children }: CollapsibleTriggerProps) {
  const { open, setOpen } = useCollapsibleContext('CollapsibleTrigger');
  const child = React.Children.only(children);

  const handleClick = (event: React.MouseEvent) => {
    child.props?.onClick?.(event);
    if (!event.defaultPrevented) {
      setOpen(!open);
    }
  };

  if (asChild) {
    return React.cloneElement(child, { onClick: handleClick });
  }

  return React.cloneElement(child, { onClick: handleClick });
}

export interface CollapsibleContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  forceMount?: boolean;
}

export function CollapsibleContent({ children, className, forceMount, ...rest }: CollapsibleContentProps) {
  const { open } = useCollapsibleContext('CollapsibleContent');

  if (!open && !forceMount) {
    return null;
  }

  return (
    <div
      className={cn('data-[state=closed]:hidden', className)}
      data-state={open ? 'open' : 'closed'}
      hidden={!open}
      {...rest}
    >
      {children}
    </div>
  );
}
