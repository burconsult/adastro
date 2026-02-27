import React, { useState, useCallback } from 'react';
import { MAX_MEDIA_UPLOAD_BYTES, formatMediaUploadLimitMb } from '@/lib/config/media';
import type { MediaOptimizationResult } from '../services/media-manager.js';

interface MediaUploadProps {
  onUploadComplete?: (result: MediaOptimizationResult) => void;
  onError?: (error: Error) => void;
  accept?: string;
  maxFileSize?: number; // in bytes
}

export const MediaUpload: React.FC<MediaUploadProps> = ({
  onUploadComplete,
  onError,
  accept = 'image/*',
  maxFileSize = MAX_MEDIA_UPLOAD_BYTES
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    stage: string;
    progress: number;
  } | null>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    if (file.size > maxFileSize) {
      onError?.(new Error(`File size exceeds ${maxFileSize / 1024 / 1024}MB limit`));
      return;
    }

    setUploading(true);
    setUploadProgress({ stage: 'Uploading...', progress: 0 });

    try {
      const formData = new FormData();
      formData.append('file', file);

      setUploadProgress({ stage: 'Processing...', progress: 30 });

      const response = await fetch('/api/admin/media/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.message || errorPayload?.error || 'Upload failed');
      }

      const result = await response.json();

      setUploadProgress({ stage: 'Complete!', progress: 100 });

      onUploadComplete?.(result);

    } catch (error) {
      onError?.(error as Error);
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(null), 2000);
    }
  }, [maxFileSize, onUploadComplete, onError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  return (
    <div className="media-upload">
      <div
        className={`rounded-lg border-2 border-dashed p-8 text-center transition ${
          uploading
            ? 'cursor-not-allowed border-border bg-muted/40'
            : dragOver
              ? 'cursor-pointer border-primary/50 bg-primary/5'
              : 'cursor-pointer border-border bg-transparent hover:border-primary/40'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
      >
        {uploading ? (
          <div className="upload-progress">
            <div className="text-sm font-medium text-foreground">
              {uploadProgress?.stage || 'Processing...'}
            </div>
            <div 
              className="mt-4 h-2 w-full overflow-hidden rounded bg-muted"
            >
              <div
                style={{
                  width: `${uploadProgress?.progress || 0}%`,
                  transition: 'width 0.3s ease'
                }}
                className="h-full bg-primary"
              />
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 text-5xl">
              📁
            </div>
            <p className="text-sm text-foreground">
              Drag and drop files here, or{' '}
              <label className="cursor-pointer text-primary underline underline-offset-2">
                browse
                <input
                  type="file"
                  accept={accept}
                  onChange={handleFileSelect}
                  className="sr-only"
                  disabled={uploading}
                />
              </label>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Maximum file size: {formatMediaUploadLimitMb(maxFileSize)}MB
            </p>
          </>
        )}
      </div>

    </div>
  );
};

export default MediaUpload;
