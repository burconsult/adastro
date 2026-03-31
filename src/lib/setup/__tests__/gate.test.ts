import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setSetupCompletionRuntimeCache } from '@/lib/runtime-config-cache.js';

const mocks = vi.hoisted(() => ({
  hasRequiredSetupEnv: vi.fn(),
  getUserFromRequest: vi.fn(),
  selectRows: vi.fn()
}));

vi.mock('@/lib/setup/runtime.js', () => ({
  hasRequiredSetupEnv: mocks.hasRequiredSetupEnv,
  isMissingRelationError: (message: string) => message.toLowerCase().includes('relation'),
  normalizeBooleanSetting: (value: unknown) => {
    if (value === true) return true;
    if (typeof value === 'string') return value === 'true';
    return Boolean(value);
  },
  SETUP_ALLOW_REENTRY_KEY: 'setup.allowReentry',
  SETUP_COMPLETION_KEY: 'setup.completed'
}));

vi.mock('@/lib/auth/auth-helpers.js', () => ({
  authService: {
    getUserFromRequest: mocks.getUserFromRequest
  }
}));

vi.mock('@/lib/supabase.js', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        in: mocks.selectRows
      })
    })
  }
}));

import { assertSetupApiAccess, getSetupGateState } from '../gate.ts';

describe('setup gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSetupCompletionRuntimeCache(null);
  });

  it('treats the app as not completed when setup env is missing', async () => {
    mocks.hasRequiredSetupEnv.mockReturnValue(false);

    await expect(getSetupGateState()).resolves.toEqual({
      completed: false,
      allowReentry: false
    });
  });

  it('allows unauthenticated setup access before completion', async () => {
    mocks.hasRequiredSetupEnv.mockReturnValue(true);
    mocks.selectRows.mockResolvedValue({
      data: [
        { key: 'setup.completed', value: false },
        { key: 'setup.allowReentry', value: false }
      ],
      error: null
    });

    await expect(assertSetupApiAccess(new Request('https://adastrocms.vercel.app/api/setup/status'))).resolves.toEqual({
      completed: false,
      allowReentry: false
    });
  });

  it('requires authentication after setup completion', async () => {
    mocks.hasRequiredSetupEnv.mockReturnValue(true);
    mocks.selectRows.mockResolvedValue({
      data: [
        { key: 'setup.completed', value: true },
        { key: 'setup.allowReentry', value: true }
      ],
      error: null
    });
    mocks.getUserFromRequest.mockResolvedValue(null);

    await expect(assertSetupApiAccess(new Request('https://adastrocms.vercel.app/api/setup/status'))).rejects.toMatchObject({
      status: 401
    });
  });

  it('blocks setup APIs entirely when re-entry is disabled', async () => {
    mocks.hasRequiredSetupEnv.mockReturnValue(true);
    mocks.selectRows.mockResolvedValue({
      data: [
        { key: 'setup.completed', value: true },
        { key: 'setup.allowReentry', value: false }
      ],
      error: null
    });

    await expect(assertSetupApiAccess(new Request('https://adastrocms.vercel.app/api/setup/status'))).rejects.toMatchObject({
      status: 403,
      message: 'Setup re-entry is disabled.'
    });
  });

  it('requires admin role after setup completion', async () => {
    mocks.hasRequiredSetupEnv.mockReturnValue(true);
    mocks.selectRows.mockResolvedValue({
      data: [
        { key: 'setup.completed', value: true },
        { key: 'setup.allowReentry', value: true }
      ],
      error: null
    });
    mocks.getUserFromRequest.mockResolvedValue({
      id: 'user-1',
      email: 'reader@example.com',
      role: 'reader'
    });

    await expect(assertSetupApiAccess(new Request('https://adastrocms.vercel.app/api/setup/status'))).rejects.toMatchObject({
      status: 403
    });
  });
});
