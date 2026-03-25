import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getSetting: vi.fn(),
  from: vi.fn()
}));

vi.mock('@/lib/auth/auth-helpers', () => ({
  requireAdmin: mocks.requireAdmin
}));

vi.mock('@/lib/services/settings-service', () => ({
  SettingsService: vi.fn().mockImplementation(() => ({
    getSetting: mocks.getSetting
  }))
}));

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from
  }
}));

import { GET, POST } from '../retention';

type AnalyticsRouteMockOptions = {
  totalCount: number;
  prunableCount: number;
  oldestEventAt?: string | null;
  newestEventAt?: string | null;
  archiveRows?: Array<Record<string, unknown>>;
  deleteError?: { message: string } | null;
};

const createAnalyticsEventsTableMock = ({
  totalCount,
  prunableCount,
  oldestEventAt = '2025-05-01T00:00:00.000Z',
  newestEventAt = '2026-03-25T12:00:00.000Z',
  archiveRows = [],
  deleteError = null
}: AnalyticsRouteMockOptions) => ({
  select: vi.fn((columns: string, options?: { count?: string; head?: boolean }) => {
    if (options?.head) {
      return {
        count: totalCount,
        error: null,
        lt: () => ({
          count: prunableCount,
          error: null
        })
      };
    }

    if (columns === 'created_at') {
      return {
        order: (_column: string, orderOptions: { ascending: boolean }) => ({
          limit: () => ({
            maybeSingle: () => ({
              data: {
                created_at: orderOptions.ascending ? oldestEventAt : newestEventAt
              },
              error: null
            })
          })
        })
      };
    }

    return {
      lt: () => ({
        order: () => ({
          range: (from: number, to: number) => ({
            data: archiveRows.slice(from, to + 1),
            error: null
          })
        })
      })
    };
  }),
  delete: vi.fn(() => ({
    lt: () => ({
      error: deleteError
    })
  }))
});

describe('admin analytics retention api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T12:00:00.000Z'));

    mocks.requireAdmin.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mocks.getSetting.mockResolvedValue({
      retentionDays: 30,
      warnAtRowCount: 1000,
      archiveBeforePrune: true
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the retention summary with warning status', async () => {
    mocks.from.mockImplementation((table: string) => {
      expect(table).toBe('analytics_events');
      return createAnalyticsEventsTableMock({
        totalCount: 1200,
        prunableCount: 45
      });
    });

    const request = new Request('https://www.adastro.no/api/admin/analytics/retention');
    const response = await GET({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      totalRows: 1200,
      prunableRows: 45,
      oldestEventAt: '2025-05-01T00:00:00.000Z',
      newestEventAt: '2026-03-25T12:00:00.000Z',
      overWarnThreshold: true
    });
    expect(payload.pruneBefore).toBe('2026-02-23T12:00:00.000Z');
  });

  it('exports archived analytics rows with archive metadata headers', async () => {
    mocks.from.mockImplementation((table: string) => {
      expect(table).toBe('analytics_events');
      return createAnalyticsEventsTableMock({
        totalCount: 120,
        prunableCount: 1,
        archiveRows: [
          {
            id: 'evt-1',
            event_type: 'pageview',
            entity_type: 'page',
            entity_id: '/blog/launch',
            data: { path: '/blog/launch' },
            user_agent: 'Mozilla/5.0',
            ip_address: '127.0.0.1',
            created_at: '2025-02-01T12:00:00.000Z'
          }
        ]
      });
    });

    const request = new Request('https://www.adastro.no/api/admin/analytics/retention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'export' })
    });

    const response = await POST({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Analytics-Archive-Truncated')).toBe('0');
    expect(response.headers.get('X-Analytics-Archive-Row-Count')).toBe('1');
    expect(response.headers.get('X-Analytics-Archive-Prune-Before')).toBe('2026-02-23T12:00:00.000Z');
    expect(response.headers.get('Content-Disposition')).toContain('analytics-archive-before-2026-02-23.json');
    expect(payload.rowCount).toBe(1);
    expect(payload.rows[0].id).toBe('evt-1');
  });

  it('requires archive acknowledgment before pruning', async () => {
    mocks.from.mockImplementation((table: string) => {
      expect(table).toBe('analytics_events');
      return createAnalyticsEventsTableMock({
        totalCount: 120,
        prunableCount: 45
      });
    });

    const request = new Request('https://www.adastro.no/api/admin/analytics/retention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'prune' })
    });

    const response = await POST({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/archive download must be acknowledged/i);
  });

  it('prunes archived analytics rows once archive acknowledgment is present', async () => {
    const tableMock = createAnalyticsEventsTableMock({
      totalCount: 120,
      prunableCount: 45
    });
    mocks.from.mockImplementation((table: string) => {
      expect(table).toBe('analytics_events');
      return tableMock;
    });

    const request = new Request('https://www.adastro.no/api/admin/analytics/retention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'prune',
        archiveAcknowledged: true
      })
    });

    const response = await POST({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.prunedRows).toBe(45);
    expect(tableMock.delete).toHaveBeenCalledTimes(1);
  });
});
