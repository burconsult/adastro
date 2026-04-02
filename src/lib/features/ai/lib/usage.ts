import { SettingsService } from '@/lib/services/settings-service.js';
import { supabaseAdmin } from '@/lib/supabase.js';
import { normalizeFeatureFlag } from '@/lib/features/flags';
import { ensureAiSettingsUpgraded } from './settings-upgrade.js';
import { estimateUsageCost } from './pricing.js';
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

export type UsageCostRollup = {
  estimatedUsd: number;
  minimumUsd: number;
  maximumUsd: number;
  exactRequests: number;
  estimatedRequests: number;
  rangeRequests: number;
  pricedRequests: number;
  unpricedRequests: number;
};

export type UsageRollup = {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costs: UsageCostRollup;
};

const settingsService = new SettingsService();

const usageCapSettings = {
  enabled: 'features.ai.limits.enabled',
  seo: 'features.ai.limits.seoDailyRequests',
  image: 'features.ai.limits.imageDailyRequests',
  audio: 'features.ai.limits.audioDailyRequests'
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
  totalTokens: 0,
  costs: {
    estimatedUsd: 0,
    minimumUsd: 0,
    maximumUsd: 0,
    exactRequests: 0,
    estimatedRequests: 0,
    rangeRequests: 0,
    pricedRequests: 0,
    unpricedRequests: 0
  }
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

const trackCost = (rollup: UsageRollup, params: {
  requestCount: number;
  estimatedUsd: number;
  minimumUsd: number;
  maximumUsd: number;
  method: 'exact' | 'estimate' | 'range' | 'unpriced';
}) => {
  rollup.costs.estimatedUsd += params.estimatedUsd;
  rollup.costs.minimumUsd += params.minimumUsd;
  rollup.costs.maximumUsd += params.maximumUsd;

  if (params.method === 'exact') {
    rollup.costs.exactRequests += params.requestCount;
    rollup.costs.pricedRequests += params.requestCount;
    return;
  }

  if (params.method === 'estimate') {
    rollup.costs.estimatedRequests += params.requestCount;
    rollup.costs.pricedRequests += params.requestCount;
    return;
  }

  if (params.method === 'range') {
    rollup.costs.rangeRequests += params.requestCount;
    rollup.costs.pricedRequests += params.requestCount;
    return;
  }

  rollup.costs.unpricedRequests += params.requestCount;
};

const safeArrayPush = (bucket: string[], value: string) => {
  if (value && !bucket.includes(value)) {
    bucket.push(value);
  }
};

const readUsageRows = async (filter: {
  sinceIso: string;
  authUserId?: string;
  authorId?: string;
  capability?: AiCapability;
}) => {
  let query = (supabaseAdmin as any)
    .from('ai_usage_events')
    .select('capability, provider, model, request_count, input_tokens, output_tokens, total_tokens, created_at, operation, metadata')
    .gte('created_at', filter.sinceIso);

  if (filter.authUserId) {
    query = query.eq('auth_user_id', filter.authUserId);
  }
  if (filter.authorId) {
    query = query.eq('author_id', filter.authorId);
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
  authorId?: string;
}): Promise<{ allowed: boolean; limit?: number; used?: number; retryAt?: string }> => {
  const authUserId = params.authUserId?.trim();
  const authorId = params.authorId?.trim();
  if (!authUserId && !authorId) {
    return { allowed: true };
  }

  try {
    await ensureAiSettingsUpgraded(settingsService);
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
      authorId: authUserId ? undefined : authorId,
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
  const byProvider: Record<string, UsageRollup & { capabilities: string[]; operations: string[]; models: string[] }> = {};
  const byOperation: Record<string, UsageRollup & { capabilities: string[]; providers: string[]; models: string[] }> = {};
  const byModel: Record<string, UsageRollup & { capability: string; provider: string; model: string; operations: string[] }> = {};
  const byDay: Record<string, UsageRollup> = {};
  const totals = emptyRollup();

  for (const row of rows) {
    const requestCount = toNumber(row.request_count, 1);
    const inputTokens = toNumber(row.input_tokens, 0);
    const outputTokens = toNumber(row.output_tokens, 0);
    const totalTokens = toNumber(row.total_tokens, inputTokens + outputTokens);
    const capability = typeof row.capability === 'string' ? row.capability : 'unknown';
    const provider = typeof row.provider === 'string' ? row.provider : 'unknown';
    const model = typeof row.model === 'string' && row.model.trim().length > 0 ? row.model.trim() : 'unknown';
    const operation = typeof row.operation === 'string' && row.operation.trim().length > 0 ? row.operation.trim() : 'unknown';
    const createdAt = typeof row.created_at === 'string' ? row.created_at : new Date().toISOString();
    const day = createdAt.slice(0, 10);
    const costEstimate = estimateUsageCost({
      capability,
      provider,
      model: row.model as string | null | undefined,
      requestCount,
      inputTokens,
      outputTokens,
      metadata: typeof row.metadata === 'object' && row.metadata ? row.metadata as Record<string, unknown> : undefined
    });

    totals.requests += requestCount;
    totals.inputTokens += inputTokens;
    totals.outputTokens += outputTokens;
    totals.totalTokens += totalTokens;
    trackCost(totals, {
      requestCount,
      estimatedUsd: costEstimate.estimatedUsd,
      minimumUsd: costEstimate.minimumUsd,
      maximumUsd: costEstimate.maximumUsd,
      method: costEstimate.method
    });

    if (!byCapability[capability]) byCapability[capability] = emptyRollup();
    byCapability[capability].requests += requestCount;
    byCapability[capability].inputTokens += inputTokens;
    byCapability[capability].outputTokens += outputTokens;
    byCapability[capability].totalTokens += totalTokens;
    trackCost(byCapability[capability], {
      requestCount,
      estimatedUsd: costEstimate.estimatedUsd,
      minimumUsd: costEstimate.minimumUsd,
      maximumUsd: costEstimate.maximumUsd,
      method: costEstimate.method
    });

    if (!byProvider[provider]) {
      byProvider[provider] = { ...emptyRollup(), capabilities: [], operations: [], models: [] };
    }
    byProvider[provider].requests += requestCount;
    byProvider[provider].inputTokens += inputTokens;
    byProvider[provider].outputTokens += outputTokens;
    byProvider[provider].totalTokens += totalTokens;
    safeArrayPush(byProvider[provider].capabilities, capability);
    safeArrayPush(byProvider[provider].operations, operation);
    safeArrayPush(byProvider[provider].models, model);
    trackCost(byProvider[provider], {
      requestCount,
      estimatedUsd: costEstimate.estimatedUsd,
      minimumUsd: costEstimate.minimumUsd,
      maximumUsd: costEstimate.maximumUsd,
      method: costEstimate.method
    });

    if (!byOperation[operation]) {
      byOperation[operation] = { ...emptyRollup(), capabilities: [], providers: [], models: [] };
    }
    byOperation[operation].requests += requestCount;
    byOperation[operation].inputTokens += inputTokens;
    byOperation[operation].outputTokens += outputTokens;
    byOperation[operation].totalTokens += totalTokens;
    safeArrayPush(byOperation[operation].capabilities, capability);
    safeArrayPush(byOperation[operation].providers, provider);
    safeArrayPush(byOperation[operation].models, model);
    trackCost(byOperation[operation], {
      requestCount,
      estimatedUsd: costEstimate.estimatedUsd,
      minimumUsd: costEstimate.minimumUsd,
      maximumUsd: costEstimate.maximumUsd,
      method: costEstimate.method
    });

    const modelKey = `${provider}:${model}`;
    if (!byModel[modelKey]) {
      byModel[modelKey] = {
        ...emptyRollup(),
        capability,
        provider,
        model,
        operations: []
      };
    }
    byModel[modelKey].requests += requestCount;
    byModel[modelKey].inputTokens += inputTokens;
    byModel[modelKey].outputTokens += outputTokens;
    byModel[modelKey].totalTokens += totalTokens;
    safeArrayPush(byModel[modelKey].operations, operation);
    trackCost(byModel[modelKey], {
      requestCount,
      estimatedUsd: costEstimate.estimatedUsd,
      minimumUsd: costEstimate.minimumUsd,
      maximumUsd: costEstimate.maximumUsd,
      method: costEstimate.method
    });

    if (!byDay[day]) byDay[day] = emptyRollup();
    byDay[day].requests += requestCount;
    byDay[day].inputTokens += inputTokens;
    byDay[day].outputTokens += outputTokens;
    byDay[day].totalTokens += totalTokens;
    trackCost(byDay[day], {
      requestCount,
      estimatedUsd: costEstimate.estimatedUsd,
      minimumUsd: costEstimate.minimumUsd,
      maximumUsd: costEstimate.maximumUsd,
      method: costEstimate.method
    });
  }

  return {
    days: normalizedDays,
    since: sinceIso,
    totals,
    byCapability,
    byOperation,
    byProvider,
    byModel,
    byDay
  };
};
