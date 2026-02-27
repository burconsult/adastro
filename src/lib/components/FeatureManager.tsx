import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AdminLoadingState } from '@/lib/components/admin/ListingPrimitives';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';

type FeatureSummary = {
  id: string;
  label: string;
  description: string;
  active: boolean;
  toggleable: boolean;
};

const FEATURE_ADMIN_ROUTES: Record<string, string> = {
  ai: '/admin/features/ai',
  comments: '/admin/features/comments',
  newsletter: '/admin/features/newsletter'
};

const getFileLabel = (file: File | null) => file?.name || 'Choose a feature package (.zip)';

export const FeatureManager: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const [features, setFeatures] = useState<FeatureSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [installFile, setInstallFile] = useState<File | null>(null);
  const [installing, setInstalling] = useState(false);
  const [busyFeatureId, setBusyFeatureId] = useState<string | null>(null);
  const [togglingFeatureId, setTogglingFeatureId] = useState<string | null>(null);
  const [removeData, setRemoveData] = useState(false);
  const [removeFiles, setRemoveFiles] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmUninstall, setConfirmUninstall] = useState<{ open: boolean; feature: FeatureSummary | null }>({
    open: false,
    feature: null
  });

  const loadFeatures = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/features');
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to load features');
      }
      const payload = await response.json();
      setFeatures(Array.isArray(payload?.features) ? payload.features : []);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load features';
      setMessage({ type: 'error', text });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeatures();
  }, [loadFeatures]);

  const setFeatureActive = useCallback(async (feature: FeatureSummary, nextActive: boolean) => {
    if (!feature.toggleable) return;

    try {
      setTogglingFeatureId(feature.id);
      setMessage(null);
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            [`features.${feature.id}.enabled`]: nextActive
          }
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to update feature status');
      }

      setMessage({
        type: 'success',
        text: `${feature.label} is now ${nextActive ? 'active' : 'inactive'}.`
      });
      await loadFeatures();
      // Admin navigation visibility is server-rendered in the layout.
      // Force a full reload so feature sub-links reflect the new active state immediately.
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to update feature status';
      setMessage({ type: 'error', text });
    } finally {
      setTogglingFeatureId(null);
    }
  }, [loadFeatures]);

  const handleInstall = useCallback(async () => {
    if (!installFile) {
      setMessage({ type: 'error', text: 'Select a feature package to install.' });
      return;
    }

    try {
      setInstalling(true);
      setMessage(null);
      const formData = new FormData();
      formData.append('file', installFile);
      const response = await fetch('/api/admin/features/install', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to install feature');
      }
      setMessage({
        type: 'success',
        text: 'Feature installed. Restart the server to activate it.'
      });
      setInstallFile(null);
      await loadFeatures();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to install feature';
      setMessage({ type: 'error', text });
    } finally {
      setInstalling(false);
    }
  }, [installFile, loadFeatures]);

  const confirmUninstallFeature = useCallback((feature: FeatureSummary) => {
    setConfirmUninstall({ open: true, feature });
    setRemoveData(false);
    setRemoveFiles(false);
  }, []);

  const exportFeatureData = useCallback(async (featureId: string) => {
    try {
      setExporting(true);
      const response = await fetch('/api/admin/features/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: featureId })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to export feature data');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `feature-${featureId}-backup.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to export feature data';
      setMessage({ type: 'error', text });
      return false;
    } finally {
      setExporting(false);
    }
  }, []);

  const handleUninstall = useCallback(async () => {
    const feature = confirmUninstall.feature;
    if (!feature) return;

    try {
      setBusyFeatureId(feature.id);
      setMessage(null);
      if (removeData) {
        const exported = await exportFeatureData(feature.id);
        if (!exported) {
          setBusyFeatureId(null);
          return;
        }
      }
      const response = await fetch('/api/admin/features/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: feature.id, purgeData: removeData, removeFiles })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to uninstall feature');
      }
      setMessage({
        type: 'success',
        text: 'Feature uninstalled. Restart the server to apply changes.'
      });
      setConfirmUninstall({ open: false, feature: null });
      await loadFeatures();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to uninstall feature';
      setMessage({ type: 'error', text });
    } finally {
      setBusyFeatureId(null);
    }
  }, [confirmUninstall.feature, exportFeatureData, loadFeatures, removeData, removeFiles]);

  const featureList = useMemo(() => features, [features]);

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-6">
        {message && (
          <div
            className={`rounded-md border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-destructive/20 bg-destructive/10 text-destructive'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="card p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Installed Features</h2>
              <p className="text-sm text-muted-foreground">
                Manage extra modules without touching core functionality.
              </p>
            </div>
            {loading ? (
              <AdminLoadingState label="Loading features..." className="px-0 py-4" />
            ) : featureList.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No features available.
              </div>
            ) : (
              <div className="space-y-3">
                {featureList.map((feature, index) => {
                  const motionProps = reduceMotion
                    ? {}
                    : {
                        initial: { opacity: 0, y: 10 },
                        animate: { opacity: 1, y: 0 },
                        transition: { duration: 0.3, delay: index * 0.03 }
                      };
                  return (
                  <motion.div
                    key={feature.id}
                    className="rounded-lg border border-border/60 bg-background p-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
                    {...motionProps}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold">{feature.label}</h3>
                        <span className="badge badge-secondary text-xs">
                          {feature.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap md:w-56 md:flex-none md:flex-col">
                      {FEATURE_ADMIN_ROUTES[feature.id] && feature.active && (
                        <a
                          href={FEATURE_ADMIN_ROUTES[feature.id]}
                          className="btn btn-outline w-full justify-center"
                        >
                          Open Page
                        </a>
                      )}
                      {feature.toggleable ? (
                        <button
                          type="button"
                          className={`btn w-full justify-center ${feature.active ? 'btn-outline' : 'btn-primary'}`}
                          onClick={() => void setFeatureActive(feature, !feature.active)}
                          disabled={busyFeatureId === feature.id || togglingFeatureId === feature.id}
                        >
                          {togglingFeatureId === feature.id
                            ? (feature.active ? 'Deactivating...' : 'Activating...')
                            : (feature.active ? 'Deactivate' : 'Activate')}
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground">Always on</span>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline w-full justify-center"
                        onClick={loadFeatures}
                        disabled={busyFeatureId === feature.id || togglingFeatureId === feature.id}
                      >
                        Refresh
                      </button>
                      <button
                        type="button"
                        className="btn btn-destructive w-full justify-center"
                        onClick={() => confirmUninstallFeature(feature)}
                        disabled={busyFeatureId === feature.id || togglingFeatureId === feature.id}
                      >
                        {busyFeatureId === feature.id ? 'Removing...' : 'Uninstall'}
                      </button>
                    </div>
                  </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Install Feature</h2>
              <p className="text-sm text-muted-foreground">
                Upload a feature package (.zip) exported from another build.
              </p>
            </div>
            <div className="space-y-3 text-sm">
              <label htmlFor="feature-install-file" className="text-sm font-medium text-foreground">
                Feature package
              </label>
              <input
                id="feature-install-file"
                type="file"
                accept=".zip,application/zip"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(event) => setInstallFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">{getFileLabel(installFile)}</p>
            </div>
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={() => void handleInstall()}
              disabled={installing}
            >
              {installing ? 'Installing...' : 'Install Feature'}
            </button>
            <p className="text-xs text-muted-foreground">
              Installs update the feature manifest. Restart the server to load new modules.
            </p>
          </div>
        </div>
      </div>

      <Dialog
        open={confirmUninstall.open}
        onOpenChange={(open) => {
          if (!open && !busyFeatureId) {
            setConfirmUninstall({ open: false, feature: null });
            setRemoveData(false);
            setRemoveFiles(false);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Uninstall feature</DialogTitle>
            <DialogDescription>
              {confirmUninstall.feature
                ? `This will remove ${confirmUninstall.feature.label} from this project and delete its settings.`
                : 'This will remove the selected feature.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={removeData}
                onChange={(event) => setRemoveData(event.target.checked)}
                className="rounded border-input text-primary focus:ring-primary"
                disabled={Boolean(busyFeatureId)}
              />
              <span>Remove feature data and tables</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={removeFiles}
                onChange={(event) => setRemoveFiles(event.target.checked)}
                className="rounded border-input text-primary focus:ring-primary"
                disabled={Boolean(busyFeatureId)}
              />
              <span>Remove feature files from this project</span>
            </label>
            {removeData && (
              <p className="text-xs text-muted-foreground">
                A backup will download before uninstalling.
              </p>
            )}
            {removeFiles && (
              <p className="text-xs text-muted-foreground">
                Keep this disabled if you only want to deactivate and keep local feature source files.
              </p>
            )}
          </div>
          <DialogFooter>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setConfirmUninstall({ open: false, feature: null })}
              disabled={Boolean(busyFeatureId)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-destructive"
              onClick={() => void handleUninstall()}
              disabled={Boolean(busyFeatureId) || exporting}
            >
              {busyFeatureId || exporting ? 'Uninstalling...' : 'Uninstall'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
