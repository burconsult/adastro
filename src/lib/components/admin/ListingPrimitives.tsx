import React from 'react';
import { Loader2 } from 'lucide-react';

type ClassValue = string | undefined | null | false;

const cx = (...values: ClassValue[]) => values.filter(Boolean).join(' ');

const normalizeIcon = (icon: React.ReactNode) => {
  if (!React.isValidElement(icon)) return icon;
  const existing = (icon.props as { className?: string })?.className;
  return React.cloneElement(icon as React.ReactElement<{ className?: string; 'aria-hidden'?: boolean }>, {
    className: cx('h-4 w-4 shrink-0 text-current opacity-100', existing),
    'aria-hidden': true
  });
};

export function ListingFiltersCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('card p-4', className)}>{children}</div>;
}

export function ListingFiltersGrid({
  children,
  columnsClassName = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
}: {
  children: React.ReactNode;
  columnsClassName?: string;
}) {
  return <div className={cx('grid gap-4', columnsClassName)}>{children}</div>;
}

export function ListingFilterField({
  label,
  htmlFor,
  children
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

export function ListingTableCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('card overflow-hidden', className)}>{children}</div>;
}

export function ListingTableScroller({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function ListingStateRow({
  colSpan,
  text
}: {
  colSpan: number;
  text: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-8 text-center text-muted-foreground">
        {text}
      </td>
    </tr>
  );
}

export function ListingPagination({
  page,
  limit,
  total,
  loading,
  onPrevious,
  onNext,
  showRange = true,
  itemLabel = 'results'
}: {
  page: number;
  limit: number;
  total: number;
  loading?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  showRange?: boolean;
  itemLabel?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(limit, 1)));
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = total === 0 ? 0 : Math.min(page * limit, total);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
      {showRange ? (
        <div>
          Showing <span className="font-medium">{start}</span> to <span className="font-medium">{end}</span> of{' '}
          <span className="font-medium">{total}</span> {itemLabel}
        </div>
      ) : (
        <div>
          Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-outline disabled:opacity-50"
          onClick={onPrevious}
          disabled={loading || page <= 1}
        >
          Previous
        </button>
        <span className="px-3 py-1">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-outline disabled:opacity-50"
          onClick={onNext}
          disabled={loading || page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function AdminLoadingState({
  label = 'Loading…',
  className
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cx('flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground', className)}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function IconActionButton({
  title,
  ariaLabel,
  onClick,
  href,
  icon,
  target,
  rel,
  destructive = false,
  disabled = false
}: {
  title: string;
  ariaLabel?: string;
  onClick?: () => void;
  href?: string;
  icon: React.ReactNode;
  target?: string;
  rel?: string;
  destructive?: boolean;
  disabled?: boolean;
}) {
  const baseClass = cx(
    'btn btn-outline btn-sm h-8 w-8 p-0 border-border/80 bg-background text-foreground shadow-sm hover:bg-muted/70',
    destructive
      ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-900/60'
      : ''
  );
  const renderedIcon = normalizeIcon(icon);

  if (href) {
    return (
      <a
        href={href}
        className={baseClass}
        title={title}
        aria-label={ariaLabel ?? title}
        target={target}
        rel={rel}
      >
        <span className="inline-flex items-center justify-center text-current">{renderedIcon}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      className={baseClass}
      title={title}
      aria-label={ariaLabel ?? title}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="inline-flex items-center justify-center text-current">{renderedIcon}</span>
    </button>
  );
}
