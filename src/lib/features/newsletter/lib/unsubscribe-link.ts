import { createHmac, timingSafeEqual } from 'node:crypto';
import { getNewsletterSigningSecret } from './config-service.js';
import type { NewsletterUnsubscribeContext } from './types.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const DEFAULT_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const normalizeEmail = (value: unknown) =>
  (typeof value === 'string' ? value.trim().toLowerCase() : '').slice(0, 200);

const encodeBase64Url = (value: string) =>
  Buffer.from(value, 'utf8').toString('base64url');

const decodeBase64Url = (value: string) =>
  Buffer.from(value, 'base64url').toString('utf8');

const signPayload = (payload: string) => {
  const secret = getNewsletterSigningSecret();
  if (!secret) {
    throw new Error(
      'NEWSLETTER_SIGNING_SECRET or SUPABASE_SECRET_KEY is required to build signed unsubscribe links.'
    );
  }

  return createHmac('sha256', secret).update(payload).digest('base64url');
};

export const buildNewsletterUnsubscribeToken = (
  email: string,
  ttlMs = DEFAULT_TOKEN_TTL_MS
) => {
  const normalizedEmail = normalizeEmail(email);
  if (!EMAIL_RE.test(normalizedEmail)) {
    throw new Error('Valid email is required to build unsubscribe token.');
  }

  const payload = JSON.stringify({
    email: normalizedEmail,
    exp: Date.now() + Math.max(60_000, ttlMs)
  });
  const encodedPayload = encodeBase64Url(payload);
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
};

export const readNewsletterUnsubscribeToken = (token: string) => {
  const trimmed = typeof token === 'string' ? token.trim() : '';
  if (!trimmed) return null;

  const [encodedPayload, signature] = trimmed.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as { email?: string; exp?: number };
    const email = normalizeEmail(payload.email);
    const expiresAt = Number(payload.exp);
    if (!EMAIL_RE.test(email) || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      return null;
    }

    return {
      email,
      expiresAt
    };
  } catch {
    return null;
  }
};

export const buildNewsletterUnsubscribeUrl = (
  settings: { siteUrl: string },
  recipientEmail: string,
  token = buildNewsletterUnsubscribeToken(recipientEmail)
) => {
  return `${settings.siteUrl}/api/features/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
};

const buildNewsletterMailtoUnsubscribeUrl = (
  settings: { fromEmail?: string; replyTo?: string }
) => {
  const mailbox = [settings.replyTo, settings.fromEmail]
    .map((value) => normalizeEmail(value))
    .find((value): value is string => EMAIL_RE.test(value)) || '';
  if (!EMAIL_RE.test(mailbox)) {
    return null;
  }

  const query = new URLSearchParams({ subject: 'unsubscribe' });
  return `mailto:${mailbox}?${query.toString()}`;
};

export const buildNewsletterUnsubscribeContext = (
  settings: { siteUrl: string; fromEmail?: string; replyTo?: string },
  recipientEmail: string
): NewsletterUnsubscribeContext => {
  const token = buildNewsletterUnsubscribeToken(recipientEmail);
  return {
    unsubscribeUrl: buildNewsletterUnsubscribeUrl(settings, recipientEmail, token),
    mailtoUnsubscribeUrl: buildNewsletterMailtoUnsubscribeUrl(settings)
  };
};
