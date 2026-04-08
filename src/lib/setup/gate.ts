import { authService } from '@/lib/auth/auth-helpers.js';
import {
  getSetupCompletionRuntimeCache,
  setSetupCompletionRuntimeCache
} from '@/lib/runtime-config-cache.js';
import { supabaseAdmin } from '@/lib/supabase.js';
import {
  hasRequiredSetupEnv,
  isMissingRelationError,
  normalizeBooleanSetting,
  SETUP_ALLOW_REENTRY_KEY,
  SETUP_COMPLETION_KEY
} from '@/lib/setup/runtime.js';

const SETUP_COMPLETION_CACHE_TTL_MS = 5000;

export type SetupGateState = {
  completed: boolean;
  allowReentry: boolean;
};

export type SetupApiAccessOptions = {
  allowUnauthenticatedBeforeCompletion?: boolean;
};

export class SetupAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SetupAccessError';
    this.status = status;
  }
}

export const getSetupGateState = async (): Promise<SetupGateState> => {
  if (!hasRequiredSetupEnv()) return { completed: false, allowReentry: false };

  const now = Date.now();
  const cachedSetupCompletion = getSetupCompletionRuntimeCache();
  if (cachedSetupCompletion && now - cachedSetupCompletion.checkedAt <= SETUP_COMPLETION_CACHE_TTL_MS) {
    return {
      completed: cachedSetupCompletion.completed,
      allowReentry: cachedSetupCompletion.allowReentry
    };
  }

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('site_settings')
      .select('key,value')
      .in('key', [SETUP_COMPLETION_KEY, SETUP_ALLOW_REENTRY_KEY]);

    if (error) {
      const message = String(error.message || '').toLowerCase();
      if (isMissingRelationError(message)) {
        setSetupCompletionRuntimeCache({ completed: false, allowReentry: false, checkedAt: now });
        return { completed: false, allowReentry: false };
      }
      console.warn('Setup completion check failed:', error.message);
      setSetupCompletionRuntimeCache({ completed: false, allowReentry: false, checkedAt: now });
      return { completed: false, allowReentry: false };
    }

    const rows = Array.isArray(data) ? data : [];
    const completionRow = rows.find((row: any) => row.key === SETUP_COMPLETION_KEY);
    const allowReentryRow = rows.find((row: any) => row.key === SETUP_ALLOW_REENTRY_KEY);

    const completed = normalizeBooleanSetting(completionRow?.value);
    const allowReentry = normalizeBooleanSetting(allowReentryRow?.value);

    setSetupCompletionRuntimeCache({ completed, allowReentry, checkedAt: now });
    return { completed, allowReentry };
  } catch (error) {
    console.warn('Setup completion check failed:', error);
    setSetupCompletionRuntimeCache({ completed: false, allowReentry: false, checkedAt: now });
    return { completed: false, allowReentry: false };
  }
};

export const assertSetupApiAccess = async (
  request: Request,
  options: SetupApiAccessOptions = {}
): Promise<SetupGateState> => {
  const { allowUnauthenticatedBeforeCompletion = false } = options;
  const gate = await getSetupGateState();
  if (!gate.completed) {
    if (allowUnauthenticatedBeforeCompletion) {
      return gate;
    }

    const user = await authService.getUserFromRequest(request);
    if (!user) {
      throw new SetupAccessError('Authentication required. Sign in as an admin bootstrap user to continue setup.', 401);
    }

    if (user.role !== 'admin') {
      throw new SetupAccessError('Admin access required.', 403);
    }

    return gate;
  }

  if (!gate.allowReentry) {
    throw new SetupAccessError('Setup re-entry is disabled.', 403);
  }

  const user = await authService.getUserFromRequest(request);
  if (!user) {
    throw new SetupAccessError('Authentication required.', 401);
  }

  if (user.role !== 'admin') {
    throw new SetupAccessError('Admin access required.', 403);
  }

  return gate;
};
