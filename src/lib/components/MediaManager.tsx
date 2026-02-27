import React, { useState, useEffect, useCallback } from 'react';
import { MediaUpload } from './MediaUpload';
import { useToast } from '@/lib/components/ui/toast';
import type { MediaAsset } from '../types/index.js';
import type { MediaOptimizationResult } from '../services/media-manager.js';
import { Check, FileText, ImageIcon, X } from 'lucide-react';

interface MediaManagerProps {
  onSelect: (media: MediaAsset) => void;
  onClose: () => void;
}

export const MediaManager: React.FC<MediaManagerProps> = ({
  onSelect,
  onClose
}) => {
  const { toast } = useToast();
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [view, setView] = useState<'grid' | 'upload'>('grid');

  const loadMediaAssets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/media');
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data?.assets)
          ? data.assets
          : Array.isArray(data)
            ? data
            : [];
        const normalized: MediaAsset[] = list.map(deserializeMediaAsset);
        setMediaAssets(normalized);
        if (normalized.length > 0) {
          setSelectedAsset(prev => {
            if (!prev) return normalized[0];
            return normalized.find(asset => asset.id === prev.id) || normalized[0] || null;
          });
        } else {
          setSelectedAsset(null);
        }
      } else {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Failed to load media assets');
      }
    } catch (error) {
      console.error('Error loading media assets:', error);
      setError(error instanceof Error ? error.message : 'Failed to load media assets');
      toast({
        variant: 'destructive',
        title: 'Failed to load media library',
        description: 'Please refresh the page or try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadMediaAssets();
  }, [loadMediaAssets]);

  const handleUploadComplete = useCallback((result: MediaOptimizationResult) => {
    // Add the new asset to the list
    const normalized = deserializeMediaAsset(result.public ?? result.original);
    setMediaAssets(prev => [normalized, ...prev.filter(asset => asset.id !== normalized.id)]);
    setSelectedAsset(normalized);
    setView('grid');
    toast({
      variant: 'success',
      title: 'Upload complete',
      description: `${normalized.filename} is ready to use.`,
    });
  }, [toast]);

  const handleSelect = useCallback(() => {
    if (selectedAsset) {
      onSelect(selectedAsset);
    }
  }, [selectedAsset, onSelect]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date | string) => {
    const value = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(value);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block w-full max-w-6xl my-8 overflow-hidden rounded-xl border border-border bg-card p-6 text-left align-middle text-card-foreground shadow-xl transition-all relative z-50">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
            <h3 className="text-lg font-semibold">Media Library</h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-md border border-border bg-background p-1">
                <button
                  type="button"
                  onClick={() => setView('grid')}
                  className={`rounded-md px-3 py-1 text-sm transition-colors ${
                    view === 'grid'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  Library
                </button>
                <button
                  type="button"
                  onClick={() => setView('upload')}
                  className={`rounded-md px-3 py-1 text-sm transition-colors ${
                    view === 'upload'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  Upload
                </button>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="sr-only">Close</span>
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="min-h-[500px]">
            {view === 'upload' ? (
              <div className="max-w-2xl mx-auto">
                <MediaUpload
                  onUploadComplete={handleUploadComplete}
                  onError={(uploadError) => {
                    const message = uploadError instanceof Error ? uploadError.message : 'Upload failed.';
                    toast({
                      variant: 'destructive',
                      title: 'Upload failed',
                      description: message,
                    });
                  }}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Media Grid */}
                <div className="lg:col-span-3">
                  {loading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-muted-foreground">Loading media...</div>
                    </div>
                  ) : error ? (
                    <div className="flex h-64 items-center justify-center text-sm text-destructive">
                      {error}
                    </div>
                  ) : mediaAssets.length === 0 ? (
                    <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
                      <ImageIcon className="mb-4 h-10 w-10" />
                      <div className="text-lg mb-2">No media files yet</div>
                      <button
                        type="button"
                        onClick={() => setView('upload')}
                        className="btn"
                      >
                        Upload your first file
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {mediaAssets.map(asset => (
                        <div
                          key={asset.id}
                          className={`group relative cursor-pointer overflow-hidden rounded-lg border-2 transition-colors ${
                            selectedAsset?.id === asset.id
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-foreground/20'
                          }`}
                          onClick={() => setSelectedAsset(asset)}
                        >
                          <div className="flex aspect-square items-center justify-center bg-muted">
                            {asset.mimeType.startsWith('image/') ? (
                              <img
                                src={asset.url}
                                alt={asset.altText || asset.filename}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <FileText className="h-10 w-10 text-muted-foreground/70" />
                            )}
                          </div>
                          <div className="p-2">
                            <div className="truncate text-xs font-medium">
                              {asset.filename}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatFileSize(asset.fileSize)}
                            </div>
                          </div>
                          {selectedAsset?.id === asset.id && (
                            <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Asset Details */}
                <div className="lg:col-span-1">
                  {selectedAsset ? (
                    <div className="card p-4">
                      <h4 className="font-semibold mb-3">Asset Details</h4>
                      
                      {/* Preview */}
                      <div className="mb-4">
                        <div className="aspect-square bg-muted rounded-md overflow-hidden">
                          {selectedAsset.mimeType.startsWith('image/') ? (
                            <img
                              src={selectedAsset.url}
                              alt={selectedAsset.altText || selectedAsset.filename}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-4xl">
                              <FileText className="h-10 w-10 text-muted-foreground/70" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium">Filename:</span>
                          <div className="text-muted-foreground break-all">{selectedAsset.filename}</div>
                        </div>
                        <div>
                          <span className="font-medium">Size:</span>
                          <div className="text-muted-foreground">{formatFileSize(selectedAsset.fileSize)}</div>
                        </div>
                        <div>
                          <span className="font-medium">Type:</span>
                          <div className="text-muted-foreground">{selectedAsset.mimeType}</div>
                        </div>
                        {selectedAsset.dimensions && (
                          <div>
                            <span className="font-medium">Dimensions:</span>
                            <div className="text-muted-foreground">
                              {selectedAsset.dimensions.width} × {selectedAsset.dimensions.height}
                            </div>
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Uploaded:</span>
                          <div className="text-muted-foreground">{formatDate(selectedAsset.createdAt)}</div>
                        </div>
                        {selectedAsset.altText && (
                          <div>
                            <span className="font-medium">Alt Text:</span>
                            <div className="text-muted-foreground">{selectedAsset.altText}</div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="mt-4 space-y-2">
                        <button
                          type="button"
                          onClick={handleSelect}
                          className="btn w-full"
                        >
                          Select This File
                        </button>
                        <button
                          type="button"
                          onClick={() => window.open(selectedAsset.url, '_blank')}
                          className="btn btn-outline w-full"
                        >
                          View Full Size
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="card p-4">
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="mx-auto mb-2 h-7 w-7" />
                        <div>Select a file to see details</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <div className="text-sm text-muted-foreground">
              {mediaAssets.length} file{mediaAssets.length !== 1 ? 's' : ''} in library
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline"
              >
                Cancel
              </button>
              {selectedAsset && view === 'grid' && (
                <button
                  type="button"
                  onClick={handleSelect}
                  className="btn"
                >
                  Select File
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaManager;

const deserializeMediaAsset = (asset: any): MediaAsset => ({
  ...asset,
  createdAt: asset?.createdAt ? new Date(asset.createdAt) : new Date(),
  dimensions: asset?.dimensions ?? undefined
});
