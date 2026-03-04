import { useEffect } from 'react';

type MigrationMessage = {
  type?: string;
  severity?: string;
  message?: string;
  suggestion?: string;
  id?: string;
};

type MigrationProgressEvent = {
  stage?: string;
  status?: 'start' | 'progress' | 'complete';
  message?: string;
  percent?: number;
  current?: number;
  total?: number;
};

type MigrationResult = {
  summary?: {
    postsImported?: number;
    postsProcessed?: number;
    authorsImported?: number;
    authorsProcessed?: number;
    categoriesImported?: number;
    categoriesProcessed?: number;
    tagsImported?: number;
    tagsProcessed?: number;
    mediaImported?: number;
    mediaProcessed?: number;
    totalProcessingTime?: number;
  };
  optimizationReport?: {
    totalFilesProcessed?: number;
    sizeSavings?: number;
    sizeSavingsPercentage?: number;
    formatConversions?: {
      webpConversions?: number;
      avifConversions?: number;
    };
    oversizedImagesOptimized?: number;
    missingAltTextGenerated?: number;
  };
  postMigrationReport?: {
    contentScanned?: number;
    processingTime?: number;
    imageUrlsUpdated?: number;
    brokenLinksFixed?: number;
    altTextGenerated?: number;
    contentStructureOptimized?: number;
    seoIssuesFixed?: number;
    issues?: MigrationMessage[];
    recommendations?: Array<{
      postTitle?: string;
      recommendations?: string[];
    }>;
  };
  warnings?: MigrationMessage[];
  errors?: MigrationMessage[];
  redirectMappings?: unknown[];
  jobId?: string;
  rollbackSafe?: boolean;
};

type StreamEvent = {
  type?: 'progress' | 'status' | 'result' | 'error';
  data?: MigrationProgressEvent | MigrationResult;
  message?: string;
  jobId?: string;
  rollbackSafe?: boolean;
};

const MAX_PROGRESS_MESSAGES = 6;
const MAX_DIRECT_UPLOAD_BYTES = 4 * 1024 * 1024;

const toErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export default function MigrationManager() {
  useEffect(() => {
    const form = document.getElementById('migration-form') as HTMLFormElement | null;
    const submitButton = document.getElementById('migration-submit') as HTMLButtonElement | null;
    const statusText = document.getElementById('migration-status') as HTMLElement | null;
    const resultsCard = document.getElementById('migration-results') as HTMLElement | null;

    if (!form || !submitButton || !resultsCard) {
      return;
    }

    const summaryGrid = resultsCard.querySelector('[data-summary]') as HTMLElement | null;
    const optimizationBlock = resultsCard.querySelector('[data-optimization]') as HTMLElement | null;
    const postOptimizationBlock = resultsCard.querySelector('[data-post-optimization]') as HTMLElement | null;
    const warningsBlock = resultsCard.querySelector('[data-warnings]') as HTMLElement | null;
    const errorsBlock = resultsCard.querySelector('[data-errors]') as HTMLElement | null;
    const redirectPreview = resultsCard.querySelector('[data-redirect-preview]') as HTMLElement | null;
    const redirectDownload = resultsCard.querySelector('[data-redirect-download]') as HTMLAnchorElement | null;

    if (!summaryGrid || !optimizationBlock || !warningsBlock || !errorsBlock || !redirectPreview || !redirectDownload) {
      return;
    }

    const progressContainer = document.querySelector('[data-progress]') as HTMLElement | null;
    const progressStatus = progressContainer?.querySelector('[data-progress-status]') as HTMLElement | null;
    const progressPercent = progressContainer?.querySelector('[data-progress-percent]') as HTMLElement | null;
    const progressBar = progressContainer?.querySelector('[data-progress-bar]') as HTMLElement | null;
    const progressLog = progressContainer?.querySelector('[data-progress-log]') as HTMLElement | null;
    const stepList = document.querySelector('[data-step-list]') as HTMLElement | null;
    const undoButton = document.getElementById('migration-undo') as HTMLButtonElement | null;
    const undoNote = document.getElementById('migration-undo-note') as HTMLElement | null;

    let redirectUrl: string | null = null;
    let currentJobId: string | null = null;
    let rollbackSafe = false;
    let lastPercent = 0;

    const resetProgress = () => {
      if (!progressContainer) return;
      progressContainer.classList.add('hidden');
      if (progressStatus) progressStatus.textContent = 'Preparing migration...';
      if (progressPercent) progressPercent.textContent = '0%';
      if (progressBar) progressBar.style.width = '0%';
      if (progressLog) progressLog.innerHTML = '';
    };

    const appendProgressMessage = (message: string) => {
      if (!progressLog || !message) return;
      const entry = document.createElement('li');
      entry.textContent = message;
      progressLog.appendChild(entry);
      while (progressLog.children.length > MAX_PROGRESS_MESSAGES) {
        progressLog.removeChild(progressLog.firstChild as Node);
      }
    };

    const updateStep = (stage: string | undefined, update: MigrationProgressEvent | undefined) => {
      if (!stepList || !stage) return;
      const step = stepList.querySelector(`[data-step="${stage}"]`) as HTMLElement | null;
      if (!step) return;
      step.classList.add('border-primary/40', 'bg-primary/10');
      const meta = step.querySelector('[data-step-meta]') as HTMLElement | null;
      if (!meta) return;
      const statusLabel = update?.status === 'complete'
        ? 'Done'
        : update?.status === 'start'
          ? 'In progress'
          : 'Working';
      const count = update?.total ? ` (${update.current || 0}/${update.total})` : '';
      meta.textContent = `${statusLabel}${count}`;
    };

    const handleProgressEvent = (event: MigrationProgressEvent | undefined) => {
      if (!event) return;
      const percentValue = typeof event.percent === 'number'
        ? Math.max(0, Math.min(100, Math.round(event.percent)))
        : 0;

      if (progressContainer) progressContainer.classList.remove('hidden');

      if (progressBar) {
        const nextPercent = Math.max(lastPercent, percentValue);
        progressBar.style.width = `${nextPercent}%`;
        lastPercent = nextPercent;
      }

      if (progressPercent) {
        progressPercent.textContent = `${lastPercent}%`;
      }

      if (event.message) {
        if (progressStatus) progressStatus.textContent = event.message;
        if (statusText) statusText.textContent = event.message;
        appendProgressMessage(event.message);
      }

      if (event.stage) {
        updateStep(event.stage, event);
      }
    };

    const renderMessages = (
      block: HTMLElement,
      items: MigrationMessage[] | undefined,
      title: string,
      intent: 'warn' | 'error'
    ) => {
      if (!items?.length) {
        block.classList.add('hidden');
        block.innerHTML = '';
        return;
      }

      const containerClass = intent === 'error'
        ? 'rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-3'
        : 'rounded-lg border border-primary/30 bg-primary/10 p-4 space-y-3';

      block.classList.remove('hidden');
      block.innerHTML = `
        <div class="${containerClass}">
          <h3 class="text-lg font-semibold">${escapeHtml(title)}</h3>
          <ul class="space-y-2 text-sm">
            ${items
              .map((item) => `
                <li>
                  <strong>${escapeHtml(item.type?.toUpperCase?.() || '')}</strong> - ${escapeHtml(item.message)}
                  ${item.suggestion ? `<div class="text-xs text-muted-foreground mt-1">Suggestion: ${escapeHtml(item.suggestion)}</div>` : ''}
                </li>
              `)
              .join('')}
          </ul>
        </div>
      `;
    };

    const renderSummary = (summary: MigrationResult['summary']) => {
      if (!summary) {
        summaryGrid.innerHTML = '';
        return;
      }

      const entries: Array<[string, unknown, unknown]> = [
        ['Posts imported', summary.postsImported, summary.postsProcessed],
        ['Authors imported', summary.authorsImported, summary.authorsProcessed],
        ['Categories imported', summary.categoriesImported, summary.categoriesProcessed],
        ['Tags imported', summary.tagsImported, summary.tagsProcessed],
        ['Media imported', summary.mediaImported, summary.mediaProcessed],
        ['Processing time', `${Math.round((summary.totalProcessingTime || 0) / 1000)}s`, null]
      ];

      summaryGrid.innerHTML = entries
        .map(([label, value, total]) => `
          <div class="rounded-lg border border-input bg-muted/40 p-4">
            <p class="text-sm text-muted-foreground">${escapeHtml(label)}</p>
            <p class="text-2xl font-semibold">
              ${escapeHtml(value ?? 0)}${total !== null ? ` <span class="text-sm text-muted-foreground">/ ${escapeHtml(total)}</span>` : ''}
            </p>
          </div>
        `)
        .join('');
    };

    const renderOptimization = (report: MigrationResult['optimizationReport']) => {
      if (!report) {
        optimizationBlock.innerHTML = '';
        return;
      }

      const processed = report.totalFilesProcessed || 0;
      const savingsMb = ((report.sizeSavings || 0) / 1024 / 1024).toFixed(2);
      const savingsPct = (report.sizeSavingsPercentage || 0).toFixed(1);
      const modernFormats = (report.formatConversions?.webpConversions || 0) + (report.formatConversions?.avifConversions || 0);

      optimizationBlock.innerHTML = `
        <div class="rounded-lg border border-input bg-muted/40 p-4 space-y-2">
          <h3 class="text-lg font-semibold">Media optimization</h3>
          <p class="text-sm text-muted-foreground">
            Processed ${escapeHtml(processed)} files. Estimated savings: ${escapeHtml(savingsMb)} MB (${escapeHtml(savingsPct)}%).
          </p>
          <ul class="text-sm text-muted-foreground space-y-1">
            <li>Modern formats generated: ${escapeHtml(modernFormats)}</li>
            <li>Oversized images optimized: ${escapeHtml(report.oversizedImagesOptimized || 0)}</li>
            <li>Alt text generated: ${escapeHtml(report.missingAltTextGenerated || 0)}</li>
          </ul>
        </div>
      `;
    };

    const renderPostMigrationReport = (report: MigrationResult['postMigrationReport']) => {
      if (!postOptimizationBlock) return;
      if (!report) {
        postOptimizationBlock.innerHTML = '';
        return;
      }

      const issues = Array.isArray(report.issues) ? report.issues : [];
      const recommendations = Array.isArray(report.recommendations) ? report.recommendations : [];

      const issuesPreview = issues.slice(0, 5).map((issue) => `
        <li>
          <strong>${escapeHtml(issue.severity?.toUpperCase?.() || '')}</strong> - ${escapeHtml(issue.message)}
          ${issue.suggestion ? `<div class="text-xs text-muted-foreground mt-1">Suggestion: ${escapeHtml(issue.suggestion)}</div>` : ''}
        </li>
      `).join('');

      const recommendationsPreview = recommendations.slice(0, 5).map((recommendation) => `
        <li>
          <strong>${escapeHtml(recommendation.postTitle)}</strong> - ${(recommendation.recommendations || []).slice(0, 2).map((item) => escapeHtml(item)).join('; ')}
        </li>
      `).join('');

      postOptimizationBlock.innerHTML = `
        <div class="rounded-lg border border-input bg-muted/40 p-4 space-y-2">
          <h3 class="text-lg font-semibold">Post-migration cleanup</h3>
          <p class="text-sm text-muted-foreground">
            Scanned ${escapeHtml(report.contentScanned || 0)} posts in ${escapeHtml(Math.round((report.processingTime || 0) / 1000))}s.
          </p>
          <ul class="text-sm text-muted-foreground space-y-1">
            <li>Image URLs updated: ${escapeHtml(report.imageUrlsUpdated || 0)}</li>
            <li>Broken links fixed: ${escapeHtml(report.brokenLinksFixed || 0)}</li>
            <li>Alt text generated: ${escapeHtml(report.altTextGenerated || 0)}</li>
            <li>Content structure optimized: ${escapeHtml(report.contentStructureOptimized || 0)}</li>
            <li>SEO issues fixed: ${escapeHtml(report.seoIssuesFixed || 0)}</li>
          </ul>
        </div>
        ${issues.length ? `
          <div class="rounded-lg border border-primary/30 bg-primary/10 p-4 space-y-3">
            <h3 class="text-lg font-semibold">Cleanup issues</h3>
            <ul class="space-y-2 text-sm">${issuesPreview}</ul>
          </div>
        ` : ''}
        ${recommendations.length ? `
          <div class="rounded-lg border border-input bg-muted/40 p-4 space-y-3">
            <h3 class="text-lg font-semibold">SEO recommendations</h3>
            <ul class="space-y-2 text-sm text-muted-foreground">${recommendationsPreview}</ul>
          </div>
        ` : ''}
      `;
    };

    const resetResults = () => {
      summaryGrid.innerHTML = '';
      optimizationBlock.innerHTML = '';
      if (postOptimizationBlock) postOptimizationBlock.innerHTML = '';
      warningsBlock.innerHTML = '';
      warningsBlock.classList.add('hidden');
      errorsBlock.innerHTML = '';
      errorsBlock.classList.add('hidden');
      redirectPreview.textContent = 'Upload a file to generate redirect mappings.';
      redirectDownload.classList.add('hidden');

      if (redirectUrl) {
        URL.revokeObjectURL(redirectUrl);
        redirectUrl = null;
      }

      lastPercent = 0;
      currentJobId = null;
      rollbackSafe = false;
      if (undoButton) undoButton.disabled = true;
      if (undoNote) undoNote.textContent = 'Undo is available for trial imports without overwrite.';

      if (stepList) {
        stepList.querySelectorAll('[data-step]').forEach((step) => {
          (step as HTMLElement).classList.remove('border-primary/40', 'bg-primary/10');
          const meta = (step as HTMLElement).querySelector('[data-step-meta]') as HTMLElement | null;
          if (meta) meta.textContent = 'Waiting...';
        });
      }

      resetProgress();
    };

    const onSubmit = async (event: Event) => {
      event.preventDefault();

      resetResults();
      resultsCard.classList.remove('hidden');
      if (statusText) statusText.textContent = 'Uploading WXR file and running migration...';
      submitButton.disabled = true;
      submitButton.textContent = 'Importing...';

      try {
        const formData = new FormData(form);
        const file = formData.get('file');

        if (file instanceof File && file.size > MAX_DIRECT_UPLOAD_BYTES) {
          if (statusText) statusText.textContent = 'Uploading large WXR file to storage...';
          appendProgressMessage('Uploading large WXR file to storage...');

          const uploadInit = await fetch('/api/admin/migration/upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name })
          });

          const uploadPayload = await uploadInit.json().catch(() => null) as { signedUrl?: string; path?: string; error?: string } | null;
          if (!uploadInit.ok || !uploadPayload?.signedUrl || !uploadPayload.path) {
            throw new Error(uploadPayload?.error || 'Failed to prepare upload');
          }

          const uploadResponse = await fetch(uploadPayload.signedUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': file.type || 'application/octet-stream'
            },
            body: file
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload WXR file to storage.');
          }

          formData.delete('file');
          formData.append('storagePath', uploadPayload.path);
          formData.append('filename', file.name);
        }

        const response = await fetch('/api/admin/migration/import', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { message?: string; error?: string } | null;
          throw new Error(payload?.message || payload?.error || 'Migration failed');
        }

        if (!response.body) {
          throw new Error('No response body received from migration API.');
        }

        if (progressContainer) {
          progressContainer.classList.remove('hidden');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalResult: MigrationResult | null = null;
        let streamError: string | null = null;

        const processLine = (line: string) => {
          if (!line.trim()) return;
          let parsed: StreamEvent;
          try {
            parsed = JSON.parse(line) as StreamEvent;
          } catch (parseError) {
            console.warn('Unable to parse migration event', parseError, line);
            return;
          }

          if (parsed.type === 'progress') {
            handleProgressEvent(parsed.data as MigrationProgressEvent);
            return;
          }

          if (parsed.type === 'status') {
            if (parsed.message) {
              if (statusText) statusText.textContent = parsed.message;
              appendProgressMessage(parsed.message);
            }
            if (parsed.jobId) currentJobId = parsed.jobId;
            rollbackSafe = Boolean(parsed.rollbackSafe);
            return;
          }

          if (parsed.type === 'result') {
            finalResult = parsed.data as MigrationResult;
            if (finalResult?.redirectMappings?.length) {
              const downloadPayload = JSON.stringify(finalResult.redirectMappings, null, 2);
              if (redirectUrl) URL.revokeObjectURL(redirectUrl);
              redirectUrl = URL.createObjectURL(new Blob([downloadPayload], { type: 'application/json' }));
              redirectPreview.textContent = `${finalResult.redirectMappings.length} redirect mappings generated.`;
              redirectDownload.href = redirectUrl;
              redirectDownload.classList.remove('hidden');
            }
            renderSummary(finalResult?.summary);
            renderOptimization(finalResult?.optimizationReport);
            renderPostMigrationReport(finalResult?.postMigrationReport);
            renderMessages(warningsBlock, finalResult?.warnings, 'Warnings', 'warn');
            renderMessages(errorsBlock, finalResult?.errors, 'Errors', 'error');
            return;
          }

          if (parsed.type === 'error') {
            streamError = parsed.message || 'Migration failed';
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            processLine(line);
          }
        }

        if (buffer) {
          processLine(buffer);
        }

        if (streamError) {
          throw new Error(streamError);
        }

        if (finalResult) {
          renderSummary(finalResult.summary);
          renderOptimization(finalResult.optimizationReport);
          renderPostMigrationReport(finalResult.postMigrationReport);
          renderMessages(warningsBlock, finalResult.warnings, 'Warnings', 'warn');
          renderMessages(errorsBlock, finalResult.errors, 'Errors', 'error');
        }

        if (rollbackSafe && undoButton) {
          undoButton.disabled = false;
          if (undoNote) undoNote.textContent = 'Undo will remove imported content for this migration.';
        }
      } catch (error) {
        console.error('Migration failed:', error);
        if (statusText) {
          statusText.textContent = 'Migration failed. Please check the logs.';
        }
        renderMessages(
          errorsBlock,
          [{ type: 'error', message: toErrorMessage(error, 'Migration failed') }],
          'Errors',
          'error'
        );
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Start Import';
      }
    };

    const onUndo = async () => {
      if (!currentJobId || !undoButton) return;
      undoButton.disabled = true;
      if (undoNote) undoNote.textContent = 'Undoing migration...';

      try {
        const response = await fetch('/api/admin/migration/undo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: currentJobId })
        });

        const payload = await response.json().catch(() => null) as { error?: string } | null;
        if (!response.ok) {
          throw new Error(payload?.error || 'Undo failed');
        }

        if (undoNote) undoNote.textContent = 'Migration rolled back. Refresh to confirm changes.';
        resetResults();
      } catch (error) {
        console.error('Undo failed:', error);
        if (undoNote) undoNote.textContent = toErrorMessage(error, 'Undo failed');
        undoButton.disabled = false;
      }
    };

    form.addEventListener('submit', onSubmit);
    undoButton?.addEventListener('click', onUndo);

    return () => {
      form.removeEventListener('submit', onSubmit);
      undoButton?.removeEventListener('click', onUndo);
      if (redirectUrl) {
        URL.revokeObjectURL(redirectUrl);
      }
    };
  }, []);

  return null;
}
