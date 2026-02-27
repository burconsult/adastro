import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  loadFeatureModules: vi.fn(),
  getSettings: vi.fn()
}));

vi.mock('../../../../../lib/auth/auth-helpers.js', () => ({
  requireAdmin: mocks.requireAdmin
}));

vi.mock('../../../../../lib/features/loader.js', () => ({
  loadFeatureModules: mocks.loadFeatureModules
}));

vi.mock('../../../../../lib/services/settings-service.js', () => ({
  SettingsService: class {
    getSettings = mocks.getSettings;
  }
}));

import { GET } from '../index.ts';

describe('admin features index api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: 'admin-1' });
    mocks.loadFeatureModules.mockReturnValue([
      {
        id: 'comments',
        definition: {
          label: 'Comments',
          description: 'Comments feature',
          settings: [{ key: 'features.comments.enabled' }]
        }
      },
      {
        id: 'newsletter',
        definition: {
          label: 'Newsletter',
          description: 'Newsletter feature',
          settings: [{ key: 'features.newsletter.enabled' }]
        }
      },
      {
        id: 'always-on',
        definition: {
          label: 'Always On',
          description: 'Core feature',
          settings: [{ key: 'features.always-on.provider' }]
        }
      }
    ]);
  });

  it('returns feature activity + toggleability based on enabled settings', async () => {
    mocks.getSettings.mockResolvedValue({
      'features.comments.enabled': 'false',
      'features.newsletter.enabled': true
    });

    const request = new Request('https://adastrocms.vercel.app/api/admin/features');
    const response = await GET({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.features).toEqual([
      {
        id: 'comments',
        label: 'Comments',
        description: 'Comments feature',
        active: false,
        toggleable: true
      },
      {
        id: 'newsletter',
        label: 'Newsletter',
        description: 'Newsletter feature',
        active: true,
        toggleable: true
      },
      {
        id: 'always-on',
        label: 'Always On',
        description: 'Core feature',
        active: true,
        toggleable: false
      }
    ]);

    expect(mocks.getSettings).toHaveBeenCalledWith([
      'features.comments.enabled',
      'features.newsletter.enabled'
    ]);
  });

  it('returns 500 when feature lookup fails', async () => {
    mocks.getSettings.mockRejectedValue(new Error('settings offline'));

    const request = new Request('https://adastrocms.vercel.app/api/admin/features');
    const response = await GET({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toMatch(/failed to load features/i);
  });
});
