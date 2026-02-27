import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadFeatureModules: vi.fn(),
  getSetting: vi.fn()
}));

vi.mock('../loader.js', () => ({
  loadFeatureModules: mocks.loadFeatureModules
}));

vi.mock('../../services/settings-service.js', () => ({
  SettingsService: vi.fn(() => ({
    getSetting: mocks.getSetting
  }))
}));

import { getFeatureEnabledSettingKey, isFeatureActive } from '../state.js';

const featureModule = (featureId: string, settings: Array<{ key: string }> = []) => ({
  id: featureId,
  definition: {
    id: featureId,
    label: featureId,
    description: `${featureId} feature`,
    settings
  }
});

describe('feature state resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null key and inactive state when feature module is missing', async () => {
    mocks.loadFeatureModules.mockReturnValue([]);

    expect(getFeatureEnabledSettingKey('newsletter')).toBeNull();
    await expect(isFeatureActive('newsletter')).resolves.toBe(false);
    expect(mocks.getSetting).not.toHaveBeenCalled();
  });

  it('treats modules without an enable setting as active', async () => {
    mocks.loadFeatureModules.mockReturnValue([featureModule('custom', [{ key: 'features.custom.mode' }])]);

    expect(getFeatureEnabledSettingKey('custom')).toBeNull();
    await expect(isFeatureActive('custom')).resolves.toBe(true);
    expect(mocks.getSetting).not.toHaveBeenCalled();
  });

  it('returns active when enabled setting is true', async () => {
    mocks.loadFeatureModules.mockReturnValue([featureModule('newsletter', [{ key: 'features.newsletter.enabled' }])]);
    mocks.getSetting.mockResolvedValue(true);

    expect(getFeatureEnabledSettingKey('newsletter')).toBe('features.newsletter.enabled');
    await expect(isFeatureActive('newsletter')).resolves.toBe(true);
    expect(mocks.getSetting).toHaveBeenCalledWith('features.newsletter.enabled');
  });

  it('returns inactive when enabled setting is false', async () => {
    mocks.loadFeatureModules.mockReturnValue([featureModule('newsletter', [{ key: 'features.newsletter.enabled' }])]);
    mocks.getSetting.mockResolvedValue(false);

    await expect(isFeatureActive('newsletter')).resolves.toBe(false);
  });

  it('returns inactive when enabled setting is the string "false"', async () => {
    mocks.loadFeatureModules.mockReturnValue([featureModule('newsletter', [{ key: 'features.newsletter.enabled' }])]);
    mocks.getSetting.mockResolvedValue('false');

    await expect(isFeatureActive('newsletter')).resolves.toBe(false);
  });

  it('fails closed when settings lookup throws', async () => {
    mocks.loadFeatureModules.mockReturnValue([featureModule('newsletter', [{ key: 'features.newsletter.enabled' }])]);
    mocks.getSetting.mockRejectedValue(new Error('database unavailable'));

    await expect(isFeatureActive('newsletter')).resolves.toBe(false);
  });
});
