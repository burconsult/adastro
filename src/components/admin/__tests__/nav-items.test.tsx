import { describe, expect, it } from 'vitest';
import { resolveAdminNavItems } from '@/components/admin/nav-items';

describe('resolveAdminNavItems', () => {
  it('hides comments sub-navigation when comments feature is unavailable', () => {
    const items = resolveAdminNavItems('/admin/features', { commentsActive: false });
    const hrefs = items.map((item) => item.href);

    expect(hrefs).not.toContain('/admin/features/comments');
  });

  it('shows comments sub-navigation by default', () => {
    const items = resolveAdminNavItems('/admin/features/comments');
    const hrefs = items.map((item) => item.href);

    expect(hrefs).toContain('/admin/features/comments');
  });

  it('hides ai sub-navigation when ai feature is unavailable', () => {
    const items = resolveAdminNavItems('/admin/features', { aiActive: false });
    const hrefs = items.map((item) => item.href);

    expect(hrefs).not.toContain('/admin/features/ai');
  });

  it('shows newsletter feature sub-navigation by default', () => {
    const items = resolveAdminNavItems('/admin/features/newsletter');
    const hrefs = items.map((item) => item.href);

    expect(hrefs).toContain('/admin/features/newsletter');
  });

  it('hides newsletter feature sub-navigation when feature is unavailable', () => {
    const items = resolveAdminNavItems('/admin/features', { newsletterActive: false });
    const hrefs = items.map((item) => item.href);

    expect(hrefs).not.toContain('/admin/features/newsletter');
  });

  it('marks dashboard as active only for exact /admin path', () => {
    const dashboardAtRoot = resolveAdminNavItems('/admin').find((item) => item.href === '/admin');
    const dashboardAtPosts = resolveAdminNavItems('/admin/posts').find((item) => item.href === '/admin');

    expect(dashboardAtRoot?.isActive).toBe(true);
    expect(dashboardAtPosts?.isActive).toBe(false);
  });

  it('marks section links active for nested paths', () => {
    const posts = resolveAdminNavItems('/admin/posts/edit/123').find((item) => item.href === '/admin/posts');
    const settings = resolveAdminNavItems('/admin/settings/advanced').find((item) => item.href === '/admin/settings');

    expect(posts?.isActive).toBe(true);
    expect(settings?.isActive).toBe(true);
  });
});
