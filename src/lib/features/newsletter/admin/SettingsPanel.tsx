import React from 'react';
import type { FeatureSettingsPanelProps } from '../../types.js';

export const NewsletterSettingsPanel: React.FC<FeatureSettingsPanelProps> = ({
  getSetting,
  getValue,
  renderSetting,
  t
}) => {
  const enabledSetting = getSetting('features.newsletter.enabled');
  const providerSetting = getSetting('features.newsletter.provider');
  const fromNameSetting = getSetting('features.newsletter.fromName');
  const fromEmailSetting = getSetting('features.newsletter.fromEmail');
  const replyToSetting = getSetting('features.newsletter.replyTo');
  const sendWelcomeSetting = getSetting('features.newsletter.sendWelcomeEmail');
  const requireDoubleOptInSetting = getSetting('features.newsletter.requireDoubleOptIn');
  const requireConsentCheckboxSetting = getSetting('features.newsletter.requireConsentCheckbox');
  const signupFooterEnabledSetting = getSetting('features.newsletter.signupFooterEnabled');
  const consentLabelSetting = getSetting('features.newsletter.consentLabel');
  const complianceFooterSetting = getSetting('features.newsletter.complianceFooterHtml');
  const maxRecipientsSetting = getSetting('features.newsletter.maxRecipientsPerCampaign');
  const subscriptionSubjectSetting = getSetting('features.newsletter.templates.subscriptionSubject');
  const subscriptionHtmlSetting = getSetting('features.newsletter.templates.subscriptionHtml');
  const confirmationSubjectSetting = getSetting('features.newsletter.templates.confirmationSubject');
  const confirmationHtmlSetting = getSetting('features.newsletter.templates.confirmationHtml');
  const newPostSubjectSetting = getSetting('features.newsletter.templates.newPostSubject');
  const newPostHtmlSetting = getSetting('features.newsletter.templates.newPostHtml');
  const campaignSubjectSetting = getSetting('features.newsletter.templates.campaignSubject');
  const campaignHtmlSetting = getSetting('features.newsletter.templates.campaignHtml');
  const provider = String(getValue('features.newsletter.provider') || 'console').toLowerCase();

  if (!enabledSetting) {
    return null;
  }

  return (
    <div className="card p-4 space-y-4">
      <div>
        <h3 className="text-base font-semibold">{t('settings.features.newsletter.title', 'Newsletter')}</h3>
        <p className="text-xs text-muted-foreground">{t('settings.features.newsletter.description', 'Turn on email subscriptions and campaigns.')}</p>
      </div>
      {renderSetting(enabledSetting)}
      {providerSetting && renderSetting(providerSetting)}
      <div className="rounded-md border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
        {provider === 'resend' && 'Provider env required: RESEND_API_KEY.'}
        {provider === 'ses' && 'Provider env required: AWS_SES_REGION, AWS_SES_SMTP_USER, AWS_SES_SMTP_PASS (optional: AWS_SES_SMTP_HOST, AWS_SES_SMTP_PORT).'}
        {provider !== 'resend' && provider !== 'ses' && 'Provider mode: console (no external email provider configured).'}
      </div>
      <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
        Frontend signup display can be configured independently for the footer form and the delayed modal popup.
        Add provider API keys in your host environment variables (Vercel/Netlify), then redeploy before switching provider from console.
      </div>
      {fromNameSetting && renderSetting(fromNameSetting)}
      {fromEmailSetting && renderSetting(fromEmailSetting)}
      {replyToSetting && renderSetting(replyToSetting)}
      {sendWelcomeSetting && renderSetting(sendWelcomeSetting)}
      {requireDoubleOptInSetting && renderSetting(requireDoubleOptInSetting)}
      {requireConsentCheckboxSetting && renderSetting(requireConsentCheckboxSetting)}
      {signupFooterEnabledSetting && renderSetting(signupFooterEnabledSetting)}
      {consentLabelSetting && renderSetting(consentLabelSetting)}
      {complianceFooterSetting && renderSetting(complianceFooterSetting)}
      {maxRecipientsSetting && renderSetting(maxRecipientsSetting)}
      {subscriptionSubjectSetting && renderSetting(subscriptionSubjectSetting)}
      {subscriptionHtmlSetting && renderSetting(subscriptionHtmlSetting)}
      {confirmationSubjectSetting && renderSetting(confirmationSubjectSetting)}
      {confirmationHtmlSetting && renderSetting(confirmationHtmlSetting)}
      {newPostSubjectSetting && renderSetting(newPostSubjectSetting)}
      {newPostHtmlSetting && renderSetting(newPostHtmlSetting)}
      {campaignSubjectSetting && renderSetting(campaignSubjectSetting)}
      {campaignHtmlSetting && renderSetting(campaignHtmlSetting)}
    </div>
  );
};
