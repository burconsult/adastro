import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listAuditEvents: vi.fn(),
  exportAuditEvents: vi.fn(),
  pruneAuditEvents: vi.fn(),
  recordAuditEvent: vi.fn()
}));

vi.mock('@/lib/auth/auth-helpers', () => ({
  requireAdmin: mocks.requireAdmin
}));

vi.mock('@/lib/audit', () => ({
  listAuditEvents: mocks.listAuditEvents,
  exportAuditEvents: mocks.exportAuditEvents,
  pruneAuditEvents: mocks.pruneAuditEvents,
  recordAuditEvent: mocks.recordAuditEvent
}));

import { GET, POST } from '../audit';

describe('admin audit API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin'
    });
    mocks.listAuditEvents.mockResolvedValue({
      events: [{
        id: 'event-1',
        actorLabel: 'admin@example.com',
        actorRole: 'admin',
        action: 'post.update',
        entityType: 'post',
        entityId: 'post-1',
        entityLabel: 'Launch',
        metadata: {},
        source: 'admin',
        createdAt: '2026-07-29T12:00:00.000Z'
      }],
      nextCursor: null
    });
    mocks.exportAuditEvents.mockResolvedValue({
      events: [{
        id: 'event-1',
        actorLabel: 'admin@example.com',
        actorRole: 'admin',
        action: 'post.update',
        entityType: 'post',
        entityId: 'post-1',
        entityLabel: 'Launch',
        metadata: {},
        source: 'admin',
        createdAt: '2026-07-29T12:00:00.000Z'
      }],
      truncated: false
    });
  });

  it('returns filtered audit events to admins', async () => {
    const request = new Request(
      'https://www.adastro.no/api/admin/audit?entityType=post&action=post.update&limit=25'
    );
    const response = await GET({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.events).toHaveLength(1);
    expect(mocks.listAuditEvents).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'post',
      action: 'post.update',
      limit: 25
    }));
  });

  it('exports filtered events as CSV', async () => {
    const request = new Request('https://www.adastro.no/api/admin/audit?format=csv');
    const response = await GET({ request } as any);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Disposition')).toContain('adastro-audit-events.csv');
    expect(text).toContain('"post.update"');
  });

  it('prunes through the bounded retention worker and records the action', async () => {
    mocks.pruneAuditEvents.mockResolvedValue(12);
    const request = new Request('https://www.adastro.no/api/admin/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retentionDays: 365 })
    });
    const response = await POST({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.deleted).toBe(12);
    expect(mocks.pruneAuditEvents).toHaveBeenCalledWith(365);
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'audit.prune'
    }));
  });
});
