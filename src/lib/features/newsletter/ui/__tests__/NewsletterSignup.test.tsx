import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NewsletterSignup } from '../NewsletterSignup.js';

type FetchMock = ReturnType<typeof vi.fn>;

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

describe('NewsletterSignup', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as any;
  });

  it('stays visible with a degraded state when metadata loading fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'boom' }, 500));

    render(<NewsletterSignup />);

    expect(await screen.findByText('Newsletter signup is temporarily unavailable right now.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unavailable' })).toBeDisabled();
  });
});
