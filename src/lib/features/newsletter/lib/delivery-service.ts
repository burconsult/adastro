import { supabaseAdmin } from '@/lib/supabase';

import { buildFromAddress } from './template-service.js';
import { buildNewsletterUnsubscribeContext } from './unsubscribe-link.js';
import type {
  NewsletterMessage,
  NewsletterRecipient,
  NewsletterRuntimeSettings,
  NewsletterUnsubscribeContext,
  NewsletterSendResult
} from './types.js';
import { NewsletterFeatureError } from './types.js';

let sesTransportCache:
  | {
      cacheKey: string;
      transporter: any;
    }
  | null = null;

const sanitizeText = (value: unknown, maxLength: number) =>
  (typeof value === 'string' ? value.trim() : '').slice(0, maxLength);

const normalizeEmail = (value: unknown) =>
  sanitizeText(value, 200).toLowerCase();

const buildListId = (settings: NewsletterRuntimeSettings) => {
  try {
    const siteHost = new URL(settings.siteUrl)
      .hostname
      .replace(/^www\./i, '')
      .replace(/[^a-z0-9.-]/gi, '');
    if (!siteHost) return undefined;
    return {
      headerValue: `${settings.siteTitle} <newsletter.${siteHost}>`,
      listValue: {
        url: `newsletter.${siteHost}`,
        comment: settings.siteTitle
      }
    };
  } catch {
    return undefined;
  }
};

export const buildNewsletterOneClickHeaders = (
  settings: NewsletterRuntimeSettings,
  recipientEmail: string,
  unsubscribeContext: NewsletterUnsubscribeContext = buildNewsletterUnsubscribeContext(settings, recipientEmail)
) => {
  const listId = buildListId(settings);
  const unsubscribeValues = [
    unsubscribeContext.unsubscribeUrl,
    unsubscribeContext.mailtoUnsubscribeUrl
  ].filter((value): value is string => Boolean(value));
  const unsubscribeHeaderValue = unsubscribeValues.map((value) => `<${value}>`).join(', ');
  const unsubscribeListValue = unsubscribeValues.length === 1
    ? unsubscribeValues[0]
    : unsubscribeValues;

  return {
    unsubscribeUrl: unsubscribeContext.unsubscribeUrl,
    mailtoUnsubscribeUrl: unsubscribeContext.mailtoUnsubscribeUrl,
    list: {
      unsubscribe: unsubscribeListValue,
      ...(listId ? { id: listId.listValue } : {})
    },
    headers: {
      'List-Unsubscribe': unsubscribeHeaderValue,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      ...(listId ? { 'List-ID': listId.headerValue } : {})
    }
  };
};

const getSesTransporter = async () => {
  const region = sanitizeText(process.env.AWS_SES_REGION, 60) || 'us-east-1';
  const host = sanitizeText(process.env.AWS_SES_SMTP_HOST, 200) || `email-smtp.${region}.amazonaws.com`;
  const port = Number.parseInt(process.env.AWS_SES_SMTP_PORT || '587', 10);
  const user = sanitizeText(process.env.AWS_SES_SMTP_USER, 200);
  const pass = sanitizeText(process.env.AWS_SES_SMTP_PASS, 300);

  if (!user || !pass) {
    throw new NewsletterFeatureError(
      'AWS_SES_SMTP_USER and AWS_SES_SMTP_PASS are required when provider is set to ses.',
      500
    );
  }

  const cacheKey = `${host}:${port}:${user}`;
  if (sesTransportCache && sesTransportCache.cacheKey === cacheKey) {
    return sesTransportCache.transporter;
  }

  const nodemailerModule = await import('nodemailer');
  const transporter = nodemailerModule.createTransport({
    host,
    port: Number.isFinite(port) ? port : 587,
    secure: port === 465,
    auth: { user, pass }
  });
  sesTransportCache = { cacheKey, transporter };
  return transporter;
};

export const sendNewsletterMessage = async (
  settings: NewsletterRuntimeSettings,
  message: NewsletterMessage
) => {
  const listHeaders = buildNewsletterOneClickHeaders(settings, message.to, message.unsubscribeContext);

  if (settings.provider === 'console') {
    console.info('[newsletter:console]', {
      to: message.to,
      subject: message.subject,
      headers: listHeaders.headers
    });
    return { provider: 'console', messageId: `console-${Date.now()}` };
  }

  if (settings.provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new NewsletterFeatureError(
        'RESEND_API_KEY is required when newsletter provider is set to resend.',
        500
      );
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: buildFromAddress(settings),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        headers: listHeaders.headers,
        ...(settings.replyTo ? { reply_to: settings.replyTo } : {})
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new NewsletterFeatureError(
        payload?.message || payload?.error || 'Resend delivery failed.',
        502
      );
    }

    return { provider: 'resend', messageId: payload?.id ?? null };
  }

  if (settings.provider === 'ses') {
    const transporter = await getSesTransporter();
    const result = await transporter.sendMail({
      from: buildFromAddress(settings),
      to: message.to,
      subject: message.subject,
      html: message.html,
      list: listHeaders.list,
      headers: listHeaders.headers,
      ...(settings.replyTo ? { replyTo: settings.replyTo } : {})
    });
    return {
      provider: 'ses',
      messageId: (result && typeof result.messageId === 'string') ? result.messageId : null
    };
  }

  throw new NewsletterFeatureError(`Unsupported newsletter provider: ${settings.provider}`, 400);
};

type SendAuditedCampaignInput = {
  settings: NewsletterRuntimeSettings;
  recipients: NewsletterRecipient[];
  createdBy: string;
  postId?: string | null;
  templateKey: string;
  buildMessage: (recipientEmail: string) => NewsletterMessage;
};

const createCampaignRecord = async (input: {
  settings: NewsletterRuntimeSettings;
  createdBy: string;
  postId?: string | null;
  templateKey: string;
  recipientsCount: number;
  sampleMessage: NewsletterMessage;
}) => {
  const { data, error } = await (supabaseAdmin as any)
    .from('newsletter_campaigns')
    .insert({
      post_id: input.postId ?? null,
      template_key: input.templateKey,
      subject: input.sampleMessage.subject,
      body_html: input.sampleMessage.html,
      provider: input.settings.provider,
      status: 'sending',
      recipients_count: input.recipientsCount,
      created_by: input.createdBy,
      started_at: new Date().toISOString()
    })
    .select('id')
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) {
    console.error('Newsletter campaign record creation failed:', error);
    throw new NewsletterFeatureError(
      'Failed to create newsletter campaign record. No emails were sent.',
      500
    );
  }

  return data.id as string;
};

export const sendAuditedNewsletterCampaign = async (
  input: SendAuditedCampaignInput
): Promise<NewsletterSendResult> => {
  if (input.recipients.length === 0) {
    return {
      success: true,
      recipients: 0,
      delivered: 0,
      failed: 0,
      warnings: []
    };
  }

  const sampleMessage = input.buildMessage(normalizeEmail(input.recipients[0]?.email));
  const campaignId = await createCampaignRecord({
    settings: input.settings,
    createdBy: input.createdBy,
    postId: input.postId,
    templateKey: input.templateKey,
    recipientsCount: input.recipients.length,
    sampleMessage
  });

  const deliveryRows: Array<Record<string, any>> = [];
  const warnings: string[] = [];
  let delivered = 0;
  let failed = 0;

  for (const recipient of input.recipients) {
    const email = normalizeEmail(recipient.email);
    const message = input.buildMessage(email);

    try {
      const result = await sendNewsletterMessage(input.settings, message);
      delivered += 1;
      deliveryRows.push({
        campaign_id: campaignId,
        subscriber_id: recipient.id,
        email,
        status: 'delivered',
        provider_message_id: result.messageId,
        sent_at: new Date().toISOString()
      });
    } catch (deliveryError) {
      failed += 1;
      deliveryRows.push({
        campaign_id: campaignId,
        subscriber_id: recipient.id,
        email,
        status: 'failed',
        error: deliveryError instanceof Error ? deliveryError.message : 'Delivery failed'
      });
    }
  }

  if (deliveryRows.length > 0) {
    const { error } = await (supabaseAdmin as any)
      .from('newsletter_deliveries')
      .insert(deliveryRows);
    if (error) {
      console.error('Newsletter delivery audit insert failed:', error);
      warnings.push('Delivery audit records could not be stored.');
    }
  }

  const finalStatus = failed > 0 ? (delivered > 0 ? 'partial' : 'failed') : 'completed';
  const { error: updateError } = await (supabaseAdmin as any)
    .from('newsletter_campaigns')
    .update({
      status: finalStatus,
      delivered_count: delivered,
      failed_count: failed,
      completed_at: new Date().toISOString()
    })
    .eq('id', campaignId);
  if (updateError) {
    console.error('Newsletter campaign summary update failed:', updateError);
    warnings.push('Campaign summary could not be updated.');
  }

  return {
    success: true,
    recipients: input.recipients.length,
    delivered,
    failed,
    campaignId,
    warnings
  };
};
