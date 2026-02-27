import { SettingsService } from '@/lib/services/settings-service.js';
import { supabaseAdmin } from '@/lib/supabase.js';
import { normalizeFeatureFlag } from '@/lib/features/flags';
import type { AiCapability, AiProviderId } from './types.js';

type UsageEventPayload = {
  capability: AiCapability;
  operation: string;
  provider: AiProviderId | string;
  model?: string | null;
  authUserId?: string | null;
  authorId?: string | null;
  requestCount?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  metadata?: Record<string, unknown>;
};

type UsageRollup = {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

const settingsService = new SettingsService();

const usageCapSettings = {
  enabled: 'features.ai.usageCaps.enabled',
  seo: 'features.ai.usageCaps.seoDailyRequests',
  image: 'features.ai.usageCaps.imageDailyRequests',
  audio: 'features.ai.usageCaps.audioDailyRequests'
} as const;

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const startOfUtcDayIso = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
};

const emptyRollup = (): UsageRollup => ({
  requests: 0,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0
});

const getUsageCapKey = (operation: 'seo' | 'image' | 'audio') => usageCapSettings[operation];

const aggregateRollup = (rows: Array<Record<string, unknown>>): UsageRollup => {
  const rollup = emptyRollup();
  for (const row of rows) {
    rollup.requests += toNumber(row.request_count, 0);
    rollup.inputTokens += toNumber(row.input_tokens, 0);
    rollup.outputTokens += toNumber(row.output_tokens, 0);
    rollup.totalTokens += toNumber(row.total_tokens, 0);
  }
  return rollup;
};

const readUsageRows = async (filter: {
  sinceIso: string;
  authUserId?: string;
  capability?: AiCapability;
}) => {
  let query = (supabaseAdmin as any)
    .from('ai_usage_events')
    .select('capability, provider, model, request_count, input_tokens, output_tokens, total_tokens, created_at, operation')
    .gte('created_at', filter.sinceIso);

  if (filter.authUserId) {
    query = query.eq('auth_user_id', filter.authUserId);
  }
  if (filter.capability) {
    query = query.eq('capability', filter.capability);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || 'Failed to read AI usage rows');
  }
  return Array.isArray(data) ? data : [];
};

export const checkUsageCap = async (params: {
  operation: 'seo' | 'image' | 'audio';
  capability: AiCapability;
  authUserId?: string;
}): Promise<{ allowed: boolean; limit?: number; used?: number; retryAt?: string }> => {
  const authUserId = params.authUserId?.trim();
  if (!authUserId) {
    return { allowed: true };
  }

  try {
    const settings = await settingsService.getSettings([
      usageCapSettings.enabled,
      usageCapSettings.seo,
      usageCapSettings.image,
      usageCapSettings.audio
    ]);

    if (!normalizeFeatureFlag(settings[usageCapSettings.enabled], false)) {
      return { allowed: true };
    }

    const capKey = getUsageCapKey(params.operation);
    const limit = Math.max(0, Math.floor(toNumber(settings[capKey], 0)));
    if (limit <= 0) {
      return { allowed: true };
    }

    const sinceIso = startOfUtcDayIso();
    const rows = await readUsageRows({
      sinceIso,
      authUserId,
      capability: params.capability
    });
    const used = aggregateRollup(rows).requests;
    if (used >= limit) {
      const tomorrow = new Date(sinceIso);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      return {
        allowed: false,
        limit,
        used,
        retryAt: tomorrow.toISOString()
      };
    }
    return { allowed: true, limit, used };
  } catch (error) {
    console.warn('AI usage cap check failed. Failing open for safety.', error);
    return { allowed: true };
  }
};

export const recordUsageEvent = async (payload: UsageEventPayload): Promise<void> => {
  try {
    const record = {
      capability: payload.capability,
      operation: payload.operation,
      provider: payload.provider,
      model: payload.model ?? null,
      auth_user_id: payload.authUserId ?? null,
      author_id: payload.authorId ?? null,
      request_count: payload.requestCount ?? 1,
      input_tokens: payload.inputTokens ?? null,
      output_tokens: payload.outputTokens ?? null,
      total_tokens: payload.totalTokens ?? null,
      metadata: payload.metadata ?? {}
    };
    const { error } = await (supabaseAdmin as any).from('ai_usage_events').insert(record);
    if (error) {
      throw new Error(error.message || 'Failed to store AI usage event');
    }
  } catch (error) {
    console.warn('AI usage event logging skipped:', error);
  }
};

export const getUsageSummary = async (days = 30) => {
  const normalizedDays = Math.max(1, Math.min(90, Math.floor(days)));
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - normalizedDays + 1);
  since.setUTCHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  const rows = await readUsageRows({ sinceIso });
  const byCapability: Record<string, UsageRollup> = {};
  const byProvider: Record<string, UsageRollup & { capabilities: string[] }> = {};
  const byDay: Record<string, UsageRollup> = {};
  const totals = emptyRollup();

  for (const row of rows) {
    const requestCount = toNumber(row.request_count, 1);
    const inputTokens = toNumber(row.input_tokens, 0);
    const outputTokens = toNumber(row.output_tokens, 0);
    const totalTokens = toNumber(row.total_tokens, inputTokens + outputTokens);
    const capability = typeof row.capability === 'string' ? row.capability : 'unknown';
    const provider = typeof row.provider === 'string' ? row.provider : 'unknown';
    const createdAt = typeof row.created_at === 'string' ? row.created_at : new Date().toISOString();
    const day = createdAt.slice(0, 10);

    totals.requests += requestCount;
    totals.inputTokens += inputTokens;
    totals.outputTokens += outputTokens;
    totals.totalTokens += totalTokens;

    if (!byCapability[capability]) byCapability[capability] = emptyRollup();
    byCapability[capability].requests += requestCount;
    byCapability[capability].inputTokens += inputTokens;
    byCapability[capability].outputTokens += outputTokens;
    byCapability[capability].totalTokens += totalTokens;

    if (!byProvider[provider]) {
      byProvider[provider] = { ...emptyRollup(), capabilities: [] };
    }
    byProvider[provider].requests += requestCount;
    byProvider[provider].inputTokens += inputTokens;
    byProvider[provider].outputTokens += outputTokens;
    byProvider[provider].totalTokens += totalTokens;
    if (!byProvider[provider].capabilities.includes(capability)) {
      byProvider[provider].capabilities.push(capability);
    }

    if (!byDay[day]) byDay[day] = emptyRollup();
    byDay[day].requests += requestCount;
    byDay[day].inputTokens += inputTokens;
    byDay[day].outputTokens += outputTokens;
    byDay[day].totalTokens += totalTokens;
  }

  return {
    days: normalizedDays,
    since: sinceIso,
    totals,
    byCapability,
    byProvider,
    byDay
  };
};
