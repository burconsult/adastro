import React from 'react';
import { normalizeFeatureFlag } from '@/lib/features/flags';
import type { FeatureSettingsPanelProps } from '../../types.js';

export const CommentsSettingsPanel: React.FC<FeatureSettingsPanelProps> = ({
  getSetting,
  getValue,
  renderSetting,
  t
}) => {
  const enabledSetting = getSetting('features.comments.enabled');
  const moderationSetting = getSetting('features.comments.moderation');
  const authenticatedOnlySetting = getSetting('features.comments.authenticatedOnly');
  const recaptchaSetting = getSetting('features.comments.recaptcha.enabled');
  const maxLinksSetting = getSetting('features.comments.maxLinks');
  const minSecondsSetting = getSetting('features.comments.minSecondsToSubmit');
  const blockedTermsSetting = getSetting('features.comments.blockedTerms');
  const commentsEnabled = normalizeFeatureFlag(getValue('features.comments.enabled'), false);

  if (!enabledSetting && !moderationSetting) {
    return null;
  }

  return (
    <div className="card p-4 space-y-4">
      <div>
        <h3 className="text-base font-semibold">{t('settings.features.comments.title', 'Comments')}</h3>
        <p className="text-xs text-muted-foreground">{t('settings.features.comments.description', 'Enable and moderate reader feedback.')}</p>
      </div>

      {enabledSetting && renderSetting(enabledSetting)}

      {!commentsEnabled ? (
        <div className="rounded-md border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
          Comments are inactive. Enable the feature to show moderation and anti-spam controls.
        </div>
      ) : (
        <>
          {moderationSetting && renderSetting(moderationSetting)}
          {authenticatedOnlySetting && renderSetting(authenticatedOnlySetting)}
          {recaptchaSetting && renderSetting(recaptchaSetting)}
          {recaptchaSetting && (
            <p className="text-xs text-muted-foreground">
              reCAPTCHA keys are configured in Settings → Security.
            </p>
          )}
          {maxLinksSetting && renderSetting(maxLinksSetting)}
          {minSecondsSetting && renderSetting(minSecondsSetting)}
          {blockedTermsSetting && renderSetting(blockedTermsSetting)}
          <p className="text-xs text-muted-foreground">
            Use Features → Comments → Moderation Queue to review and approve pending comments.
          </p>
        </>
      )}
    </div>
  );
};
