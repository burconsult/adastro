import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ANALYTICS_RETENTION_SETTINGS_STATE,
  parseAnalyticsRetentionSettings,
  serializeAnalyticsRetentionSettings
} from '../retention';

describe('analytics retention settings', () => {
  it('normalizes invalid values to safe bounds', () => {
    expect(
      parseAnalyticsRetentionSettings({
        retentionDays: '4',
        warnAtRowCount: '12',
        archiveBeforePrune: 'yes'
      })
    ).toEqual({
      retentionDays: 7,
      warnAtRowCount: 1000,
      archiveBeforePrune: DEFAULT_ANALYTICS_RETENTION_SETTINGS_STATE.archiveBeforePrune
    });
  });

  it('serializes the normalized settings under the retention key', () => {
    expect(
      serializeAnalyticsRetentionSettings({
        retentionDays: 365,
        warnAtRowCount: 500000,
        archiveBeforePrune: false
      })
    ).toEqual({
      'analytics.retention': {
        retentionDays: 365,
        warnAtRowCount: 500000,
        archiveBeforePrune: false
      }
    });
  });
});
