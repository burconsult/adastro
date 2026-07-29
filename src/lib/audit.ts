import { Buffer } from 'node:buffer';
import type { AuthUser } from './auth/auth-helpers.js';
import { DatabaseError } from './database/connection.js';
import { supabaseAdmin } from './supabase.js';

export type AuditSource = 'admin' | 'api' | 'mcp' | 'system' | 'migration';

export type AuditEvent = {
  id: string;
  actorUserId: string | null;
  actorLabel: string;
  actorRole: 'admin' | 'author' | 'reader' | 'system';
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  metadata: Record<string, unknown>;
  source: AuditSource;
  createdAt: string;
};

export type RecordAuditEventInput = {
  actor?: Pick<AuthUser, 'id' | 'email' | 'role'> | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  metadata?: Record<string, unknown>;
  source?: AuditSource;
};

export type AuditEventFilters = {
  actorUserId?: string;
  action?: string;
  entityType?: string;
  search?: string;
  cursor?: string;
  limit?: number;
};

type AuditCursor = {
  createdAt: string;
  id: string;
};

const SENSITIVE_KEY_PATTERN = /(password|secret|token|authorization|cookie|api[-_]?key)/i;

const sanitizeValue = (value: unknown, depth = 0): unknown => {
  if (depth > 4 || value === null || value === undefined) return null;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 500);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !SENSITIVE_KEY_PATTERN.test(key))
        .slice(0, 50)
        .map(([key, item]) => [key.slice(0, 100), sanitizeValue(item, depth + 1)])
    );
  }
  return String(value).slice(0, 500);
};

const sanitizeMetadata = (metadata: Record<string, unknown> | undefined): Record<string, unknown> => (
  (sanitizeValue(metadata ?? {}) as Record<string, unknown>) ?? {}
);

const normalizeRole = (role: string | undefined): AuditEvent['actorRole'] => {
  if (role === 'admin' || role === 'author' || role === 'reader') return role;
  return 'system';
};

const mapEvent = (row: any): AuditEvent => ({
  id: row.id,
  actorUserId: row.actor_user_id ?? null,
  actorLabel: row.actor_label,
  actorRole: normalizeRole(row.actor_role),
  action: row.action,
  entityType: row.entity_type,
  entityId: row.entity_id ?? null,
  entityLabel: row.entity_label ?? null,
  metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
  source: row.source,
  createdAt: row.created_at
});

const encodeCursor = (cursor: AuditCursor): string => (
  Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
);

const decodeCursor = (value: string | undefined): AuditCursor | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      parsed
      && typeof parsed.createdAt === 'string'
      && !Number.isNaN(Date.parse(parsed.createdAt))
      && typeof parsed.id === 'string'
    ) {
      return parsed;
    }
  } catch {
    // Invalid cursors are treated as the first page.
  }
  return null;
};

const sanitizeSearch = (value: string): string => value.replace(/[%_,()]/g, ' ').trim().slice(0, 100);

export const recordAuditEvent = async (input: RecordAuditEventInput): Promise<void> => {
  const actor = input.actor ?? null;
  const { error } = await (supabaseAdmin as any).from('audit_events').insert({
    actor_user_id: actor?.id ?? null,
    actor_label: (actor?.email || 'System').slice(0, 320),
    actor_role: normalizeRole(actor?.role),
    action: input.action.trim().slice(0, 100),
    entity_type: input.entityType.trim().slice(0, 100),
    entity_id: input.entityId?.slice(0, 500) ?? null,
    entity_label: input.entityLabel?.slice(0, 500) ?? null,
    metadata: sanitizeMetadata(input.metadata),
    source: input.source ?? (actor ? 'admin' : 'system')
  });

  if (error) {
    throw new DatabaseError(`Failed to record audit event: ${error.message}`);
  }
};

export const listAuditEvents = async (
  filters: AuditEventFilters = {}
): Promise<{ events: AuditEvent[]; nextCursor: string | null }> => {
  const limit = Math.min(Math.max(Math.trunc(filters.limit ?? 50), 1), 100);
  const cursor = decodeCursor(filters.cursor);
  let query = (supabaseAdmin as any)
    .from('audit_events')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (filters.actorUserId) query = query.eq('actor_user_id', filters.actorUserId);
  if (filters.action) query = query.eq('action', filters.action);
  if (filters.entityType) query = query.eq('entity_type', filters.entityType);
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    );
  }
  if (filters.search) {
    const search = sanitizeSearch(filters.search);
    if (search) query = query.or(`actor_label.ilike.%${search}%,entity_label.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new DatabaseError(`Failed to list audit events: ${error.message}`);

  const rows = (data ?? []) as any[];
  const hasMore = rows.length > limit;
  const visibleRows = hasMore ? rows.slice(0, limit) : rows;
  const events = visibleRows.map(mapEvent);
  const last = events.at(-1);

  return {
    events,
    nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null
  };
};

export const exportAuditEvents = async (
  filters: Omit<AuditEventFilters, 'cursor' | 'limit'> = {},
  maximumRows = 5000
): Promise<{ events: AuditEvent[]; truncated: boolean }> => {
  const cap = Math.min(Math.max(Math.trunc(maximumRows), 1), 5000);
  const events: AuditEvent[] = [];
  let cursor: string | undefined;

  do {
    const page = await listAuditEvents({
      ...filters,
      cursor,
      limit: Math.min(100, cap - events.length)
    });
    events.push(...page.events);
    cursor = page.nextCursor ?? undefined;
  } while (cursor && events.length < cap);

  return { events, truncated: Boolean(cursor) };
};

export const pruneAuditEvents = async (retentionDays: number): Promise<number> => {
  const safeDays = Math.min(Math.max(Math.trunc(retentionDays), 30), 3650);
  const { data, error } = await (supabaseAdmin as any).rpc('prune_audit_events', {
    retention_days: safeDays
  });
  if (error) throw new DatabaseError(`Failed to prune audit events: ${error.message}`);
  return typeof data === 'number' ? data : Number(data) || 0;
};
