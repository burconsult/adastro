import React, { useState } from 'react';
import CommentsManager from '@/lib/components/CommentsManager';
import FeatureSettingsPanelHost from './FeatureSettingsPanelHost';

type CommentsTab = 'queue' | 'settings';

type CommentsFeatureDashboardProps = {
  articleBasePath: string;
  articlePermalinkStyle: 'segment' | 'wordpress';
};

export default function CommentsFeatureDashboard({
  articleBasePath,
  articlePermalinkStyle
}: CommentsFeatureDashboardProps) {
  const [activeTab, setActiveTab] = useState<CommentsTab>('queue');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-card/40 p-2">
        <button
          type="button"
          className={`btn h-9 px-4 text-sm ${activeTab === 'queue' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('queue')}
        >
          Moderation Queue
        </button>
        <button
          type="button"
          className={`btn h-9 px-4 text-sm ${activeTab === 'settings' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      {activeTab === 'queue' ? (
        <CommentsManager
          articleBasePath={articleBasePath}
          articlePermalinkStyle={articlePermalinkStyle}
        />
      ) : (
        <FeatureSettingsPanelHost featureId="comments" />
      )}
    </div>
  );
}
