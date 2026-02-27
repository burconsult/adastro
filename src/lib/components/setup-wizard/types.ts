export type CheckStatus = 'ok' | 'warn' | 'fail';

export type SetupCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  action?: string;
};

export type SetupStatusPayload = {
  generatedAt: string;
  setupCompleted: boolean;
  branding: {
    name: string;
    tagline: string;
  };
  environment: {
    adapter: string;
    deploymentTarget: 'vercel' | 'netlify' | 'custom';
    siteUrl: string | null;
    expectedAuthCallbackUrl: string | null;
    expectedInviteRedirectUrl: string | null;
    supabaseDashboardUrl?: string | null;
  };
  contentRouting: {
    articleBasePath: string;
    articlePermalinkStyle: 'segment' | 'wordpress';
  };
  checks: SetupCheck[];
  requiredEnv: string[];
  optionalEnv: string[];
};

export type DeployProvider = 'vercel' | 'netlify';
export type SetupSqlTemplate = 'core' | 'seed' | 'admin';
export type SetupAutomationStatus = 'ok' | 'warn' | 'fail';

export type SetupAutomationAction = {
  id: string;
  label: string;
  status: SetupAutomationStatus;
  detail: string;
};

export type SetupAutomationPayload = {
  ok: boolean;
  status: SetupAutomationStatus;
  actions: SetupAutomationAction[];
};

export type AutomationProgressStatus = SetupAutomationStatus | 'pending';

export type SetupAutomationProgressAction = {
  id: string;
  label: string;
  status: AutomationProgressStatus;
  detail: string;
};

export type WizardStep = {
  id: string;
  title: string;
  description: string;
};
