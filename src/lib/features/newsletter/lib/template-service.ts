import sanitizeHtml from 'sanitize-html';

import { buildNewsletterUnsubscribeContext } from './unsubscribe-link.js';
import type {
  CampaignArticleCard,
  NewsletterMessage,
  NewsletterRuntimeSettings,
  NewsletterUnsubscribeContext
} from './types.js';

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

const sanitizeText = (value: unknown, maxLength: number) =>
  (typeof value === 'string' ? value.trim() : '').slice(0, maxLength);

export const sanitizeHtmlFragment = (value: string, maxLength: number) =>
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

export const renderTemplate = (template: string, variables: Record<string, string>) =>
  template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => variables[key] ?? '');

export const buildFromAddress = (settings: NewsletterRuntimeSettings) =>
  `${settings.fromName} <${settings.fromEmail}>`;

export const getDefaultConfirmUrl = (
  settings: NewsletterRuntimeSettings,
  email: string,
  token: string
) =>
  `${settings.siteUrl}/api/features/newsletter/confirm?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

const appendComplianceFooter = (
  settings: NewsletterRuntimeSettings,
  unsubscribeContext: NewsletterUnsubscribeContext,
  htmlBody: string
) => {
  const footer = renderTemplate(
    sanitizeHtmlFragment(settings.complianceFooterHtml, 40_000),
    {
      siteTitle: escapeHtml(settings.siteTitle),
      unsubscribeUrl: unsubscribeContext.unsubscribeUrl
    }
  );
  if (!footer || htmlBody.includes(unsubscribeContext.unsubscribeUrl)) {
    return htmlBody;
  }
  return `${htmlBody}${footer}`;
};

export const buildSubscriptionMessage = (
  settings: NewsletterRuntimeSettings,
  recipientEmail: string
): NewsletterMessage => {
  const unsubscribeContext = buildNewsletterUnsubscribeContext(settings, recipientEmail);
  const subject = renderTemplate(settings.templates.subscriptionSubject, {
    siteTitle: escapeHtml(settings.siteTitle)
  });
  const body = renderTemplate(sanitizeHtmlFragment(settings.templates.subscriptionHtml, 60_000), {
    siteTitle: escapeHtml(settings.siteTitle),
    unsubscribeUrl: unsubscribeContext.unsubscribeUrl
  });
  return {
    to: recipientEmail,
    subject,
    html: appendComplianceFooter(settings, unsubscribeContext, body),
    unsubscribeContext
  };
};

export const buildConfirmationMessage = (
  settings: NewsletterRuntimeSettings,
  recipientEmail: string,
  token: string
): NewsletterMessage => {
  const unsubscribeContext = buildNewsletterUnsubscribeContext(settings, recipientEmail);
  const confirmUrl = getDefaultConfirmUrl(settings, recipientEmail, token);
  const subject = renderTemplate(settings.templates.confirmationSubject, {
    siteTitle: escapeHtml(settings.siteTitle)
  });
  const body = renderTemplate(sanitizeHtmlFragment(settings.templates.confirmationHtml, 60_000), {
    siteTitle: escapeHtml(settings.siteTitle),
    confirmUrl,
    unsubscribeUrl: unsubscribeContext.unsubscribeUrl
  });
  return {
    to: recipientEmail,
    subject,
    html: appendComplianceFooter(settings, unsubscribeContext, body),
    unsubscribeContext
  };
};

export const buildPostMessage = (
  settings: NewsletterRuntimeSettings,
  recipientEmail: string,
  post: { title: string; excerpt: string; url: string }
): NewsletterMessage => {
  const unsubscribeContext = buildNewsletterUnsubscribeContext(settings, recipientEmail);
  const subject = renderTemplate(settings.templates.newPostSubject, {
    siteTitle: escapeHtml(settings.siteTitle),
    postTitle: escapeHtml(post.title)
  });
  const body = renderTemplate(sanitizeHtmlFragment(settings.templates.newPostHtml, 60_000), {
    siteTitle: escapeHtml(settings.siteTitle),
    postTitle: escapeHtml(post.title),
    postExcerpt: escapeHtml(post.excerpt),
    postUrl: toAbsoluteHttpUrl(post.url),
    unsubscribeUrl: unsubscribeContext.unsubscribeUrl
  });
  return {
    to: recipientEmail,
    subject,
    html: appendComplianceFooter(settings, unsubscribeContext, body),
    unsubscribeContext
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
  const unsubscribeContext = buildNewsletterUnsubscribeContext(settings, recipientEmail);
  const resolvedSubject = sanitizeText(campaign.subject, 220)
    || renderTemplate(settings.templates.campaignSubject, {
      siteTitle: escapeHtml(settings.siteTitle)
    });
  const introHtml = sanitizeHtmlFragment(campaign.introHtml || '', 20_000);
  const cardsHtml = buildArticleCardsHtml(campaign.articles);
  const templateHtml = campaign.templateHtml
    ? sanitizeHtmlFragment(campaign.templateHtml, 80_000)
    : sanitizeHtmlFragment(settings.templates.campaignHtml, 80_000);
  const body = renderTemplate(templateHtml, {
    siteTitle: escapeHtml(settings.siteTitle),
    introHtml,
    articleCardsHtml: cardsHtml,
    unsubscribeUrl: unsubscribeContext.unsubscribeUrl
  });
  return {
    to: recipientEmail,
    subject: resolvedSubject,
    html: appendComplianceFooter(settings, unsubscribeContext, body),
    unsubscribeContext
  };
};
