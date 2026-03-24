import React, { useMemo } from 'react';
import { resolveAdminNavItems } from '@/components/admin/nav-items';
import { ChevronDown } from 'lucide-react';

interface AdminMobileNavProps {
  currentPath: string;
  aiActive?: boolean;
  commentsActive?: boolean;
  newsletterActive?: boolean;
}

export default function AdminMobileNav({
  currentPath,
  aiActive = false,
  commentsActive = false,
  newsletterActive = false
}: AdminMobileNavProps) {
  const items = useMemo(
    () => resolveAdminNavItems(currentPath, { aiActive, commentsActive, newsletterActive }),
    [aiActive, commentsActive, currentPath, newsletterActive]
  );
  const activeItem = items.find((item) => item.isActive) ?? items[0];

  return (
    <nav aria-label="Admin mobile navigation" className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground lg:hidden">
      <details className="group px-4 py-2 sm:px-6">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-md border border-sidebar-border bg-sidebar/80 px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors group-open:bg-sidebar-accent group-open:text-sidebar-accent-foreground">
          <span className="inline-flex items-center gap-2">
            {activeItem?.icon}
            <span>{activeItem?.label ?? 'Navigation'}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-sidebar-foreground/70 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-2 grid gap-2 pb-2">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.isActive ? 'page' : undefined}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                item.parentHref ? 'ml-4 text-xs' : ''
              } ${
                item.isActive
                  ? 'border-sidebar-primary/30 bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'border-transparent text-sidebar-foreground/75 hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      </details>
    </nav>
  );
}
