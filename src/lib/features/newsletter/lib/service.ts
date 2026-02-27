import sanitizeHtml from 'sanitize-html';
import { normalizeFeatureFlag } from '@/lib/features/flags';
import { SettingsService } from '@/lib/services/settings-service';
import { supabaseAdmin } from '@/lib/supabase';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const NEWSLETTER_SETTING_KEYS = [
  'features.newsletter.enabled',
  'features.newsletter.provider',
  'features.newsletter.fromName',
  'features.newsletter.fromEmail',
  'features.newsletter.replyTo',
  'features.newsletter.sendWelcomeEmail',
  'features.newsletter.requireDoubleOptIn',
  'features.newsletter.requireConsentCheckbox',
  'features.newsletter.signupFooterEnabled',
  'features.newsletter.signupModalEnabled',
  'features.newsletter.signupModalDelaySeconds',
  'features.newsletter.consentLabel',
  'features.newsletter.complianceFooterHtml',
  'features.newsletter.maxRecipientsPerCampaign',
  'features.newsletter.templates.subscriptionSubject',
  'features.newsletter.templates.subscriptionHtml',
  'features.newsletter.templates.confirmationSubject',
  'features.newsletter.templates.confirmationHtml',
  'features.newsletter.templates.newPostSubject',
  'features.newsletter.templates.newPostHtml',
  'features.newsletter.templates.campaignSubject',
  'features.newsletter.templates.campaignHtml',
  'site.title',
  'site.url'
] as const;

export type NewsletterProviderKey = 'console' | 'resend' | 'ses';

export type NewsletterRuntimeSettings = {
  enabled: boolean;
  provider: NewsletterProviderKey;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  sendWelcomeEmail: boolean;
  requireDoubleOptIn: boolean;
  requireConsentCheckbox: boolean;
  signupFooterEnabled: boolean;
  signupModalEnabled: boolean;
  signupModalDelaySeconds: number;
  consentLabel: string;
  complianceFooterHtml: string;
  maxRecipientsPerCampaign: number;
  templates: {
    subscriptionSubject: string;
    subscriptionHtml: string;
    confirmationSubject: string;
    confirmationHtml: string;
    newPostSubject: string;
    newPostHtml: string;
    campaignSubject: string;
    campaignHtml: string;
  };
  siteTitle: string;
  siteUrl: string;
};

export type NewsletterMessage = {
  to: string;
  subject: string;
  html: string;
};

export type CampaignArticleCard = {
  title: string;
  excerpt: string;
  url: string;
  imageUrl?: string;
};

const ALLOWED_HTML_TAGS = [
  'a',
  'p',
  'br',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'div',
  'span',
  'h2',
  'h3',
  'h4',
  'img'
];

const ALLOWED_HTML_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height', 'style'],
  div: ['style'],
  span: ['style'],
  p: ['style']
};

let sesTransportCache:
  | {
      cacheKey: string;
      transporter: any;
    }
  | null = null;

const isMissingColumnError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || '');
  return /column .* does not exist/i.test(message);
};

export const normalizeEmail = (value: unknown) =>
  (typeof value === 'string' ? value.trim().toLowerCase() : '').slice(0, 200);

const sanitizeText = (value: unknown, maxLength: number) =>
  (typeof value === 'string' ? value.trim() : '').slice(0, maxLength);

const sanitizeHtmlFragment = (value: string, maxLength: number) =>
  sanitizeHtml(value.slice(0, maxLength), {
    allowedTags: ALLOWED_HTML_TAGS,
    allowedAttributes: ALLOWED_HTML_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https']
    }
  }).trim();

const toPlainText = (value: string, maxLength = 280) =>
  stripHtml(value).slice(0, maxLength);

const getDefaultSiteUrl = (): string => {
  const runtimeSiteUrl = typeof process !== 'undefined' ? process.env.SITE_URL : undefined;
  const configuredSiteUrl = (import.meta.env.SITE_URL as string | undefined) || runtimeSiteUrl;
  if (configuredSiteUrl && configuredSiteUrl.trim()) {
    return configuredSiteUrl.trim();
  }
  return 'https://example.com';
};

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const stripHtml = (value: string) =>
  value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeSiteUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 'https://example.com';
  return trimmed.replace(/\/+$/, '');
};

const toAbsoluteHttpUrl = (input: string): string => {
  try {
    const parsed = new URL(input);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return '#';
  } catch {
    return '#';
  }
};

export const loadNewsletterRuntimeSettings = async (
  settingsService = new SettingsService()
): Promise<NewsletterRuntimeSettings> => {
  const settings = await settingsService.getSettings([...NEWSLETTER_SETTING_KEYS]);
  const providerRaw = sanitizeText(settings['features.newsletter.provider'], 40).toLowerCase();
  const provider: NewsletterProviderKey = providerRaw === 'resend'
    ? 'resend'
    : providerRaw === 'ses'
      ? 'ses'
      : 'console';
  const maxRecipients = Number(settings['features.newsletter.maxRecipientsPerCampaign']);
  const modalDelaySeconds = Number(settings['features.newsletter.signupModalDelaySeconds']);

  return {
    enabled: normalizeFeatureFlag(settings['features.newsletter.enabled'], false),
    provider,
    fromName: sanitizeText(settings['features.newsletter.fromName'], 120) || 'AdAstro',
    fromEmail: normalizeEmail(settings['features.newsletter.fromEmail']) || 'newsletter@example.com',
    replyTo: normalizeEmail(settings['features.newsletter.replyTo']),
    sendWelcomeEmail: normalizeFeatureFlag(settings['features.newsletter.sendWelcomeEmail'], true),
    requireDoubleOptIn: normalizeFeatureFlag(settings['features.newsletter.requireDoubleOptIn'], false),
    requireConsentCheckbox: normalizeFeatureFlag(settings['features.newsletter.requireConsentCheckbox'], true),
    signupFooterEnabled: normalizeFeatureFlag(settings['features.newsletter.signupFooterEnabled'], true),
    signupModalEnabled: normalizeFeatureFlag(settings['features.newsletter.signupModalEnabled'], false),
    signupModalDelaySeconds: Number.isFinite(modalDelaySeconds)
      ? Math.max(1, Math.min(120, Math.round(modalDelaySeconds)))
      : 12,
    consentLabel:
      sanitizeText(settings['features.newsletter.consentLabel'], 300)
      || 'I agree to receive email updates and can unsubscribe at any time.',
    complianceFooterHtml:
      sanitizeHtmlFragment(
        sanitizeText(settings['features.newsletter.complianceFooterHtml'], 40_000)
        || '<p style="font-size:12px;color:#666">Unsubscribe: <a href="{{unsubscribeUrl}}">{{unsubscribeUrl}}</a></p>',
        40_000
      ),
    maxRecipientsPerCampaign: Number.isFinite(maxRecipients) ? Math.max(1, Math.min(25_000, maxRecipients)) : 1000,
    templates: {
      subscriptionSubject: sanitizeText(settings['features.newsletter.templates.subscriptionSubject'], 220)
        || 'Welcome to {{siteTitle}}',
      subscriptionHtml:
        sanitizeHtmlFragment(
          sanitizeText(settings['features.newsletter.templates.subscriptionHtml'], 60_000)
          || '<p>Thanks for subscribing to {{siteTitle}}.</p>',
          60_000
        ),
      confirmationSubject: sanitizeText(settings['features.newsletter.templates.confirmationSubject'], 220)
        || 'Confirm your subscription to {{siteTitle}}',
      confirmationHtml:
        sanitizeHtmlFragment(
          sanitizeText(settings['features.newsletter.templates.confirmationHtml'], 60_000)
          || '<p>Confirm your subscription: <a href="{{confirmUrl}}">Confirm</a></p>',
          60_000
        ),
      newPostSubject: sanitizeText(settings['features.newsletter.templates.newPostSubject'], 220)
        || 'New post on {{siteTitle}}: {{postTitle}}',
      newPostHtml:
        sanitizeHtmlFragment(
          sanitizeText(settings['features.newsletter.templates.newPostHtml'], 60_000)
          || '<p><strong>{{postTitle}}</strong></p><p><a href="{{postUrl}}">Read the post</a></p>',
          60_000
        ),
      campaignSubject: sanitizeText(settings['features.newsletter.templates.campaignSubject'], 220)
        || '{{siteTitle}} update',
      campaignHtml:
        sanitizeHtmlFragment(
          sanitizeText(settings['features.newsletter.templates.campaignHtml'], 80_000)
          || '<div><p>{{introHtml}}</p>{{articleCardsHtml}}<p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p></div>',
          80_000
        )
    },
    siteTitle: sanitizeText(settings['site.title'], 120) || 'AdAstro',
    siteUrl: normalizeSiteUrl(sanitizeText(settings['site.url'], 300) || getDefaultSiteUrl())
  };
};

export const renderTemplate = (template: string, variables: Record<string, string>) =>
  template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => variables[key] ?? '');

export const buildFromAddress = (settings: NewsletterRuntimeSettings) =>
  `${settings.fromName} <${settings.fromEmail}>`;

export const getDefaultUnsubscribeUrl = (settings: NewsletterRuntimeSettings, email: string) =>
  `${settings.siteUrl}/profile?newsletter=${encodeURIComponent(email)}`;

export const getDefaultConfirmUrl = (settings: NewsletterRuntimeSettings, email: string, token: string) =>
  `${settings.siteUrl}/api/features/newsletter/confirm?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

const appendComplianceFooter = (
  settings: NewsletterRuntimeSettings,
  recipientEmail: string,
  htmlBody: string
) => {
  const footer = renderTemplate(settings.complianceFooterHtml, {
    siteTitle: escapeHtml(settings.siteTitle),
    unsubscribeUrl: getDefaultUnsubscribeUrl(settings, recipientEmail)
  });
  return `${htmlBody}${footer}`;
};

export const buildSubscriptionMessage = (
  settings: NewsletterRuntimeSettings,
  recipientEmail: string
): NewsletterMessage => {
  const subject = renderTemplate(settings.templates.subscriptionSubject, {
    siteTitle: escapeHtml(settings.siteTitle)
  });
  const body = renderTemplate(settings.templates.subscriptionHtml, {
    siteTitle: escapeHtml(settings.siteTitle),
    unsubscribeUrl: getDefaultUnsubscribeUrl(settings, recipientEmail)
  });
  return {
    to: recipientEmail,
    subject,
    html: appendComplianceFooter(settings, recipientEmail, body)
  };
};

export const buildConfirmationMessage = (
  settings: NewsletterRuntimeSettings,
  recipientEmail: string,
  token: string
): NewsletterMessage => {
  const confirmUrl = getDefaultConfirmUrl(settings, recipientEmail, token);
  const subject = renderTemplate(settings.templates.confirmationSubject, {
    siteTitle: escapeHtml(settings.siteTitle)
  });
  const body = renderTemplate(settings.templates.confirmationHtml, {
    siteTitle: escapeHtml(settings.siteTitle),
    confirmUrl,
    unsubscribeUrl: getDefaultUnsubscribeUrl(settings, recipientEmail)
  });
  return {
    to: recipientEmail,
    subject,
    html: appendComplianceFooter(settings, recipientEmail, body)
  };
};

export const buildPostMessage = (
  settings: NewsletterRuntimeSettings,
  recipientEmail: string,
  post: { title: string; excerpt: string; url: string }
): NewsletterMessage => {
  const subject = renderTemplate(settings.templates.newPostSubject, {
    siteTitle: escapeHtml(settings.siteTitle),
    postTitle: escapeHtml(post.title)
  });
  const body = renderTemplate(settings.templates.newPostHtml, {
    siteTitle: escapeHtml(settings.siteTitle),
    postTitle: escapeHtml(post.title),
    postExcerpt: escapeHtml(post.excerpt),
    postUrl: toAbsoluteHttpUrl(post.url),
    unsubscribeUrl: getDefaultUnsubscribeUrl(settings, recipientEmail)
  });
  return {
    to: recipientEmail,
    subject,
    html: appendComplianceFooter(settings, recipientEmail, body)
  };
};

export const buildArticleCardsHtml = (articles: CampaignArticleCard[]): string =>
  articles
    .map((article) => {
      const safeTitle = escapeHtml(sanitizeText(article.title, 200));
      const safeExcerpt = escapeHtml(toPlainText(article.excerpt, 320));
      const safeUrl = toAbsoluteHttpUrl(article.url);
      const safeImage = article.imageUrl ? toAbsoluteHttpUrl(article.imageUrl) : '';
      const imageMarkup = safeImage && safeImage !== '#'
        ? `<img src="${safeImage}" alt="${safeTitle}" style="width:100%;height:auto;display:block;border-radius:8px;margin-bottom:12px;" />`
        : '';
      return `
        <article style="border:1px solid #d9d9d9;border-radius:12px;padding:16px;margin:0 0 16px;background:#fff;">
          ${imageMarkup}
          <h3 style="margin:0 0 8px;font-size:18px;line-height:1.35;">${safeTitle}</h3>
          <p style="margin:0 0 12px;color:#4b5563;font-size:14px;line-height:1.5;">${safeExcerpt}</p>
          <a href="${safeUrl}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#111827;color:#fff;text-decoration:none;font-size:14px;">Read article</a>
        </article>
      `;
    })
    .join('');

export const buildCampaignMessage = (
  settings: NewsletterRuntimeSettings,
  recipientEmail: string,
  campaign: {
    subject?: string;
    introHtml?: string;
    templateHtml?: string;
    articles: CampaignArticleCard[];
  }
): NewsletterMessage => {
  const resolvedSubject = sanitizeText(campaign.subject, 220)
    || renderTemplate(settings.templates.campaignSubject, {
      siteTitle: escapeHtml(settings.siteTitle)
    });
  const introHtml = sanitizeHtmlFragment(campaign.introHtml || '', 20_000);
  const cardsHtml = buildArticleCardsHtml(campaign.articles);
  const templateHtml = campaign.templateHtml
    ? sanitizeHtmlFragment(campaign.templateHtml, 80_000)
    : settings.templates.campaignHtml;
  const body = renderTemplate(templateHtml, {
    siteTitle: escapeHtml(settings.siteTitle),
    introHtml,
    articleCardsHtml: cardsHtml,
    unsubscribeUrl: getDefaultUnsubscribeUrl(settings, recipientEmail)
  });
  return {
    to: recipientEmail,
    subject: resolvedSubject,
    html: appendComplianceFooter(settings, recipientEmail, body)
  };
};

const getSesTransporter = async () => {
  const region = sanitizeText(process.env.AWS_SES_REGION, 60) || 'us-east-1';
  const host = sanitizeText(process.env.AWS_SES_SMTP_HOST, 200) || `email-smtp.${region}.amazonaws.com`;
  const port = Number.parseInt(process.env.AWS_SES_SMTP_PORT || '587', 10);
  const user = sanitizeText(process.env.AWS_SES_SMTP_USER, 200);
  const pass = sanitizeText(process.env.AWS_SES_SMTP_PASS, 300);

  if (!user || !pass) {
    throw new Error('AWS_SES_SMTP_USER and AWS_SES_SMTP_PASS are required when provider is set to ses.');
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
  if (settings.provider === 'console') {
    console.info('[newsletter:console]', {
      to: message.to,
      subject: message.subject
    });
    return { provider: 'console', messageId: `console-${Date.now()}` };
  }

  if (settings.provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is required when newsletter provider is set to resend.');
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
        ...(settings.replyTo ? { reply_to: settings.replyTo } : {})
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || 'Resend delivery failed.');
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
      ...(settings.replyTo ? { replyTo: settings.replyTo } : {})
    });
    return {
      provider: 'ses',
      messageId: (result && typeof result.messageId === 'string') ? result.messageId : null
    };
  }

  throw new Error(`Unsupported newsletter provider: ${settings.provider}`);
};

export const getNewsletterSubscriptionStatus = async (email: string): Promise<boolean> => {
  const normalized = normalizeEmail(email);
  if (!EMAIL_RE.test(normalized)) return false;

  const { data, error } = await supabaseAdmin
    .from('newsletter_subscribers')
    .select('status')
    .eq('email', normalized)
    .maybeSingle();

  if (error || !data) return false;
  return data.status === 'subscribed';
};

export const syncNewsletterSubscription = async (input: {
  authUserId?: string;
  email: string;
  source?: string;
  optedIn: boolean;
  status?: 'subscribed' | 'pending';
  confirmationToken?: string | null;
  consent?: boolean;
}) => {
  const normalizedEmail = normalizeEmail(input.email);
  if (!EMAIL_RE.test(normalizedEmail)) return;

  if (input.optedIn) {
    const targetStatus = input.status ?? 'subscribed';
    const consentRecord = {
      explicitConsent: input.consent === true,
      source: sanitizeText(input.source, 80) || 'profile',
      at: new Date().toISOString()
    };
    try {
      const { error } = await supabaseAdmin
        .from('newsletter_subscribers')
        .upsert(
          {
            email: normalizedEmail,
            auth_user_id: input.authUserId ?? null,
            status: targetStatus,
            source: sanitizeText(input.source, 80) || 'profile',
            unsubscribed_at: null,
            confirmation_token: targetStatus === 'pending' ? (input.confirmationToken || null) : null,
            confirmed_at: targetStatus === 'subscribed' ? new Date().toISOString() : null,
            consent_record: consentRecord
          },
          { onConflict: 'email' }
        );
      if (error) throw error;
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;
      const { error: legacyError } = await supabaseAdmin
        .from('newsletter_subscribers')
        .upsert(
          {
            email: normalizedEmail,
            auth_user_id: input.authUserId ?? null,
            status: targetStatus === 'pending' ? 'subscribed' : targetStatus,
            source: sanitizeText(input.source, 80) || 'profile',
            unsubscribed_at: null
          },
          { onConflict: 'email' }
        );
      if (legacyError) throw legacyError;
    }
    return;
  }

  let error: any = null;
  try {
    const result = await supabaseAdmin
      .from('newsletter_subscribers')
      .update({
        auth_user_id: input.authUserId ?? null,
        status: 'unsubscribed',
        source: sanitizeText(input.source, 80) || 'profile',
        unsubscribed_at: new Date().toISOString(),
        confirmation_token: null
      })
      .eq('email', normalizedEmail);
    error = result.error;
  } catch (updateError) {
    if (!isMissingColumnError(updateError)) throw updateError;
    const fallback = await supabaseAdmin
      .from('newsletter_subscribers')
      .update({
        auth_user_id: input.authUserId ?? null,
        status: 'unsubscribed',
        source: sanitizeText(input.source, 80) || 'profile',
        unsubscribed_at: new Date().toISOString()
      })
      .eq('email', normalizedEmail);
    error = fallback.error;
  }

  if (error) throw error;
};
