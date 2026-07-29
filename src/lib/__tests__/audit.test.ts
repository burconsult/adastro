import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn()
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  supabaseAdmin: {
    from: mocks.from,
    rpc: mocks.rpc
  }
}));

import { pruneAuditEvents, recordAuditEvent } from '../audit';

describe('audit service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.rpc.mockResolvedValue({ data: 7, error: null });
  });

  it('records actor and entity metadata without sensitive values', async () => {
    await recordAuditEvent({
      actor: { id: 'user-1', email: 'admin@example.com', role: 'admin' },
      action: 'setting.update',
      entityType: 'setting',
      entityId: 'mail.provider',
      metadata: {
        keys: ['mail.provider'],
        nested: {
          password: 'must-not-survive',
          apiKey: 'must-not-survive',
          changed: true
        }
      }
    });

    expect(mocks.from).toHaveBeenCalledWith('audit_events');
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      actor_user_id: 'user-1',
      actor_label: 'admin@example.com',
      actor_role: 'admin',
      action: 'setting.update',
      entity_type: 'setting',
      metadata: {
        keys: ['mail.provider'],
        nested: { changed: true }
      }
    }));
  });

  it('bounds retention between 30 days and 10 years', async () => {
    await pruneAuditEvents(1);
    expect(mocks.rpc).toHaveBeenLastCalledWith('prune_audit_events', {
      retention_days: 30
    });

    await pruneAuditEvents(99999);
    expect(mocks.rpc).toHaveBeenLastCalledWith('prune_audit_events', {
      retention_days: 3650
    });
  });
});
