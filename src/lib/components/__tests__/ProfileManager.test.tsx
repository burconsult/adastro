import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProfileManager } from '../ProfileManager';

vi.mock('@/lib/features/ui', () => ({
  getProfileExtensions: () => []
}));

describe('ProfileManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({ error: 'Authentication required' })
    }) as any;
  });

  it('shows redirect notice when user is unauthenticated', async () => {
    render(<ProfileManager />);

    await waitFor(() => {
      expect(screen.getByText('Redirecting to sign in...')).toBeInTheDocument();
    });
  });

  it('renders localized redirect notice when translations are provided', async () => {
    render(<ProfileManager messages={{ 'core.profile.redirecting': 'Videresender til innlogging...' }} />);

    await waitFor(() => {
      expect(screen.getByText('Videresender til innlogging...')).toBeInTheDocument();
    });
  });
});
