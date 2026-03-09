import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PageListing from '../PageListing';

global.fetch = vi.fn();

const mockPages = [
  {
    id: 'page-1',
    title: 'Home',
    slug: 'home',
    locale: 'en',
    status: 'published' as const,
    updatedAt: '2026-01-01T00:00:00Z',
    author: { name: 'Admin' }
  }
];

describe('PageListing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ pages: mockPages, total: mockPages.length })
    });
  });

  it('defaults locale filter to all locales', () => {
    render(
      <PageListing
        initialPages={mockPages}
        defaultLocale="en"
        supportedLocales={['en', 'nb']}
      />
    );

    const localeFilter = screen.getByLabelText('Locale') as HTMLSelectElement;
    expect(localeFilter.value).toBe('');
    expect(screen.getByRole('option', { name: 'All locales' })).toBeInTheDocument();
  });

  it('requests locale-filtered pages when locale is selected', async () => {
    render(
      <PageListing
        initialPages={mockPages}
        defaultLocale="en"
        supportedLocales={['en', 'nb']}
      />
    );

    const localeFilter = screen.getByLabelText('Locale');
    fireEvent.change(localeFilter, { target: { value: 'nb' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('locale=nb')
      );
    });
  });
});
