import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SetupWizard from '../SetupWizard';

type FetchMock = typeof global.fetch & vi.Mock;

declare global {
  // eslint-disable-next-line no-var
  var fetch: FetchMock;
}

const samplePayload = {
  generatedAt: new Date().toISOString(),
  setupCompleted: false,
  branding: { name: 'AdAstro', tagline: 'The Lightspeed CMS' },
  environment: {
    adapter: 'vercel',
    deploymentTarget: 'vercel' as const,
    siteUrl: 'https://example.com',
    expectedAuthCallbackUrl: 'https://example.com/auth/callback',
    expectedInviteRedirectUrl: 'https://example.com/auth/callback?redirect=%2Fauth%2Freset-password%3Fnext%3D%252Fadmin',
    supabaseDashboardUrl: 'https://supabase.com/dashboard/project/example'
  },
  contentRouting: {
    articleBasePath: 'blog',
    articlePermalinkStyle: 'segment' as const
  },
  checks: [
    { id: 'env.supabaseUrl', label: 'SUPABASE_URL configured', status: 'ok' as const, detail: 'Configured.' },
    { id: 'env.supabasePublishableKey', label: 'SUPABASE_PUBLISHABLE_KEY configured', status: 'ok' as const, detail: 'Configured.' },
    { id: 'env.supabaseSecretKey', label: 'SUPABASE_SECRET_KEY configured', status: 'ok' as const, detail: 'Configured.' },
    { id: 'env.siteUrl', label: 'SITE_URL configured', status: 'ok' as const, detail: 'Configured.' },
    { id: 'db.coreSchema', label: 'Core schema migrated', status: 'ok' as const, detail: 'Ready.' }
  ],
  requiredEnv: ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY'],
  optionalEnv: ['SITE_URL', 'ASTRO_ADAPTER']
};

const createApiResponse = (payload: unknown, ok = true) => ({
  ok,
  json: () => Promise.resolve(payload)
});

const fetchMock = vi.fn() as FetchMock;
global.fetch = fetchMock;

describe('SetupWizard', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(createApiResponse(samplePayload));
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  it('loads and renders step-by-step wizard shell', async () => {
    render(<SetupWizard />);

    expect(screen.getByText('AdAstro - The Lightspeed CMS')).toBeInTheDocument();
    await screen.findByText('Step 1 of 5');

    expect(screen.getByRole('heading', { name: 'Environment + Docs' })).toBeInTheDocument();
    expect(screen.getByText(/Guided setup for Supabase \+ Vercel\./)).toBeInTheDocument();
  });

  it('switches provider-specific instructions when target is custom', async () => {
    fetchMock.mockResolvedValueOnce(createApiResponse({
      ...samplePayload,
      environment: {
        ...samplePayload.environment,
        adapter: 'custom',
        deploymentTarget: 'custom'
      }
    }));

    render(<SetupWizard />);
    await screen.findByRole('heading', { name: 'Environment + Docs' });

    fireEvent.click(screen.getByRole('button', { name: 'Netlify' }));
    expect(screen.getByRole('link', { name: 'Open Netlify Env Settings' })).toBeInTheDocument();
  });

  it('keeps target labels aligned with detected deployment target', async () => {
    fetchMock.mockResolvedValueOnce(createApiResponse({
      ...samplePayload,
      environment: {
        ...samplePayload.environment,
        adapter: 'vercel',
        deploymentTarget: 'netlify'
      }
    }));

    render(<SetupWizard />);
    await screen.findByText('Target detected: Netlify');

    expect(screen.getByText(/Guided setup for Supabase \+ Netlify\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Netlify Env Settings' })).toBeInTheDocument();
  });

  it('derives target provider from adapter when deployment target is custom', async () => {
    fetchMock.mockResolvedValueOnce(createApiResponse({
      ...samplePayload,
      environment: {
        ...samplePayload.environment,
        adapter: 'netlify',
        deploymentTarget: 'custom'
      }
    }));

    render(<SetupWizard />);
    await screen.findByText(/Guided setup for Supabase \+ Netlify\./);
  });

  it('copies required environment template', async () => {
    render(<SetupWizard />);
    await screen.findByText('Step 1 of 5');
    fireEvent.click(screen.getByRole('button', { name: 'Copy Required Env' }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('SUPABASE_URL='));
    });
  });

  it('applies routing settings through setup API', async () => {
    render(<SetupWizard />);
    await screen.findByText('Step 1 of 5');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByRole('heading', { name: 'Content URLs' });
    fireEvent.click(screen.getByRole('button', { name: 'Save URL Settings' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/setup/routing',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('runs automated supabase setup from wizard', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/setup/automate') {
        return Promise.resolve(createApiResponse({
          ok: true,
          status: 'ok',
          actions: [
            { id: 'settings.defaults', label: 'Default settings', status: 'ok', detail: 'Done.' },
            { id: 'storage.buckets', label: 'Storage buckets', status: 'ok', detail: 'Done.' }
          ]
        }));
      }
      if (url === '/api/setup/routing' && init?.method === 'POST') {
        return Promise.resolve(createApiResponse({ ok: true }));
      }
      return Promise.resolve(createApiResponse(samplePayload));
    });

    render(<SetupWizard />);
    await screen.findByText('Step 1 of 5');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByRole('heading', { name: 'Auth + Email Sender' });
    fireEvent.change(screen.getByPlaceholderText('you@yourdomain.com'), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Set or reset admin password'), { target: { value: 'VeryStrong123!' } });
    fireEvent.change(screen.getByPlaceholderText('Repeat password'), { target: { value: 'VeryStrong123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run Automated Setup' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/setup/automate',
        expect.objectContaining({ method: 'POST' })
      );
    });

    const automateCall = fetchMock.mock.calls.find((call) => call[0] === '/api/setup/automate');
    expect(automateCall).toBeTruthy();
    const requestBody = JSON.parse(String((automateCall?.[1] as RequestInit).body));
    expect(requestBody.adminPassword).toBe('VeryStrong123!');

    expect(await screen.findByText(/Final result: Completed\./)).toBeInTheDocument();
  });

  it('blocks automation if admin password confirmation does not match', async () => {
    render(<SetupWizard />);
    await screen.findByText('Step 1 of 5');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByRole('heading', { name: 'Auth + Email Sender' });
    fireEvent.change(screen.getByPlaceholderText('you@yourdomain.com'), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Set or reset admin password'), { target: { value: 'VeryStrong123!' } });
    fireEvent.change(screen.getByPlaceholderText('Repeat password'), { target: { value: 'Mismatch123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run Automated Setup' }));

    expect(await screen.findByText('Admin password confirmation does not match.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith('/api/setup/automate', expect.anything());
  });

  it('navigates to success step after marking setup complete', async () => {
    let statusCalls = 0;
    const completedPayload = {
      ...samplePayload,
      setupCompleted: true
    };

    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/setup/status') {
        statusCalls += 1;
        return Promise.resolve(createApiResponse(statusCalls > 1 ? completedPayload : samplePayload));
      }
      if (url === '/api/setup/complete' && init?.method === 'POST') {
        return Promise.resolve(createApiResponse({ ok: true }));
      }
      return Promise.resolve(createApiResponse(samplePayload));
    });

    render(<SetupWizard />);
    await screen.findByText('Step 1 of 5');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByRole('heading', { name: 'Verification' });
    fireEvent.click(screen.getByRole('button', { name: 'Mark Setup Complete' }));

    expect(await screen.findByText('Warp Drive Online.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go To Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go To Admin' })).toBeInTheDocument();
  });
});
