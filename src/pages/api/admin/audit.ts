import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/auth/auth-helpers';
import {
  exportAuditEvents,
  listAuditEvents,
  pruneAuditEvents,
  recordAuditEvent
} from '@/lib/audit';

const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

const csvCell = (value: unknown): string => {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
};

const parseLimit = (value: string | null, fallback: number, max: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), max) : fallback;
};

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const format = url.searchParams.get('format');
    const filters = {
      actorUserId: url.searchParams.get('actor') || undefined,
      action: url.searchParams.get('action') || undefined,
      entityType: url.searchParams.get('entityType') || undefined,
      search: url.searchParams.get('search') || undefined
    };
    if (format === 'csv' || format === 'json') {
      const exported = await exportAuditEvents(
        filters,
        parseLimit(url.searchParams.get('limit'), 5000, 5000)
      );
      if (format === 'json') {
        return new Response(JSON.stringify({
          exportedAt: new Date().toISOString(),
          truncated: exported.truncated,
          events: exported.events
        }, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename="adastro-audit-events.json"',
            'X-Audit-Export-Truncated': exported.truncated ? '1' : '0'
          }
        });
      }

      const header = [
        'created_at', 'actor', 'actor_role', 'action', 'entity_type',
        'entity_id', 'entity_label', 'source', 'metadata'
      ];
      const rows = exported.events.map((event) => [
        event.createdAt,
        event.actorLabel,
        event.actorRole,
        event.action,
        event.entityType,
        event.entityId,
        event.entityLabel,
        event.source,
        event.metadata
      ].map(csvCell).join(','));
      return new Response([header.join(','), ...rows].join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="adastro-audit-events.csv"',
          'X-Audit-Export-Truncated': exported.truncated ? '1' : '0'
        }
      });
    }

    const result = await listAuditEvents({
      ...filters,
      cursor: url.searchParams.get('cursor') || undefined,
      limit: parseLimit(url.searchParams.get('limit'), 50, 100)
    });
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load audit events';
    const status = message.includes('Authentication required')
      ? 401
      : message.includes('Admin access required')
        ? 403
        : 500;
    return json({ error: message }, status);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const requestedRetentionDays = Number.parseInt(String(body.retentionDays ?? ''), 10);
    if (
      !Number.isFinite(requestedRetentionDays)
      || requestedRetentionDays < 30
      || requestedRetentionDays > 3650
    ) {
      return json({ error: 'Retention must be between 30 and 3650 days' }, 400);
    }
    const retentionDays = requestedRetentionDays;

    const deleted = await pruneAuditEvents(retentionDays);
    await recordAuditEvent({
      actor: admin,
      action: 'audit.prune',
      entityType: 'audit',
      metadata: { retentionDays, deleted }
    });
    return json({ success: true, deleted, retentionDays });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to prune audit events';
    const status = message.includes('Authentication required')
      ? 401
      : message.includes('Admin access required')
        ? 403
        : 500;
    return json({ error: message }, status);
  }
};
