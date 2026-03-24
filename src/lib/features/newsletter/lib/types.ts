export const NEWSLETTER_PROVIDER_VALUES = ['console', 'resend', 'ses'] as const;

export type NewsletterProviderKey = typeof NEWSLETTER_PROVIDER_VALUES[number];

export type NewsletterSettingsState = {
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
  subscriptionSubject: string;
  subscriptionHtml: string;
  confirmationSubject: string;
  confirmationHtml: string;
  newPostSubject: string;
  newPostHtml: string;
  campaignSubject: string;
  campaignHtml: string;
};

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

export type NewsletterUnsubscribeContext = {
  unsubscribeUrl: string;
  mailtoUnsubscribeUrl: string | null;
};

export type NewsletterMessage = {
  to: string;
  subject: string;
  html: string;
  unsubscribeContext: NewsletterUnsubscribeContext;
};

export type CampaignArticleCard = {
  title: string;
  excerpt: string;
  url: string;
  imageUrl?: string;
};

export type CampaignArticle = {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  imageUrl?: string;
};

export type CampaignPostPayload = {
  postId?: string;
  title: string;
  excerpt: string;
  url: string;
  status?: string;
};

export type NewsletterPublicMeta = {
  enabled: boolean;
  provider: NewsletterProviderKey;
  requireConsentCheckbox: boolean;
  consentLabel: string;
  requireDoubleOptIn: boolean;
  signupFooterEnabled: boolean;
  signupModalEnabled: boolean;
  signupModalDelaySeconds: number;
};

export type NewsletterSubscriberSummary = {
  total: number;
  pending: number;
  subscribed: number;
  unsubscribed: number;
};

export type NewsletterCampaignSummary = {
  total: number;
  draft: number;
  sending: number;
  completed: number;
  partial: number;
  failed: number;
};

export type NewsletterCampaignStatusItem = {
  id: string;
  templateKey: string;
  subject: string;
  provider: NewsletterProviderKey;
  status: string;
  recipientsCount: number;
  deliveredCount: number;
  failedCount: number;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
};

export type NewsletterAdminStatus = {
  enabled: boolean;
  provider: NewsletterProviderKey;
  providerConfigured: boolean;
  providerEnvHint: string;
  sendWelcomeEmail: boolean;
  requireDoubleOptIn: boolean;
  requireConsentCheckbox: boolean;
  signupFooterEnabled: boolean;
  signupModalEnabled: boolean;
  signupModalDelaySeconds: number;
  maxRecipientsPerCampaign: number;
  siteUrl: string;
  subscribers: NewsletterSubscriberSummary;
  campaigns: NewsletterCampaignSummary;
  recentCampaigns: NewsletterCampaignStatusItem[];
};

export type NewsletterRecipient = {
  id: string;
  email: string;
};

export type NewsletterSendResult = {
  success: boolean;
  recipients: number;
  delivered: number;
  failed: number;
  campaignId?: string;
  warnings: string[];
};

export class NewsletterFeatureError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'NewsletterFeatureError';
    this.statusCode = statusCode;
  }
}
