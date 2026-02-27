import React, { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/lib/components/ui/toast';

interface PublishingControlsProps {
  status: 'draft' | 'published' | 'scheduled';
  publishedAt?: Date;
  onSave: (status: 'draft' | 'published' | 'scheduled', publishedAt?: Date) => void;
  saving: boolean;
  mode: 'create' | 'edit';
  hasChanges: boolean;
}

export const PublishingControls: React.FC<PublishingControlsProps> = ({
  status,
  publishedAt,
  onSave,
  saving,
  mode,
  hasChanges
}) => {
  const { toast } = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(() => {
    if (publishedAt && status === 'scheduled') {
      return publishedAt.toISOString().slice(0, 16);
    }
    // Default to tomorrow at 9 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow.toISOString().slice(0, 16);
  });
  const isDraft = status === 'draft';
  const isPublished = status === 'published';
  const isScheduled = status === 'scheduled';

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (status === 'scheduled' && publishedAt) {
      setScheduledDate(publishedAt.toISOString().slice(0, 16));
    }
    if (status !== 'scheduled') {
      setShowScheduler(false);
    }
  }, [publishedAt, status]);

  const handleSaveDraft = useCallback(() => {
    onSave('draft');
  }, [onSave]);

  const handlePublish = useCallback(() => {
    onSave('published');
  }, [onSave]);

  const handleSchedule = useCallback(() => {
    const date = new Date(scheduledDate);
    if (date <= new Date()) {
      toast({
        variant: 'destructive',
        title: 'Invalid schedule date',
        description: 'Pick a time in the future to schedule this post.',
      });
      return;
    }
    onSave('scheduled', date);
    setShowScheduler(false);
  }, [scheduledDate, onSave, toast]);

  const getStatusBadge = () => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-success/10 text-success">
            <div className="mr-1 h-2 w-2 rounded-full bg-success"></div>
            Published
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-info/10 text-info">
            <div className="mr-1 h-2 w-2 rounded-full bg-info"></div>
            Scheduled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-muted text-muted-foreground">
            <div className="mr-1 h-2 w-2 rounded-full bg-muted-foreground/60"></div>
            Draft
          </span>
        );
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="card p-4">
      <h4 className="font-semibold mb-3">Publishing</h4>
      
      {/* Current Status */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status:</span>
          {getStatusBadge()}
        </div>
        
        {hydrated && status === 'published' && publishedAt && (
          <div className="text-xs text-muted-foreground">
            Published on {formatDate(publishedAt)}
          </div>
        )}

        {hydrated && status === 'scheduled' && publishedAt && (
          <div className="text-xs text-muted-foreground">
            Scheduled for {formatDate(publishedAt)}
          </div>
        )}
      </div>

      {/* Publishing Actions */}
      <div className="space-y-2">
        {/* Save Draft */}
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={saving || (isDraft && !hasChanges)}
          className="btn btn-outline w-full"
        >
          {saving ? 'Saving...' : isDraft ? 'Save Draft' : 'Move to Draft'}
        </button>

        {/* Publish Now */}
        <button
          type="button"
          onClick={handlePublish}
          disabled={saving || (isPublished && !hasChanges)}
          className="btn w-full"
        >
          {saving
            ? 'Publishing...'
            : isPublished
              ? hasChanges
                ? 'Update Post'
                : 'Published'
              : 'Publish Now'}
        </button>

        {/* Schedule */}
        <button
          type="button"
          onClick={() => setShowScheduler(!showScheduler)}
          disabled={saving}
          className="btn btn-outline w-full"
        >
          {isScheduled ? 'Reschedule' : isPublished ? 'Schedule Update' : 'Schedule'}
        </button>
      </div>

      {/* Scheduler */}
      {showScheduler && (
        <div className="mt-4 rounded-md bg-muted/60 p-3">
          <label htmlFor="scheduledDate" className="mb-2 block text-sm font-medium text-foreground">
            Publish Date & Time
          </label>
          <input
            id="scheduledDate"
            type="datetime-local"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="mb-3 w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            min={new Date().toISOString().slice(0, 16)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSchedule}
              disabled={saving}
              className="btn flex-1"
            >
              {saving ? 'Scheduling...' : 'Schedule'}
            </button>
            <button
              type="button"
              onClick={() => setShowScheduler(false)}
              className="btn btn-outline flex-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Additional Info */}
      <div className="mt-4 border-t border-border pt-4">
        <div className="space-y-1 text-xs text-muted-foreground">
          {mode === 'create' && (
            <p>• Save as draft to continue editing later</p>
          )}
          {isPublished && <p>• Updates go live as soon as you publish</p>}
          {isDraft && <p>• Drafts are only visible in the admin</p>}
          <p>• Scheduled posts will be published automatically</p>
          {!hasChanges && <p>• No unsaved changes</p>}
        </div>
      </div>

    </div>
  );
};

export default PublishingControls;
