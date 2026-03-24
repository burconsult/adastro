import * as z from 'zod/v4';

import type { FeatureMcpExtension } from '../types.js';
import { buildNewsletterAdminStatus, loadNewsletterRuntimeSettings } from './lib/config-service.js';
import {
  getNewsletterCampaignSummary,
  getNewsletterSubscriberSummary,
  listNewsletterSubscribers,
  listRecentNewsletterCampaigns
} from './lib/campaign-service.js';

const subscriberListArgsSchema = z.object({
  limit: z.number().int().min(1).max(500).optional()
}).strict();

const parseArgs = <T>(schema: z.ZodSchema<T>, args: Record<string, unknown>): T => {
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(issue?.message || 'Invalid tool arguments');
  }
  return parsed.data;
};

const getNewsletterStatus = async () => {
  const settings = await loadNewsletterRuntimeSettings();
  const [subscribers, campaigns, recentCampaigns] = await Promise.all([
    settings.enabled ? getNewsletterSubscriberSummary() : Promise.resolve({
      total: 0,
      pending: 0,
      subscribed: 0,
      unsubscribed: 0
    }),
    settings.enabled ? getNewsletterCampaignSummary() : Promise.resolve({
      total: 0,
      draft: 0,
      sending: 0,
      completed: 0,
      partial: 0,
      failed: 0
    }),
    settings.enabled ? listRecentNewsletterCampaigns() : Promise.resolve([])
  ]);

  return buildNewsletterAdminStatus({
    settings,
    subscribers,
    campaigns,
    recentCampaigns
  });
};

const listSubscribers = async (args: Record<string, unknown>) => {
  const settings = await loadNewsletterRuntimeSettings();
  if (!settings.enabled) {
    throw new Error('Newsletter feature is disabled.');
  }

  const input = parseArgs(subscriberListArgsSchema, args);
  return listNewsletterSubscribers(input.limit ?? 100);
};

export const NEWSLETTER_FEATURE_MCP_EXTENSION: FeatureMcpExtension = {
  getTools: () => [
    {
      name: 'newsletter_status',
      title: 'Get Newsletter Status',
      description: 'Return newsletter feature status, provider health, subscriber counts, and recent campaigns.',
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      handler: () => getNewsletterStatus()
    },
    {
      name: 'newsletter_subscribers_list',
      title: 'List Newsletter Subscribers',
      description: 'List newsletter subscribers with summary counts.',
      inputSchema: {
        limit: z.number().int().min(1).max(500).optional()
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      handler: listSubscribers
    }
  ]
};
