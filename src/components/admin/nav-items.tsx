import React from 'react';
import {
  Bot,
  ChartColumn,
  Database,
  FileText,
  Files,
  FolderTree,
  Images,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Palette,
  Settings,
  SlidersHorizontal,
  Tags,
  Users
} from 'lucide-react';

export type AdminNavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  parentHref?: string;
};

export type ResolvedAdminNavItem = AdminNavItem & {
  isActive: boolean;
};

export type AdminNavVisibility = {
  aiActive?: boolean;
  commentsActive?: boolean;
  newsletterActive?: boolean;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    href: '/admin',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />
  },
  {
    href: '/admin/posts',
    label: 'Posts',
    icon: <FileText className="h-4 w-4" />
  },
  {
    href: '/admin/pages',
    label: 'Pages',
    icon: <Files className="h-4 w-4" />
  },
  {
    href: '/admin/migration',
    label: 'Migration',
    icon: <Database className="h-4 w-4" />
  },
  {
    href: '/admin/analytics',
    label: 'Analytics',
    icon: <ChartColumn className="h-4 w-4" />
  },
  {
    href: '/admin/media',
    label: 'Media',
    icon: <Images className="h-4 w-4" />
  },
  {
    href: '/admin/categories',
    label: 'Categories',
    icon: <FolderTree className="h-4 w-4" />
  },
  {
    href: '/admin/tags',
    label: 'Tags',
    icon: <Tags className="h-4 w-4" />
  },
  {
    href: '/admin/users',
    label: 'Users',
    icon: <Users className="h-4 w-4" />
  },
  {
    href: '/admin/features',
    label: 'Features',
    icon: <SlidersHorizontal className="h-4 w-4" />
  },
  {
    href: '/admin/features/ai',
    label: 'AI Suite',
    parentHref: '/admin/features',
    icon: <Bot className="h-4 w-4" />
  },
  {
    href: '/admin/features/comments',
    label: 'Comments',
    parentHref: '/admin/features',
    icon: <MessageSquare className="h-4 w-4" />
  },
  {
    href: '/admin/features/newsletter',
    label: 'Newsletter',
    parentHref: '/admin/features',
    icon: <Mail className="h-4 w-4" />
  },
  {
    href: '/admin/themes',
    label: 'Themes',
    icon: <Palette className="h-4 w-4" />
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    icon: <Settings className="h-4 w-4" />
  }
];

export const resolveAdminNavItems = (
  currentPath: string,
  visibility: AdminNavVisibility = {}
): ResolvedAdminNavItem[] => (
  ADMIN_NAV_ITEMS
    .filter((item) => {
      if (item.href === '/admin/features/ai' && visibility.aiActive === false) {
        return false;
      }
      if (item.href === '/admin/features/comments' && visibility.commentsActive === false) {
        return false;
      }
      if (item.href === '/admin/features/newsletter' && visibility.newsletterActive === false) {
        return false;
      }
      return true;
    })
    .map((item) => ({
    ...item,
    isActive:
      currentPath === item.href
      || (item.href !== '/admin' && currentPath.startsWith(item.href))
  }))
);
