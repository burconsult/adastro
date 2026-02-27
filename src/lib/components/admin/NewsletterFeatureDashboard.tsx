import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { AdminLoadingState } from './ListingPrimitives';

type DashboardTab = 'creator' | 'settings';

type CampaignArticle = {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  imageUrl?: string;
};

type MediaAsset = {
  id: string;
  url: string;
  altText?: string;
  caption?: string;
  mimeType?: string;
};

type CampaignPreview = {
  subject: string;
  html: string;
  provider: string;
  articlesCount?: number;
};

type NewsletterSettingsState = {
  enabled: boolean;
  provider: 'console' | 'resend' | 'ses';
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
  subscriptionSubject: string;
  subscriptionHtml: string;
  confirmationSubject: string;
  confirmationHtml: string;
  newPostSubject: string;
  newPostHtml: string;
  campaignSubject: string;
  campaignHtml: string;
};

const SETTINGS_KEYS = [
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
  'features.newsletter.templates.campaignHtml'
] as const;

const DEFAULT_SETTINGS: NewsletterSettingsState = {
  enabled: false,
  provider: 'console',
  fromName: 'AdAstro',
  fromEmail: 'newsletter@example.com',
  replyTo: '',
  sendWelcomeEmail: true,
  requireDoubleOptIn: false,
  requireConsentCheckbox: true,
  signupFooterEnabled: true,
  signupModalEnabled: false,
  signupModalDelaySeconds: 12,
  consentLabel: 'I agree to receive email updates and can unsubscribe at any time.',
  complianceFooterHtml:
    '<p style="font-size:12px;color:#666">Unsubscribe: <a href="{{unsubscribeUrl}}">{{unsubscribeUrl}}</a></p>',
  maxRecipientsPerCampaign: 1000,
  subscriptionSubject: 'Welcome to {{siteTitle}}',
  subscriptionHtml: '<p>Thanks for subscribing to {{siteTitle}}.</p>',
  confirmationSubject: 'Confirm your subscription to {{siteTitle}}',
  confirmationHtml: '<p>Confirm your subscription: <a href="{{confirmUrl}}">Confirm</a></p>',
  newPostSubject: 'New post on {{siteTitle}}: {{postTitle}}',
  newPostHtml:
    '<p><strong>{{postTitle}}</strong></p><p><a href="{{postUrl}}">Read the post</a></p>',
  campaignSubject: '{{siteTitle}} update',
  campaignHtml:
    '<div><p>{{introHtml}}</p>{{articleCardsHtml}}<p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p></div>',
};

const requestJson = async (url: string, method: 'GET' | 'POST' = 'GET', body?: Record<string, unknown>) => {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as any)?.error || `Request failed: ${response.status}`);
  }
  return payload;
};

const boolValue = (value: unknown, fallback: boolean) => {
  if (typeof value === 'boolean') return value;
  return fallback;
};

const stringValue = (value: unknown, fallback = '') =>
  (typeof value === 'string' ? value : fallback);

const numberValue = (value: unknown, fallback: number) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const excerptText = (value: string) =>
  value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);

export default function NewsletterFeatureDashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('creator');
  const [settings, setSettings] = useState<NewsletterSettingsState>(DEFAULT_SETTINGS);
  const [campaignSubject, setCampaignSubject] = useState('');
  const [campaignIntroHtml, setCampaignIntroHtml] = useState('');
  const [campaignTemplateHtml, setCampaignTemplateHtml] = useState(DEFAULT_SETTINGS.campaignHtml);
  const [campaignArticles, setCampaignArticles] = useState<CampaignArticle[]>([]);
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [testEmail, setTestEmail] = useState('');
  const [preview, setPreview] = useState<CampaignPreview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedImages = useMemo(() => {
    const selected = new Set(selectedImageIds);
    return mediaAssets.filter((asset) => selected.has(asset.id));
  }, [mediaAssets, selectedImageIds]);
  const creatorDisabled = !settings.enabled;

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [settingsPayload, mediaPayload] = await Promise.all([
          requestJson(`/api/admin/settings?keys=${encodeURIComponent(SETTINGS_KEYS.join(','))}`),
          requestJson('/api/admin/media?mimeType=image&limit=24')
        ]);

        if (cancelled) return;

        const nextSettings: NewsletterSettingsState = {
          enabled: boolValue(settingsPayload['features.newsletter.enabled'], DEFAULT_SETTINGS.enabled),
          provider: (
            ['console', 'resend', 'ses'].includes(String(settingsPayload['features.newsletter.provider']))
              ? settingsPayload['features.newsletter.provider']
              : DEFAULT_SETTINGS.provider
          ) as NewsletterSettingsState['provider'],
          fromName: stringValue(settingsPayload['features.newsletter.fromName'], DEFAULT_SETTINGS.fromName),
          fromEmail: stringValue(settingsPayload['features.newsletter.fromEmail'], DEFAULT_SETTINGS.fromEmail),
          replyTo: stringValue(settingsPayload['features.newsletter.replyTo'], DEFAULT_SETTINGS.replyTo),
          sendWelcomeEmail: boolValue(settingsPayload['features.newsletter.sendWelcomeEmail'], DEFAULT_SETTINGS.sendWelcomeEmail),
          requireDoubleOptIn: boolValue(settingsPayload['features.newsletter.requireDoubleOptIn'], DEFAULT_SETTINGS.requireDoubleOptIn),
          requireConsentCheckbox: boolValue(settingsPayload['features.newsletter.requireConsentCheckbox'], DEFAULT_SETTINGS.requireConsentCheckbox),
          signupFooterEnabled: boolValue(settingsPayload['features.newsletter.signupFooterEnabled'], DEFAULT_SETTINGS.signupFooterEnabled),
          signupModalEnabled: boolValue(settingsPayload['features.newsletter.signupModalEnabled'], DEFAULT_SETTINGS.signupModalEnabled),
          signupModalDelaySeconds: Math.max(1, Math.min(120, numberValue(settingsPayload['features.newsletter.signupModalDelaySeconds'], DEFAULT_SETTINGS.signupModalDelaySeconds))),
          consentLabel: stringValue(settingsPayload['features.newsletter.consentLabel'], DEFAULT_SETTINGS.consentLabel),
          complianceFooterHtml: stringValue(settingsPayload['features.newsletter.complianceFooterHtml'], DEFAULT_SETTINGS.complianceFooterHtml),
          maxRecipientsPerCampaign: Math.max(1, numberValue(settingsPayload['features.newsletter.maxRecipientsPerCampaign'], DEFAULT_SETTINGS.maxRecipientsPerCampaign)),
          subscriptionSubject: stringValue(settingsPayload['features.newsletter.templates.subscriptionSubject'], DEFAULT_SETTINGS.subscriptionSubject),
          subscriptionHtml: stringValue(settingsPayload['features.newsletter.templates.subscriptionHtml'], DEFAULT_SETTINGS.subscriptionHtml),
          confirmationSubject: stringValue(settingsPayload['features.newsletter.templates.confirmationSubject'], DEFAULT_SETTINGS.confirmationSubject),
          confirmationHtml: stringValue(settingsPayload['features.newsletter.templates.confirmationHtml'], DEFAULT_SETTINGS.confirmationHtml),
          newPostSubject: stringValue(settingsPayload['features.newsletter.templates.newPostSubject'], DEFAULT_SETTINGS.newPostSubject),
          newPostHtml: stringValue(settingsPayload['features.newsletter.templates.newPostHtml'], DEFAULT_SETTINGS.newPostHtml),
          campaignSubject: stringValue(settingsPayload['features.newsletter.templates.campaignSubject'], DEFAULT_SETTINGS.campaignSubject),
          campaignHtml: stringValue(settingsPayload['features.newsletter.templates.campaignHtml'], DEFAULT_SETTINGS.campaignHtml),
        };

        setSettings(nextSettings);
        setCampaignTemplateHtml(nextSettings.campaignHtml);

        if (nextSettings.enabled) {
          try {
            const articlesPayload = await requestJson('/api/features/newsletter/articles');
            const articles = Array.isArray(articlesPayload?.articles) ? articlesPayload.articles as CampaignArticle[] : [];
            setCampaignArticles(articles);
            setSelectedArticleIds(articles.slice(0, 3).map((article) => article.id));
          } catch {
            setCampaignArticles([]);
            setSelectedArticleIds([]);
          }
        } else {
          setCampaignArticles([]);
          setSelectedArticleIds([]);
        }

        const assets = Array.isArray(mediaPayload?.assets) ? mediaPayload.assets as MediaAsset[] : [];
        setMediaAssets(assets);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load newsletter data.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const imageGalleryHtml = useMemo(() => {
    if (selectedImages.length === 0) return '';
    const items = selectedImages
      .map((asset) => {
        const altText = (asset.altText || asset.caption || 'Campaign image').replace(/"/g, '&quot;');
        const caption = asset.caption ? `<figcaption style="font-size:12px;color:#6b7280;margin-top:6px;">${asset.caption}</figcaption>` : '';
        return `
          <figure style="margin:0 0 16px;">
            <img src="${asset.url}" alt="${altText}" style="width:100%;height:auto;display:block;border-radius:8px;" />
            ${caption}
          </figure>
        `;
      })
      .join('');

    return `<section style="margin:20px 0;">${items}</section>`;
  }, [selectedImages]);

  const composedIntroHtml = useMemo(() => `${campaignIntroHtml}${imageGalleryHtml}`, [campaignIntroHtml, imageGalleryHtml]);

  const saveSettings = async () => {
    try {
      setBusy(true);
      setError(null);
      setSuccess(null);

      const payload = {
        'features.newsletter.enabled': settings.enabled,
        'features.newsletter.provider': settings.provider,
        'features.newsletter.fromName': settings.fromName,
        'features.newsletter.fromEmail': settings.fromEmail,
        'features.newsletter.replyTo': settings.replyTo,
        'features.newsletter.sendWelcomeEmail': settings.sendWelcomeEmail,
        'features.newsletter.requireDoubleOptIn': settings.requireDoubleOptIn,
        'features.newsletter.requireConsentCheckbox': settings.requireConsentCheckbox,
        'features.newsletter.signupFooterEnabled': settings.signupFooterEnabled,
        'features.newsletter.signupModalEnabled': settings.signupModalEnabled,
        'features.newsletter.signupModalDelaySeconds': settings.signupModalDelaySeconds,
        'features.newsletter.consentLabel': settings.consentLabel,
        'features.newsletter.complianceFooterHtml': settings.complianceFooterHtml,
        'features.newsletter.maxRecipientsPerCampaign': settings.maxRecipientsPerCampaign,
        'features.newsletter.templates.subscriptionSubject': settings.subscriptionSubject,
        'features.newsletter.templates.subscriptionHtml': settings.subscriptionHtml,
        'features.newsletter.templates.confirmationSubject': settings.confirmationSubject,
        'features.newsletter.templates.confirmationHtml': settings.confirmationHtml,
        'features.newsletter.templates.newPostSubject': settings.newPostSubject,
        'features.newsletter.templates.newPostHtml': settings.newPostHtml,
        'features.newsletter.templates.campaignSubject': settings.campaignSubject,
        'features.newsletter.templates.campaignHtml': settings.campaignHtml,
      };

      await requestJson('/api/admin/settings', 'PUT', { settings: payload });
      setSuccess('Newsletter settings saved.');
      setCampaignTemplateHtml(settings.campaignHtml);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save settings.');
    } finally {
      setBusy(false);
    }
  };

  const previewCampaign = async () => {
    const payload = await requestJson('/api/features/newsletter/preview-campaign', 'POST', {
      subject: campaignSubject,
      introHtml: composedIntroHtml,
      templateHtml: campaignTemplateHtml,
      articleIds: selectedArticleIds,
    });

    setPreview({
      subject: payload.subject,
      html: payload.html,
      provider: payload.provider,
      articlesCount: payload.articlesCount,
    });
    setPreviewOpen(true);
  };

  const sendTestCampaign = async () => {
    const payload = await requestJson('/api/features/newsletter/send-test-campaign', 'POST', {
      email: testEmail,
      subject: campaignSubject,
      introHtml: composedIntroHtml,
      templateHtml: campaignTemplateHtml,
      articleIds: selectedArticleIds,
    });
    const provider = typeof payload?.provider === 'string' ? payload.provider : settings.provider;
    if (provider === 'console') {
      setSuccess('Test campaign simulated in console mode (no real email delivery). Switch provider to Resend or Amazon SES and save settings to send real emails.');
      return;
    }
    setSuccess(`Test campaign email sent via ${provider}${payload?.messageId ? ` (${payload.messageId})` : ''}.`);
  };

  const sendCampaign = async () => {
    const payload = await requestJson('/api/features/newsletter/send-campaign', 'POST', {
      subject: campaignSubject,
      introHtml: composedIntroHtml,
      templateHtml: campaignTemplateHtml,
      articleIds: selectedArticleIds,
    });

    setSuccess(`Campaign sent: ${payload.delivered ?? 0} delivered, ${payload.failed ?? 0} failed.`);
  };

  const runCreatorAction = async (action: () => Promise<void>, fallbackMessage: string) => {
    try {
      setBusy(true);
      setError(null);
      setSuccess(null);
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : fallbackMessage);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-2">
        <AdminLoadingState label="Loading newsletter dashboard..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn ${activeTab === 'creator' ? 'btn-primary' : 'btn-outline'} h-9 px-4 text-sm`}
          onClick={() => setActiveTab('creator')}
        >
          Campaign Creator
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-outline'} h-9 px-4 text-sm`}
          onClick={() => setActiveTab('settings')}
        >
          Newsletter Settings
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          {success}
        </div>
      )}

      {activeTab === 'creator' && (
        <div className="grid gap-6 xl:grid-cols-5">
          <div className="space-y-4 xl:col-span-3">
            <div className="card p-4 space-y-3">
              <h3 className="text-base font-semibold">Custom Newsletter</h3>
              <p className="text-xs text-muted-foreground">
                Build and preview a campaign using article cards, optional media images, and editable template HTML.
              </p>
              {creatorDisabled && (
                <p className="rounded-md border border-amber-300/40 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
                  Newsletter is currently disabled. Enable it in the settings tab to run previews and send campaigns.
                </p>
              )}

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground" htmlFor="campaign-subject">Campaign subject (optional)</label>
                <input
                  id="campaign-subject"
                  type="text"
                  className="w-full rounded-md border border-input px-3 py-2 text-sm"
                  value={campaignSubject}
                  onChange={(event) => setCampaignSubject(event.target.value)}
                  placeholder={settings.campaignSubject}
                  maxLength={220}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground" htmlFor="campaign-intro">Intro HTML</label>
                <textarea
                  id="campaign-intro"
                  className="w-full rounded-md border border-input px-3 py-2 text-sm"
                  rows={5}
                  value={campaignIntroHtml}
                  onChange={(event) => setCampaignIntroHtml(event.target.value)}
                  placeholder="<p>Highlights from this week…</p>"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground" htmlFor="campaign-template">Template HTML override</label>
                <textarea
                  id="campaign-template"
                  className="w-full rounded-md border border-input px-3 py-2 font-mono text-xs"
                  rows={8}
                  value={campaignTemplateHtml}
                  onChange={(event) => setCampaignTemplateHtml(event.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Template variables: {'{{siteTitle}}'}, {'{{introHtml}}'}, {'{{articleCardsHtml}}'}, {'{{unsubscribeUrl}}'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground" htmlFor="newsletter-test-email">Send test email</label>
                  <input
                    id="newsletter-test-email"
                    type="email"
                    className="w-full rounded-md border border-input px-3 py-2 text-sm"
                    value={testEmail}
                    onChange={(event) => setTestEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-outline h-8 px-3 text-xs"
                  onClick={() => void runCreatorAction(previewCampaign, 'Failed to load campaign preview.')}
                  disabled={busy || creatorDisabled || selectedArticleIds.length === 0}
                >
                  Preview Campaign
                </button>
                <button
                  type="button"
                  className="btn btn-outline h-8 px-3 text-xs"
                  onClick={() => void runCreatorAction(sendTestCampaign, 'Failed to send test campaign.')}
                  disabled={busy || creatorDisabled || !testEmail.trim() || selectedArticleIds.length === 0}
                >
                  Send Test
                </button>
                <button
                  type="button"
                  className="btn btn-primary h-8 px-3 text-xs"
                  onClick={() => void runCreatorAction(sendCampaign, 'Failed to send campaign.')}
                  disabled={busy || creatorDisabled || selectedArticleIds.length === 0}
                >
                  Send To Subscribers
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4 xl:col-span-2">
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Article Cards</h4>
                <button
                  type="button"
                  className="btn btn-outline h-7 px-2 text-[11px]"
                  onClick={() => setSelectedArticleIds(campaignArticles.slice(0, 3).map((article) => article.id))}
                  disabled={campaignArticles.length === 0 || busy}
                >
                  Use latest 3
                </button>
              </div>
              <div className="max-h-72 space-y-2 overflow-auto rounded-md border border-border/60 p-2">
                {campaignArticles.length > 0 ? campaignArticles.map((article) => (
                  <label key={article.id} className="flex items-start gap-2 rounded-md px-1 py-1 text-xs text-foreground hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={selectedArticleIds.includes(article.id)}
                      onChange={() =>
                        setSelectedArticleIds((prev) =>
                          prev.includes(article.id)
                            ? prev.filter((id) => id !== article.id)
                            : [...prev, article.id].slice(0, 12)
                        )
                      }
                      className="mt-0.5 rounded border-input text-primary focus:ring-primary"
                    />
                    <span>
                      <span className="font-medium">{article.title}</span>
                      <span className="block text-muted-foreground">{excerptText(article.excerpt)}</span>
                    </span>
                  </label>
                )) : (
                  <p className="text-xs text-muted-foreground">No published articles available yet.</p>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Selected: {selectedArticleIds.length} article{selectedArticleIds.length === 1 ? '' : 's'} (max 12)
              </p>
            </div>

            <div className="card p-4 space-y-3">
              <h4 className="text-sm font-semibold">Media Images</h4>
              <p className="text-[11px] text-muted-foreground">
                Selected images are inserted below the intro block in the campaign email body.
              </p>
              <div className="max-h-72 space-y-2 overflow-auto rounded-md border border-border/60 p-2">
                {mediaAssets.length > 0 ? mediaAssets.map((asset) => (
                  <label key={asset.id} className="flex items-start gap-2 rounded-md px-1 py-1 text-xs hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={selectedImageIds.includes(asset.id)}
                      onChange={() =>
                        setSelectedImageIds((prev) =>
                          prev.includes(asset.id)
                            ? prev.filter((id) => id !== asset.id)
                            : [...prev, asset.id].slice(0, 8)
                        )
                      }
                      className="mt-0.5 rounded border-input text-primary focus:ring-primary"
                    />
                    <img src={asset.url} alt={asset.altText || ''} className="h-10 w-10 rounded object-cover" />
                    <span className="min-w-0 flex-1 text-muted-foreground">
                      <span className="block truncate text-foreground">{asset.altText || 'Image asset'}</span>
                      <span className="block truncate">{asset.caption || asset.url}</span>
                    </span>
                  </label>
                )) : (
                  <p className="text-xs text-muted-foreground">No images found in media library.</p>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Selected: {selectedImageIds.length} image{selectedImageIds.length === 1 ? '' : 's'} (max 8)
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="card p-4 space-y-4">
            <h3 className="text-base font-semibold">Delivery Settings</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-foreground">
                <span>Enable newsletter</span>
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(event) => setSettings((prev) => ({ ...prev, enabled: event.target.checked }))}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-foreground">
                <span>Provider</span>
                <select
                  value={settings.provider}
                  onChange={(event) =>
                    setSettings((prev) => ({ ...prev, provider: event.target.value as NewsletterSettingsState['provider'] }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="console">Console</option>
                  <option value="resend">Resend</option>
                  <option value="ses">Amazon SES</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium text-foreground">
                <span>From name</span>
                <input
                  type="text"
                  value={settings.fromName}
                  onChange={(event) => setSettings((prev) => ({ ...prev, fromName: event.target.value }))}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-foreground">
                <span>From email</span>
                <input
                  type="email"
                  value={settings.fromEmail}
                  onChange={(event) => setSettings((prev) => ({ ...prev, fromEmail: event.target.value }))}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-foreground">
                <span>Reply-to email</span>
                <input
                  type="email"
                  value={settings.replyTo}
                  onChange={(event) => setSettings((prev) => ({ ...prev, replyTo: event.target.value }))}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-foreground">
                <span>Max recipients per campaign</span>
                <input
                  type="number"
                  min={1}
                  max={25000}
                  value={settings.maxRecipientsPerCampaign}
                  onChange={(event) =>
                    setSettings((prev) => ({ ...prev, maxRecipientsPerCampaign: Math.max(1, Number(event.target.value || 1)) }))
                  }
                  className="w-full rounded-md border border-input px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={settings.sendWelcomeEmail}
                  onChange={(event) => setSettings((prev) => ({ ...prev, sendWelcomeEmail: event.target.checked }))}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
                <span>Send welcome email</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={settings.requireDoubleOptIn}
                  onChange={(event) => setSettings((prev) => ({ ...prev, requireDoubleOptIn: event.target.checked }))}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
                <span>Require double opt-in</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={settings.requireConsentCheckbox}
                  onChange={(event) => setSettings((prev) => ({ ...prev, requireConsentCheckbox: event.target.checked }))}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
                <span>Require consent checkbox</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={settings.signupFooterEnabled}
                  onChange={(event) => setSettings((prev) => ({ ...prev, signupFooterEnabled: event.target.checked }))}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
                <span>Show footer signup form</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={settings.signupModalEnabled}
                  onChange={(event) => setSettings((prev) => ({ ...prev, signupModalEnabled: event.target.checked }))}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
                <span>Show signup modal</span>
              </label>
            </div>

            <label className="space-y-1 text-xs font-medium text-foreground">
              <span>Signup modal delay (seconds)</span>
              <input
                type="number"
                min={1}
                max={120}
                value={settings.signupModalDelaySeconds}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    signupModalDelaySeconds: Math.max(1, Math.min(120, Number(event.target.value || 12)))
                  }))
                }
                className="w-full rounded-md border border-input px-3 py-2 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                When the popup is enabled, the newsletter form can appear on public pages after this delay. Visitors who close or subscribe will not see it again for a while.
              </p>
            </label>

            <label className="space-y-1 text-xs font-medium text-foreground">
              <span>Consent label</span>
              <input
                type="text"
                value={settings.consentLabel}
                onChange={(event) => setSettings((prev) => ({ ...prev, consentLabel: event.target.value }))}
                className="w-full rounded-md border border-input px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1 text-xs font-medium text-foreground">
              <span>Compliance footer HTML</span>
              <textarea
                rows={4}
                value={settings.complianceFooterHtml}
                onChange={(event) => setSettings((prev) => ({ ...prev, complianceFooterHtml: event.target.value }))}
                className="w-full rounded-md border border-input px-3 py-2 font-mono text-xs"
              />
            </label>
          </div>

          <div className="card p-4 space-y-4">
            <h3 className="text-base font-semibold">Template Settings</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              <TemplateField
                label="Subscription subject"
                value={settings.subscriptionSubject}
                onChange={(value) => setSettings((prev) => ({ ...prev, subscriptionSubject: value }))}
              />
              <TemplateField
                label="Confirmation subject"
                value={settings.confirmationSubject}
                onChange={(value) => setSettings((prev) => ({ ...prev, confirmationSubject: value }))}
              />
              <TemplateField
                label="New post subject"
                value={settings.newPostSubject}
                onChange={(value) => setSettings((prev) => ({ ...prev, newPostSubject: value }))}
              />
              <TemplateField
                label="Campaign subject"
                value={settings.campaignSubject}
                onChange={(value) => setSettings((prev) => ({ ...prev, campaignSubject: value }))}
              />
            </div>

            <TemplateField
              label="Subscription HTML"
              value={settings.subscriptionHtml}
              multiline
              onChange={(value) => setSettings((prev) => ({ ...prev, subscriptionHtml: value }))}
            />
            <TemplateField
              label="Confirmation HTML"
              value={settings.confirmationHtml}
              multiline
              onChange={(value) => setSettings((prev) => ({ ...prev, confirmationHtml: value }))}
            />
            <TemplateField
              label="New post HTML"
              value={settings.newPostHtml}
              multiline
              onChange={(value) => setSettings((prev) => ({ ...prev, newPostHtml: value }))}
            />
            <TemplateField
              label="Campaign HTML"
              value={settings.campaignHtml}
              multiline
              onChange={(value) => setSettings((prev) => ({ ...prev, campaignHtml: value }))}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary h-8 px-3 text-xs"
                onClick={() => void saveSettings()}
                disabled={busy}
              >
                Save newsletter settings
              </button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.subject || 'Campaign preview'}</DialogTitle>
            <DialogDescription>
              Provider: {preview?.provider || 'unknown'}
              {typeof preview?.articlesCount === 'number' ? ` · Articles: ${preview.articlesCount}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div
            className="max-h-[65vh] overflow-auto rounded-md border border-border/70 bg-background p-4"
            dangerouslySetInnerHTML={{ __html: preview?.html || '' }}
          />
          <DialogFooter>
            <button type="button" className="btn btn-outline" onClick={() => setPreviewOpen(false)}>
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type TemplateFieldProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
};

function TemplateField({ label, value, onChange, multiline = false }: TemplateFieldProps) {
  return (
    <label className="space-y-1 text-xs font-medium text-foreground">
      <span>{label}</span>
      {multiline ? (
        <textarea
          rows={4}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-md border border-input px-3 py-2 font-mono text-xs"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-md border border-input px-3 py-2 text-sm"
        />
      )}
    </label>
  );
}
