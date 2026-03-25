import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsProviderSettings from '../AnalyticsProviderSettings';

vi.mock('@/lib/components/admin/ListingPrimitives', () => ({
  AdminLoadingState: ({ label }: { label?: string }) => <div>{label ?? 'Loading…'}</div>
}));

const settingsPayload = {
  'analytics.externalProviders': {
    googleTag: { enabled: true, tagId: 'G-ORIGINAL' }
  },
  'analytics.retention': {
    retentionDays: 180,
    warnAtRowCount: 250000,
    archiveBeforePrune: true
  }
};

const retentionPayload = {
  settings: {
    retentionDays: 180,
    warnAtRowCount: 250000,
    archiveBeforePrune: true
  },
  totalRows: 1200,
  prunableRows: 150,
  oldestEventAt: '2025-05-01T00:00:00.000Z',
  newestEventAt: '2026-03-25T12:00:00.000Z',
  pruneBefore: '2025-09-26T12:00:00.000Z',
  overWarnThreshold: false
};

const jsonResponse = (payload: unknown, init?: { ok?: boolean; status?: number; headers?: HeadersInit }) => ({
  ok: init?.ok ?? true,
  status: init?.status ?? 200,
  headers: new Headers(init?.headers),
  json: async () => payload
});

const blobResponse = (payload: string, init?: { headers?: HeadersInit }) => ({
  ok: true,
  status: 200,
  headers: new Headers(init?.headers),
  json: async () => JSON.parse(payload),
  blob: async () => new Blob([payload], { type: 'application/json' })
});

describe('AnalyticsProviderSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reloads canonical values after saving settings', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(settingsPayload))
      .mockResolvedValueOnce(jsonResponse(retentionPayload))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({
        ...settingsPayload,
        'analytics.externalProviders': {
          googleTag: { enabled: true, tagId: 'G-UPDATED' }
        }
      }))
      .mockResolvedValueOnce(jsonResponse(retentionPayload));

    global.fetch = fetchMock as any;

    render(<AnalyticsProviderSettings />);

    const googleTagInput = await screen.findByDisplayValue('G-ORIGINAL');
    const saveButton = screen.getByRole('button', { name: 'Save settings' });

    expect(saveButton).toBeDisabled();

    fireEvent.change(googleTagInput, { target: { value: 'G-UPDATED' } });

    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            'analytics.externalProviders': {
              googleTag: { enabled: true, tagId: 'G-UPDATED' },
              plausible: { enabled: false, snippetHtml: '' },
              umami: {
                enabled: false,
                scriptUrl: 'https://cloud.umami.is/script.js',
                websiteId: '',
                hostUrl: '',
                domains: '',
                doNotTrack: true,
                trackWebVitals: false
              },
              fathom: { enabled: false, siteId: '', honorDnt: true }
            },
            'analytics.retention': {
              retentionDays: 180,
              warnAtRowCount: 250000,
              archiveBeforePrune: true
            }
          }
        })
      });
    });

    expect(await screen.findByText('Analytics settings saved.')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('G-UPDATED')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/admin/settings?keys=analytics.externalProviders%2Canalytics.retention',
      undefined
    );
    expect(fetchMock).toHaveBeenNthCalledWith(5, '/api/admin/analytics/retention', undefined);
  });

  it('blocks editing when the initial settings load fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'Settings offline' }, { ok: false, status: 500 }))
      .mockResolvedValueOnce(jsonResponse(retentionPayload));

    global.fetch = fetchMock as any;

    render(<AnalyticsProviderSettings />);

    expect(await screen.findByText('Settings offline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Google tag ID')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save settings' })).not.toBeInTheDocument();
  });

  it('blocks invalid enabled provider settings before save', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        'analytics.externalProviders': {},
        'analytics.retention': settingsPayload['analytics.retention']
      }))
      .mockResolvedValueOnce(jsonResponse(retentionPayload)) as any;

    render(<AnalyticsProviderSettings />);

    const enableCheckboxes = await screen.findAllByRole('checkbox', { name: 'Enable' });
    fireEvent.click(enableCheckboxes[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(await screen.findByText('Google tag needs a tag ID before it can be enabled.')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('requires an archive download before prune is enabled', async () => {
    const createObjectURL = vi.fn(() => 'blob:analytics-archive');
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    const confirm = vi.fn(() => true);

    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL
    });
    Object.defineProperty(window.HTMLAnchorElement.prototype, 'click', {
      configurable: true,
      value: click
    });
    Object.defineProperty(window, 'confirm', {
      configurable: true,
      value: confirm
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(settingsPayload))
      .mockResolvedValueOnce(jsonResponse(retentionPayload))
      .mockResolvedValueOnce(
        blobResponse(JSON.stringify({ rowCount: 150 }), {
          headers: {
            'Content-Disposition': 'attachment; filename="analytics-archive-before-2025-09-26.json"',
            'X-Analytics-Archive-Truncated': '0'
          }
        })
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, prunedRows: 150 }))
      .mockResolvedValueOnce(jsonResponse(settingsPayload))
      .mockResolvedValueOnce(jsonResponse({
        ...retentionPayload,
        totalRows: 1050,
        prunableRows: 0
      }));

    global.fetch = fetchMock as any;

    render(<AnalyticsProviderSettings />);

    const downloadButton = await screen.findByRole('button', { name: 'Download archive' });
    const pruneButton = screen.getByRole('button', { name: 'Prune old rows' });

    expect(pruneButton).toBeDisabled();

    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/admin/analytics/retention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export' })
      });
    });

    await waitFor(() => {
      expect(pruneButton).not.toBeDisabled();
    });

    fireEvent.click(pruneButton);

    await waitFor(() => {
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/admin/analytics/retention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'prune',
          archiveAcknowledged: true
        })
      });
    });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Pruned 150 archived analytics rows.')).toBeInTheDocument();
  });
});
