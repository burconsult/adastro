import React from 'react';
import { normalizeFeatureFlag } from '@/lib/features/flags';
import type { ProfileExtensionProps } from '../../types.js';

export const NewsletterProfilePanel: React.FC<ProfileExtensionProps> = ({
  data,
  updateData,
  featureFlags
}) => {
  const enabled = normalizeFeatureFlag(featureFlags?.newsletter, false);
  const optedIn = Boolean(data.optIn);

  if (!enabled) {
    return (
      <div className="card p-6 space-y-2">
        <h2 className="text-lg font-semibold">Newsletter</h2>
        <p className="text-sm text-muted-foreground">
          Newsletter subscriptions are currently disabled.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Newsletter</h2>
        <p className="text-sm text-muted-foreground">
          Choose whether to receive updates from this blog.
        </p>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={optedIn}
          onChange={(event) => updateData({ ...data, optIn: event.target.checked })}
          className="mt-1 rounded border-input text-primary focus:ring-primary"
        />
        <span>
          Send me email updates when new posts go live.
        </span>
      </label>
    </div>
  );
};
