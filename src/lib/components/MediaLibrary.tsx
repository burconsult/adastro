import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MediaUpload } from './MediaUpload';
import { AdminLoadingState } from '@/lib/components/admin/ListingPrimitives';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { getMediaLibraryExtensions } from '@/lib/features/ui';
import type { MediaAsset } from '../types/index.js';
import type { MediaUsageStats, MediaOptimizationResult } from '../services/media-manager.js';

const PAGE_SIZE = 24;

const MIME_FILTERS: Record<MediaTypeFilter, string | undefined> = {
  all: undefined,
  image: 'image',
  video: 'video',
  audio: 'audio',
  document: 'application'
};

type MediaTypeFilter = 'all' | 'image' | 'video' | 'audio' | 'document';

interface BannerState {
  type: 'success' | 'error';
  message: string;
}

const deserializeMediaAsset = (asset: any): MediaAsset => ({
  ...asset,
  createdAt: asset?.createdAt ? new Date(asset.createdAt) : new Date(),
  dimensions: asset?.dimensions ?? undefined
});

const isImageAsset = (asset: MediaAsset) => asset.mimeType.startsWith('image/');
const isVideoAsset = (asset: MediaAsset) => asset.mimeType.startsWith('video/');
const isAudioAsset = (asset: MediaAsset) => asset.mimeType.startsWith('audio/');
const isPdfAsset = (asset: MediaAsset) => asset.mimeType === 'application/pdf';

const formatFileSize = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, idx);
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
};

const formatDate = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
};

const buildStorageAssetUrl = (publicUrl: string, currentStoragePath: string, nextStoragePath: string) => {
  if (!publicUrl || !nextStoragePath) return publicUrl;
  const encodedCurrent = encodeURIComponent(currentStoragePath).replace(/%2F/g, '/');
  const encodedNext = encodeURIComponent(nextStoragePath).replace(/%2F/g, '/');

  if (publicUrl.includes(encodedCurrent)) {
    return publicUrl.replace(encodedCurrent, encodedNext);
  }
  if (publicUrl.includes(currentStoragePath)) {
    return publicUrl.replace(currentStoragePath, nextStoragePath);
  }

  const marker = '/storage/v1/object/public/';
  const markerIndex = publicUrl.indexOf(marker);
  if (markerIndex === -1) return publicUrl;

  const bucketAndPath = publicUrl.slice(markerIndex + marker.length);
  const [bucket] = bucketAndPath.split('/', 1);
  if (!bucket) return publicUrl;

  const base = publicUrl.slice(0, markerIndex + marker.length);
  return `${base}${bucket}/${encodedNext}`;
};

interface MediaLibraryProps {
  activeFeatureIds?: string[];
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({ activeFeatureIds = [] }) => {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<MediaTypeFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stats, setStats] = useState<MediaUsageStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [generatingAltText, setGeneratingAltText] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [metadataDraft, setMetadataDraft] = useState({ altText: '', caption: '' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const activeFeatureSet = useMemo(() => new Set(activeFeatureIds), [activeFeatureIds]);
  const mediaExtensions = useMemo(
    () => getMediaLibraryExtensions().filter((extension) => activeFeatureSet.has(extension.id)),
    [activeFeatureSet]
  );

  const selectedAsset = useMemo(
    () => (selectedId ? assets.find(asset => asset.id === selectedId) ?? null : null),
    [assets, selectedId]
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (selectedAsset) {
      setMetadataDraft({
        altText: selectedAsset.altText || '',
        caption: selectedAsset.caption || ''
      });
    }
  }, [selectedAsset]);

  useEffect(() => {
    if (!banner) return;
    const timeout = window.setTimeout(() => setBanner(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [banner]);

  const loadStats = useCallback(async () => {
    try {
      setStatsError(null);
      const response = await fetch('/api/admin/media/stats');
      if (!response.ok) {
        throw new Error('Failed to load stats');
      }
      const payload = await response.json();
      setStats(payload);
    } catch (statsError) {
      console.error('Media stats error:', statsError);
      setStats(null);
      setStatsError(statsError instanceof Error ? statsError.message : 'Failed to load media stats.');
    }
  }, []);

  const loadMedia = useCallback(
    async ({ targetPage, append }: { targetPage: number; append: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: PAGE_SIZE.toString(),
          offset: ((targetPage - 1) * PAGE_SIZE).toString()
        });
        const mimeFilter = MIME_FILTERS[filter];
        if (mimeFilter) {
          params.set('mimeType', mimeFilter);
        }
        if (debouncedSearch) {
          params.set('search', debouncedSearch);
        }

        const response = await fetch(`/api/admin/media?${params.toString()}`);
        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(errorPayload?.message || 'Failed to load media');
        }

        const data = await response.json();
        const incoming: MediaAsset[] = Array.isArray(data?.assets)
          ? data.assets.map(deserializeMediaAsset)
          : [];
        const nextTotal = typeof data?.total === 'number' ? data.total : incoming.length;

        setAssets(prev => {
          if (append) {
            const next = [...prev];
            incoming.forEach(asset => {
              const index = next.findIndex(item => item.id === asset.id);
              if (index >= 0) {
                next[index] = asset;
              } else {
                next.push(asset);
              }
            });
            return next;
          }
          return incoming;
        });
        setTotal(nextTotal);
      } catch (loadError) {
        console.error('Media load error:', loadError);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load media');
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, filter]
  );

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadMedia({ targetPage: 1, append: false });
    setPage(1);
  }, [loadMedia]);

  useEffect(() => {
    if (page === 1) return;
    loadMedia({ targetPage: page, append: true });
  }, [page, loadMedia]);

  const handleUploadComplete = useCallback((result: MediaOptimizationResult) => {
    const uploaded = deserializeMediaAsset(result.public ?? result.original);
    setAssets(prev => [uploaded, ...prev.filter(asset => asset.id !== uploaded.id)]);
    setTotal(prev => prev + 1);
    setSelectedId(uploaded.id);
    loadStats();
    setBanner({ type: 'success', message: 'Upload complete and asset added to library.' });
  }, [loadStats]);

  const addAsset = useCallback((asset: MediaAsset | any) => {
    const uploaded = deserializeMediaAsset(asset);
    setAssets(prev => [uploaded, ...prev.filter(item => item.id !== uploaded.id)]);
    setTotal(prev => prev + 1);
    setSelectedId(uploaded.id);
  }, []);

  const handleMetadataSave = useCallback(async () => {
    if (!selectedAsset) return;
    setSavingMetadata(true);
    try {
      const response = await fetch(`/api/admin/media/${selectedAsset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          altText: metadataDraft.altText?.trim(),
          caption: metadataDraft.caption?.trim()
        })
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.message || 'Unable to update media metadata');
      }

      const updated = deserializeMediaAsset(await response.json());
      setAssets(prev => prev.map(asset => (asset.id === updated.id ? updated : asset)));
      setBanner({ type: 'success', message: 'Alt text and caption updated.' });
    } catch (saveError) {
      console.error('Metadata update error:', saveError);
      setBanner({
        type: 'error',
        message: saveError instanceof Error ? saveError.message : 'Failed to update media metadata.'
      });
    } finally {
      setSavingMetadata(false);
    }
  }, [metadataDraft.altText, metadataDraft.caption, selectedAsset]);

  const handleGenerateAltText = useCallback(async () => {
    if (!selectedAsset || !isImageAsset(selectedAsset)) return;
    setGeneratingAltText(true);
    try {
      const response = await fetch('/api/features/ai/alt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: selectedAsset.id })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to generate alt text');
      }

      const payload = await response.json();
      const updated = deserializeMediaAsset(payload?.asset);
      setAssets((prev) => prev.map((asset) => (asset.id === updated.id ? updated : asset)));
      setMetadataDraft((prev) => ({ ...prev, altText: updated.altText || payload?.altText || prev.altText }));
      setBanner({ type: 'success', message: 'AI alt text generated and applied.' });
    } catch (generateError) {
      console.error('Alt text generation error:', generateError);
      setBanner({
        type: 'error',
        message: generateError instanceof Error ? generateError.message : 'Failed to generate alt text.'
      });
    } finally {
      setGeneratingAltText(false);
    }
  }, [selectedAsset]);

  const handleDeleteConfirmed = useCallback(async () => {
    if (!selectedAsset) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/media/${selectedAsset.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.message || 'Failed to delete media asset');
      }

      setAssets(prev => prev.filter(asset => asset.id !== selectedAsset.id));
      setTotal(prev => Math.max(0, prev - 1));
      setSelectedId(null);
      loadStats();
      setBanner({ type: 'success', message: 'Media asset deleted.' });
      setShowDeleteDialog(false);
    } catch (deleteError) {
      console.error('Media delete error:', deleteError);
      setBanner({
        type: 'error',
        message: deleteError instanceof Error ? deleteError.message : 'Failed to delete media asset.'
      });
    } finally {
      setDeleting(false);
    }
  }, [loadStats, selectedAsset]);

  const openDeleteDialog = useCallback(() => {
    if (!selectedAsset) return;
    setShowDeleteDialog(true);
  }, [selectedAsset]);

  const hasMore = assets.length < total;

  return (
    <>
      <div className="space-y-6">
      {banner && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            banner.type === 'success'
              ? 'border-success/40 bg-success/10 text-success'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <span>{banner.message}</span>
            <button type="button" className="text-xs font-medium" onClick={() => setBanner(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Files"
          value={stats?.totalFiles ?? total}
          subtitle={stats ? `${formatFileSize(stats.totalSize ?? 0)} storage` : 'storage'}
        />
        <StatCard
          title="Average Size"
          value={stats ? formatFileSize(stats.averageFileSize ?? 0) : '—'}
          subtitle="per file"
        />
        <StatCard
          title="Optimized Savings"
          value={stats ? formatFileSize(stats.optimizationSavings ?? 0) : '—'}
          subtitle="estimated bandwidth saved"
        />
        <StatCard
          title="Top Formats"
          value={
            stats
              ? Object.entries(stats.formatDistribution ?? {})[0]?.[0]?.toUpperCase() || '—'
              : '—'
          }
          subtitle={stats ? `${Object.keys(stats.formatDistribution ?? {}).length} formats` : 'formats'}
        />
      </div>
      {statsError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Media stats are temporarily unavailable. {statsError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Upload Media</h2>
            <MediaUpload
              accept="image/*,video/*,audio/*,application/pdf"
              onUploadComplete={handleUploadComplete}
              onError={(uploadError) => {
                console.error('Media upload error:', uploadError);
                setBanner({ type: 'error', message: uploadError.message });
              }}
            />
          </div>
          {mediaExtensions.map(({ id, Panel }) =>
            Panel ? (
              <Panel
                key={id}
                addAsset={addAsset}
                selectAsset={setSelectedId}
                setBanner={setBanner}
                refreshStats={loadStats}
              />
            ) : null
          )}

          <div className="card p-6 space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {(['all', 'image', 'video', 'audio', 'document'] as MediaTypeFilter[]).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setFilter(option);
                      setPage(1);
                    }}
                    className={`px-3 py-1 text-sm rounded-md border ${
                      filter === option ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/60'
                    }`}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>

              <div className="w-full md:w-64">
                <input
                  type="search"
                  value={searchInput}
                  onChange={event => {
                    setSearchInput(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search filename or alt text..."
                  className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="min-h-[240px]">
              {loading && assets.length === 0 ? (
                <AdminLoadingState label="Loading media library..." className="h-40" />
              ) : assets.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <span className="text-4xl">📁</span>
                  <span>No media files found. Try a different filter or upload a file.</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {assets.map(asset => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setSelectedId(asset.id)}
                      className={`group overflow-hidden rounded-lg border-2 transition ${
                        selectedId === asset.id
                          ? 'border-primary/60 ring-2 ring-primary/20'
                          : 'border-border hover:border-input'
                      }`}
                    >
                      <div className="aspect-square bg-muted">
                        <AssetPreview asset={asset} variant="grid" />
                      </div>
                      <div className="space-y-1 p-2 text-left">
                        <p className="truncate text-xs font-medium text-muted-foreground">{asset.filename}</p>
                        <p className="text-[11px] text-muted-foreground">{formatFileSize(asset.fileSize)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {hasMore && (
              <div className="flex justify-center">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setPage(prev => prev + 1)}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        </div>

        <aside className="card p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Asset Details</h2>
            <p className="text-sm text-muted-foreground">Select a file to edit metadata and view information.</p>
          </div>

          {selectedAsset ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-md border">
                <div
                  className={`${isAudioAsset(selectedAsset) ? 'min-h-[220px]' : 'aspect-square'} bg-muted`}
                >
                  <AssetPreview asset={selectedAsset} variant="detail" />
                </div>
              </div>

              <div className="space-y-2">
                <MetadataRow label="Filename" value={selectedAsset.filename} />
                <MetadataRow label="Type" value={selectedAsset.mimeType} />
                <MetadataRow label="Size" value={formatFileSize(selectedAsset.fileSize)} />
                {selectedAsset.dimensions && (
                  <MetadataRow
                    label="Dimensions"
                    value={`${selectedAsset.dimensions.width} × ${selectedAsset.dimensions.height}`}
                  />
                )}
                <MetadataRow label="Uploaded" value={formatDate(selectedAsset.createdAt)} />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="media-alt-text">
                  {isImageAsset(selectedAsset) ? 'Alt Text' : 'Description'}
                </label>
                <textarea
                  id="media-alt-text"
                  rows={3}
                  value={metadataDraft.altText}
                  onChange={event => setMetadataDraft(prev => ({ ...prev, altText: event.target.value }))}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                  placeholder={isImageAsset(selectedAsset)
                    ? 'Describe the visual content for accessibility'
                    : 'Add an accessible description for this file'}
                />

                <label className="text-sm font-medium text-muted-foreground" htmlFor="media-caption">
                  Caption
                </label>
                <textarea
                  id="media-caption"
                  rows={2}
                  value={metadataDraft.caption}
                  onChange={event => setMetadataDraft(prev => ({ ...prev, caption: event.target.value }))}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                  placeholder="Optional caption displayed with the media"
                />
              </div>

              <div className="flex flex-col gap-2">
                {activeFeatureSet.has('ai') && isImageAsset(selectedAsset) && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleGenerateAltText}
                    disabled={generatingAltText}
                  >
                    {generatingAltText ? 'Generating Alt Text...' : (selectedAsset.altText ? 'Regenerate Alt Text' : 'Generate Alt Text')}
                  </button>
                )}
                {(() => {
                  const optimizedUrl = selectedAsset.url;
                  const originalUrl = selectedAsset.originalStoragePath
                    ? buildStorageAssetUrl(
                        selectedAsset.url,
                        selectedAsset.storagePath,
                        selectedAsset.originalStoragePath
                      )
                    : null;
                  return (
                    <>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => window.open(optimizedUrl, '_blank', 'noopener,noreferrer')}
                      >
                        {isImageAsset(selectedAsset) ? 'Open Optimized Version' : 'Open File'}
                      </button>
                      {originalUrl && originalUrl !== optimizedUrl && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => window.open(originalUrl, '_blank', 'noopener,noreferrer')}
                        >
                          Open Original File
                        </button>
                      )}
                    </>
                  );
                })()}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleMetadataSave}
                  disabled={savingMetadata || generatingAltText}
                >
                  {savingMetadata ? 'Saving...' : 'Save Metadata'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline text-destructive"
                  onClick={openDeleteDialog}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete Asset'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-input text-center text-sm text-muted-foreground">
              <span className="text-3xl">👆</span>
              <span>Select a file to view details.</span>
            </div>
          )}
        </aside>
      </div>
      </div>

      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setShowDeleteDialog(false);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete media asset</DialogTitle>
            <DialogDescription>
              This will permanently remove "{selectedAsset?.filename}" from the library. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-destructive"
              onClick={handleDeleteConfirmed}
              disabled={deleting}
              aria-busy={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete asset'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle }) => (
  <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
    <p className="text-sm font-medium text-muted-foreground">{title}</p>
    <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
  </div>
);

interface MetadataRowProps {
  label: string;
  value: string | number;
}

interface AssetPreviewProps {
  asset: MediaAsset;
  variant: 'grid' | 'detail';
}

const AssetPreview: React.FC<AssetPreviewProps> = ({ asset, variant }) => {
  if (isImageAsset(asset)) {
    return (
      <img
        src={asset.url}
        alt={asset.altText || asset.filename}
        className="h-full w-full object-cover"
        loading={variant === 'grid' ? 'lazy' : undefined}
        decoding={variant === 'grid' ? 'async' : undefined}
      />
    );
  }

  if (isVideoAsset(asset)) {
    return (
      <video
        src={asset.url}
        className="h-full w-full object-cover"
        controls={variant === 'detail'}
        muted={variant === 'grid'}
        playsInline
        preload="metadata"
        aria-label={asset.altText || asset.filename}
      />
    );
  }

  if (isAudioAsset(asset)) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 p-6 text-center dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Audio</div>
        <div className="max-w-full truncate text-sm font-medium text-foreground">{asset.filename}</div>
        {variant === 'detail' ? (
          <audio controls preload="metadata" className="w-full">
            <source src={asset.url} type={asset.mimeType} />
          </audio>
        ) : (
          <div className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">Select to play</div>
        )}
      </div>
    );
  }

  if (isPdfAsset(asset)) {
    return variant === 'detail' ? (
      <iframe
        title={asset.filename}
        src={`${asset.url}#view=FitH`}
        className="h-full w-full border-0"
      />
    ) : (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-rose-50 to-orange-100 text-center dark:from-zinc-900 dark:to-zinc-800">
        <div className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-rose-600 dark:border-rose-900 dark:bg-zinc-900 dark:text-rose-300">
          PDF
        </div>
        <div className="px-4 text-xs text-muted-foreground">Select to preview</div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      Unsupported preview
    </div>
  );
};

const MetadataRow: React.FC<MetadataRowProps> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3 text-sm">
    <span className="font-medium text-muted-foreground">{label}</span>
    <span className="max-w-[70%] break-words text-muted-foreground">{value}</span>
  </div>
);

export default MediaLibrary;
