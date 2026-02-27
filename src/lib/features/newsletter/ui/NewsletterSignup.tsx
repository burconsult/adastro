import React, { useState } from 'react';
import { normalizeFeatureFlag } from '@/lib/features/flags';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/lib/components/ui/dialog';

type NewsletterSignupProps = {
  tone?: 'default' | 'inverse';
};

export const NewsletterSignup: React.FC<NewsletterSignupProps> = ({ tone = 'default' }) => {
  const COOKIE_DISMISSED = 'adastro_newsletter_modal_dismissed';
  const COOKIE_SUBSCRIBED = 'adastro_newsletter_subscribed';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [requireConsentCheckbox, setRequireConsentCheckbox] = useState(true);
  const [consentLabel, setConsentLabel] = useState('I agree to receive email updates and can unsubscribe at any time.');
  const [consent, setConsent] = useState(false);
  const [doubleOptIn, setDoubleOptIn] = useState(false);
  const [signupFooterEnabled, setSignupFooterEnabled] = useState(true);
  const [signupModalEnabled, setSignupModalEnabled] = useState(false);
  const [signupModalDelaySeconds, setSignupModalDelaySeconds] = useState(12);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inverse = tone === 'inverse';

  const setCookie = React.useCallback((name: string, value: string, days: number) => {
    if (typeof document === 'undefined') return;
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  }, []);

  const hasCookie = React.useCallback((name: string) => {
    if (typeof document === 'undefined') return false;
    return document.cookie.split(';').some((entry) => entry.trim().startsWith(`${name}=`));
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const loadMeta = async () => {
      try {
        const response = await fetch('/api/features/newsletter/meta');
        if (!response.ok) {
          if (!cancelled) {
            setEnabled(false);
            setMetaLoaded(true);
          }
          return;
        }
        const payload = await response.json().catch(() => ({}));
        if (!cancelled) {
          setEnabled(normalizeFeatureFlag(payload.enabled, false));
          setRequireConsentCheckbox(normalizeFeatureFlag(payload.requireConsentCheckbox, true));
          setConsentLabel(typeof payload.consentLabel === 'string' && payload.consentLabel.trim().length > 0
            ? payload.consentLabel
            : 'I agree to receive email updates and can unsubscribe at any time.');
          setDoubleOptIn(normalizeFeatureFlag(payload.requireDoubleOptIn, false));
          setSignupFooterEnabled(normalizeFeatureFlag(payload.signupFooterEnabled, true));
          setSignupModalEnabled(normalizeFeatureFlag(payload.signupModalEnabled, false));
          const delay = Number(payload.signupModalDelaySeconds);
          setSignupModalDelaySeconds(Number.isFinite(delay) ? Math.max(1, Math.min(120, Math.round(delay))) : 12);
          setMetaLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setEnabled(false);
          setMetaLoaded(true);
        }
      }
    };
    void loadMeta();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!metaLoaded || !enabled || !signupModalEnabled) return;
    if (typeof window === 'undefined') return;
    if (window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/auth')) return;
    if (hasCookie(COOKIE_DISMISSED) || hasCookie(COOKIE_SUBSCRIBED)) return;

    const timer = window.setTimeout(() => {
      setShowModal(true);
    }, Math.max(1, signupModalDelaySeconds) * 1000);

    return () => window.clearTimeout(timer);
  }, [metaLoaded, enabled, signupModalEnabled, signupModalDelaySeconds, hasCookie]);

  if (!metaLoaded) {
    if (inverse) {
      return null;
    }
    return (
      <section
        aria-busy="true"
        className={[
          'rounded-2xl border p-4 sm:p-5',
          inverse
            ? 'border-background/20 bg-background/10 text-background backdrop-blur-sm'
            : 'border-border/70 bg-background/90'
        ].join(' ')}
      >
        <h3 className={`text-sm font-semibold uppercase tracking-wide ${inverse ? 'text-background' : 'text-foreground'}`}>Newsletter</h3>
        <p className={`mt-2 text-sm ${inverse ? 'text-background/80' : 'text-muted-foreground'}`}>Loading signup form…</p>
      </section>
    );
  }

  if (!enabled || (!signupFooterEnabled && !signupModalEnabled)) {
    return null;
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    try {
      setLoading(true);
      setMessage(null);
      setError(null);

      const response = await fetch('/api/features/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: showModal ? 'site-modal' : 'site-footer', consent })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Subscription failed');
      }

      if (payload.pendingConfirmation) {
        setMessage('Check your inbox and confirm your subscription to finish signup.');
        setCookie(COOKIE_DISMISSED, '1', 30);
      } else {
        setMessage('Subscribed. You will receive post updates.');
        setCookie(COOKIE_SUBSCRIBED, '1', 365);
      }
      setShowModal(false);
      setEmail('');
      setConsent(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Subscription failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {signupFooterEnabled && (
        <section
          className={[
            'rounded-2xl border p-4 shadow-sm sm:p-5',
            inverse
              ? 'border-background/20 bg-background/10 text-background backdrop-blur-sm'
              : 'border-border/70 bg-background/95'
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className={`text-sm font-semibold uppercase tracking-wide ${inverse ? 'text-background' : 'text-foreground'}`}>Newsletter</h3>
              <p className={`mt-2 text-sm ${inverse ? 'text-background/80' : 'text-muted-foreground'}`}>Get practical publishing updates and new articles. Unsubscribe any time.</p>
            </div>
            <span className={`hidden rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-wide sm:inline-flex ${inverse ? 'border-background/30 text-background/80' : 'border-border/70 text-muted-foreground'}`}>
              Updates
            </span>
          </div>
          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={[
                'w-full rounded-md border px-3 py-2 text-sm',
                inverse
                  ? 'border-background/30 bg-background text-foreground placeholder:text-muted-foreground'
                  : 'border-input bg-background'
              ].join(' ')}
              placeholder="you@example.com"
              maxLength={200}
              required
            />
            <button type="submit" className={`btn ${inverse ? 'btn-outline border-background/40 text-background hover:bg-background/20' : 'btn-primary'} min-w-[6.5rem]`} disabled={loading}>
              {loading ? 'Joining…' : 'Join'}
            </button>
          </form>
          {requireConsentCheckbox && (
            <label className={`mt-3 flex items-start gap-2 text-xs ${inverse ? 'text-background/80' : 'text-muted-foreground'}`}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-0.5 rounded border-input text-primary focus:ring-primary"
                required
              />
              <span>{consentLabel}</span>
            </label>
          )}
          {doubleOptIn && (
            <p className={`mt-2 text-xs ${inverse ? 'text-background/80' : 'text-muted-foreground'}`}>
              This list uses double opt-in. You will confirm by email before receiving updates.
            </p>
          )}
          {message && <p className={`mt-2 text-xs ${inverse ? 'text-background' : 'text-success'}`}>{message}</p>}
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </section>
      )}

      <Dialog open={showModal} onOpenChange={(next) => {
        if (!next && showModal) {
          setCookie(COOKIE_DISMISSED, '1', 30);
        }
        setShowModal(next);
      }}>
        <DialogContent className="max-w-lg p-7 sm:p-8">
          <DialogHeader className="mb-5">
            <DialogTitle>Get new articles by email</DialogTitle>
            <DialogDescription>
              Optional updates from this site. No spam, unsubscribe any time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <form onSubmit={onSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
                placeholder="you@example.com"
                maxLength={200}
                required
              />
              {requireConsentCheckbox && (
                <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    className="mt-0.5 rounded border-input text-primary focus:ring-primary"
                    required
                  />
                  <span>{consentLabel}</span>
                </label>
              )}
              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setCookie(COOKIE_DISMISSED, '1', 30);
                    setShowModal(false);
                  }}
                  disabled={loading}
                >
                  Not now
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Joining…' : 'Join Newsletter'}
                </button>
              </div>
            </form>
            {doubleOptIn && (
              <p className="text-xs text-muted-foreground">
                Double opt-in is enabled. You will confirm from your inbox before receiving updates.
              </p>
            )}
            {message && <p className="text-xs text-success">{message}</p>}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NewsletterSignup;
