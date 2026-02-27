import React, { useMemo } from 'react';
import { resolveAdminNavItems } from '@/components/admin/nav-items';

interface AdminSidebarProps {
  currentPath: string;
  aiActive?: boolean;
  commentsActive?: boolean;
  newsletterActive?: boolean;
}

export default function AdminSidebar({
  currentPath,
  aiActive = false,
  commentsActive = false,
  newsletterActive = false
}: AdminSidebarProps) {

  const items = useMemo(
    () => resolveAdminNavItems(currentPath, { aiActive, commentsActive, newsletterActive }),
    [aiActive, commentsActive, currentPath, newsletterActive]
  );

  return (
    <aside className="flex h-full w-64 min-w-64 flex-col border-r border-border bg-card/35">
      <div className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Admin
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-6">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            aria-current={item.isActive ? 'page' : undefined}
            className={`group flex items-center gap-3 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              item.parentHref ? 'ml-6 text-xs' : ''
            } ${
              item.isActive
                ? 'border-primary/25 bg-primary/10 text-foreground'
                : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/70 hover:text-foreground'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </aside>
  );
}
