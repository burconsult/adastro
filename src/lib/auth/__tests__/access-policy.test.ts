import { describe, expect, it } from 'vitest';
import {
  buildInvitePasswordSetupPath,
  canRoleAccessAdminPath,
  defaultPathForRole,
  resolveRoleSafeRedirect
} from '../access-policy';

describe('auth access policy', () => {
  it('resolves default paths by role', () => {
    expect(defaultPathForRole('admin')).toBe('/admin');
    expect(defaultPathForRole('author')).toBe('/admin/posts');
    expect(defaultPathForRole('reader')).toBe('/profile');
    expect(defaultPathForRole('unknown')).toBe('/profile');
  });

  it('enforces admin route access by role', () => {
    expect(canRoleAccessAdminPath('admin', '/admin/users')).toBe(true);
    expect(canRoleAccessAdminPath('author', '/admin/posts')).toBe(true);
    expect(canRoleAccessAdminPath('author', '/admin/media/upload')).toBe(true);
    expect(canRoleAccessAdminPath('author', '/admin/users')).toBe(false);
    expect(canRoleAccessAdminPath('reader', '/admin/posts')).toBe(false);
    expect(canRoleAccessAdminPath('reader', '/profile')).toBe(true);
  });

  it('returns safe role-aware redirect paths', () => {
    expect(resolveRoleSafeRedirect('admin', '/admin/users')).toBe('/admin/users');
    expect(resolveRoleSafeRedirect('author', '/admin/users')).toBe('/admin/posts');
    expect(resolveRoleSafeRedirect('author', '/admin/posts/edit/123')).toBe('/admin/posts/edit/123');
    expect(resolveRoleSafeRedirect('reader', '/admin')).toBe('/profile');
    expect(resolveRoleSafeRedirect('reader', 'https://evil.example')).toBe('/profile');
  });

  it('builds invite setup path with encoded next destination', () => {
    expect(buildInvitePasswordSetupPath('admin')).toBe('/auth/reset-password?next=%2Fadmin');
    expect(buildInvitePasswordSetupPath('author')).toBe('/auth/reset-password?next=%2Fadmin%2Fposts');
    expect(buildInvitePasswordSetupPath('reader')).toBe('/auth/reset-password?next=%2Fprofile');
  });
});
