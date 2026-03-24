import { randomUUID } from 'node:crypto';
import type { AuthUser } from '@/lib/auth/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase';

import { buildConfirmationMessage, buildSubscriptionMessage } from './template-service.js';
import { sendNewsletterMessage } from './delivery-service.js';
import { readNewsletterUnsubscribeToken } from './unsubscribe-link.js';
import type { NewsletterRuntimeSettings } from './types.js';
import { NewsletterFeatureError } from './types.js';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const MAX_EMAIL_LENGTH = 200;

const sanitizeText = (value: unknown, maxLength: number) =>
  (typeof value === 'string' ? value.trim() : '').slice(0, maxLength);

export const normalizeEmail = (value: unknown) =>
  sanitizeText(value, MAX_EMAIL_LENGTH).toLowerCase();

const isMissingColumnError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || '');
  return /column .* does not exist/i.test(message);
};

const resolveSubscriptionAuthUserId = (authenticatedUser: AuthUser | null | undefined, email: string) => {
  if (!authenticatedUser) return undefined;
  return normalizeEmail(authenticatedUser.email) === email ? authenticatedUser.id : undefined;
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
  if (!EMAIL_RE.test(normalizedEmail)) {
    throw new NewsletterFeatureError('Valid email is required', 400);
  }

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

export const subscribeNewsletter = async (input: {
  settings: NewsletterRuntimeSettings;
  email: string;
  source: string;
  consent: boolean;
  authenticatedUser?: AuthUser | null;
}) => {
  const email = normalizeEmail(input.email);
  if (!EMAIL_RE.test(email)) {
    throw new NewsletterFeatureError('Valid email is required', 400);
  }
  if (input.settings.requireConsentCheckbox && !input.consent) {
    throw new NewsletterFeatureError('Explicit consent is required before subscribing.', 400);
  }

  const { data: previousSubscriber, error: previousError } = await supabaseAdmin
    .from('newsletter_subscribers')
    .select('status')
    .eq('email', email)
    .limit(1)
    .maybeSingle();

  if (previousError) {
    throw previousError;
  }
  if (previousSubscriber?.status === 'subscribed') {
    return { success: true, alreadySubscribed: true, pendingConfirmation: false };
  }

  const authUserId = resolveSubscriptionAuthUserId(input.authenticatedUser, email);

  if (input.settings.requireDoubleOptIn) {
    const token = randomUUID();
    await syncNewsletterSubscription({
      authUserId,
      email,
      source: input.source,
      optedIn: true,
      status: 'pending',
      confirmationToken: token,
      consent: input.consent
    });
    const confirmation = buildConfirmationMessage(input.settings, email, token);
    await sendNewsletterMessage(input.settings, confirmation);
    return { success: true, alreadySubscribed: false, pendingConfirmation: true };
  }

  await syncNewsletterSubscription({
    authUserId,
    email,
    source: input.source,
    optedIn: true,
    status: 'subscribed',
    consent: input.consent
  });

  if (input.settings.sendWelcomeEmail && previousSubscriber?.status !== 'subscribed') {
    const welcome = buildSubscriptionMessage(input.settings, email);
    await sendNewsletterMessage(input.settings, welcome);
  }

  return { success: true, alreadySubscribed: false, pendingConfirmation: false };
};

export const confirmNewsletterSubscription = async (input: {
  settings: NewsletterRuntimeSettings;
  email: string;
  token: string;
}) => {
  const email = normalizeEmail(input.email);
  const token = sanitizeText(input.token, 120);
  if (!EMAIL_RE.test(email) || !token) {
    throw new NewsletterFeatureError('Invalid confirmation link', 400);
  }

  const { data: subscriber, error: lookupError } = await (supabaseAdmin as any)
    .from('newsletter_subscribers')
    .select('id, status')
    .eq('email', email)
    .eq('confirmation_token', token)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    if (/confirmation_token/i.test(String(lookupError.message || ''))) {
      throw new NewsletterFeatureError(
        'Newsletter schema is outdated. Run the latest newsletter feature migration and try again.',
        500
      );
    }
    throw new NewsletterFeatureError('Confirmation link is invalid or expired.', 400);
  }
  if (!subscriber) {
    throw new NewsletterFeatureError('Confirmation link is invalid or expired.', 400);
  }

  if (subscriber.status !== 'subscribed') {
    await (supabaseAdmin as any)
      .from('newsletter_subscribers')
      .update({
        status: 'subscribed',
        confirmation_token: null,
        confirmed_at: new Date().toISOString(),
        unsubscribed_at: null
      })
      .eq('id', subscriber.id);

    if (input.settings.sendWelcomeEmail) {
      try {
        const welcome = buildSubscriptionMessage(input.settings, email);
        await sendNewsletterMessage(input.settings, welcome);
      } catch (error) {
        console.error('Newsletter welcome-after-confirm failed:', error);
      }
    }
  }

  return {
    email,
    siteTitle: input.settings.siteTitle,
    siteUrl: input.settings.siteUrl
  };
};

export const unsubscribeNewsletterSubscription = async (input: {
  token?: string;
  email?: string;
  source?: string;
  authenticatedUser?: AuthUser | null;
}) => {
  const token = sanitizeText(input.token, 4096);
  const tokenPayload = token ? readNewsletterUnsubscribeToken(token) : null;
  const authenticatedEmail = normalizeEmail(input.authenticatedUser?.email);
  const requestedEmail = normalizeEmail(input.email);

  let targetEmail = '';
  let authUserId: string | undefined;

  if (tokenPayload) {
    targetEmail = tokenPayload.email;
  } else if (input.authenticatedUser && EMAIL_RE.test(authenticatedEmail)) {
    if (requestedEmail && requestedEmail !== authenticatedEmail) {
      throw new NewsletterFeatureError('You can only manage your own newsletter subscription.', 403);
    }
    targetEmail = authenticatedEmail;
    authUserId = input.authenticatedUser.id;
  } else {
    throw new NewsletterFeatureError(
      'A signed unsubscribe link or authenticated session is required to unsubscribe.',
      401
    );
  }

  await syncNewsletterSubscription({
    authUserId,
    email: targetEmail,
    source: sanitizeText(input.source, 80) || (tokenPayload ? 'unsubscribe-link' : 'unsubscribe'),
    optedIn: false
  });

  return {
    email: targetEmail,
    usedToken: Boolean(tokenPayload)
  };
};
