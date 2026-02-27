document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('migration-form');
  const submitButton = document.getElementById('migration-submit');
  const statusText = document.getElementById('migration-status');
  const resultsCard = document.getElementById('migration-results');

  if (!form || !submitButton || !resultsCard) {
    return;
  }

  const summaryGrid = resultsCard.querySelector('[data-summary]');
  const optimizationBlock = resultsCard.querySelector('[data-optimization]');
  const postOptimizationBlock = resultsCard.querySelector('[data-post-optimization]');
  const warningsBlock = resultsCard.querySelector('[data-warnings]');
  const errorsBlock = resultsCard.querySelector('[data-errors]');
  const redirectPreview = resultsCard.querySelector('[data-redirect-preview]');
  const redirectDownload = resultsCard.querySelector('[data-redirect-download]');
  const progressContainer = document.querySelector('[data-progress]');
  const progressStatus = progressContainer?.querySelector('[data-progress-status]');
  const progressPercent = progressContainer?.querySelector('[data-progress-percent]');
  const progressBar = progressContainer?.querySelector('[data-progress-bar]');
  const progressLog = progressContainer?.querySelector('[data-progress-log]');
  const stepList = document.querySelector('[data-step-list]');
  const undoButton = document.getElementById('migration-undo');
  const undoNote = document.getElementById('migration-undo-note');

  let redirectUrl = null;
  let currentJobId = null;
  let rollbackSafe = false;
  let lastPercent = 0;
  const MAX_PROGRESS_MESSAGES = 6;
  const MAX_DIRECT_UPLOAD_BYTES = 4 * 1024 * 1024;

  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const resetProgress = () => {
    if (!progressContainer) return;
    progressContainer.classList.add('hidden');
    if (progressStatus) progressStatus.textContent = 'Preparing migration...';
    if (progressPercent) progressPercent.textContent = '0%';
    if (progressBar) progressBar.style.width = '0%';
    if (progressLog) progressLog.innerHTML = '';
  };

  const appendProgressMessage = (message) => {
    if (!progressLog || !message) return;
    const entry = document.createElement('li');
    entry.textContent = message;
    progressLog.appendChild(entry);
    while (progressLog.children.length > MAX_PROGRESS_MESSAGES) {
      progressLog.removeChild(progressLog.firstChild);
    }
  };

  const updateStep = (stage, update) => {
    if (!stepList || !stage) return;
    const step = stepList.querySelector(`[data-step="${stage}"]`);
    if (!step) return;
    step.classList.add('border-primary/40', 'bg-primary/10');
    const meta = step.querySelector('[data-step-meta]');
    if (!meta) return;
    const statusLabel = update?.status === 'complete'
      ? 'Done'
      : update?.status === 'start'
        ? 'In progress'
        : 'Working';
    const count = update?.total ? ` (${update.current || 0}/${update.total})` : '';
    meta.textContent = `${statusLabel}${count}`;
  };

  const handleProgressEvent = (event) => {
    if (!event) return;
    const percentValue = typeof event.percent === 'number'
      ? Math.max(0, Math.min(100, Math.round(event.percent)))
      : 0;
    if (progressContainer) {
      progressContainer.classList.remove('hidden');
    }
    if (progressBar) {
      const nextPercent = Math.max(lastPercent, percentValue);
      progressBar.style.width = `${nextPercent}%`;
      lastPercent = nextPercent;
    }
    if (progressPercent) {
      progressPercent.textContent = `${lastPercent}%`;
    }
    if (progressStatus && event.message) {
      progressStatus.textContent = event.message;
    }
    if (statusText && event.message) {
      statusText.textContent = event.message;
    }
    if (event.message) {
      appendProgressMessage(event.message);
    }
    if (event.stage) {
      updateStep(event.stage, event);
    }
  };

  const resetResults = () => {
    summaryGrid.innerHTML = '';
    optimizationBlock.innerHTML = '';
    if (postOptimizationBlock) {
      postOptimizationBlock.innerHTML = '';
    }
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
        step.classList.remove('border-primary/40', 'bg-primary/10');
        const meta = step.querySelector('[data-step-meta]');
        if (meta) meta.textContent = 'Waiting...';
      });
    }
    resetProgress();
  };

  const renderSummary = (summary) => {
    const entries = [
      ['Posts imported', summary.postsImported, summary.postsProcessed],
      ['Authors imported', summary.authorsImported, summary.authorsProcessed],
      ['Categories imported', summary.categoriesImported, summary.categoriesProcessed],
      ['Tags imported', summary.tagsImported, summary.tagsProcessed],
      ['Media imported', summary.mediaImported, summary.mediaProcessed],
      ['Processing time', `${Math.round(summary.totalProcessingTime / 1000)}s`, null],
    ];

    summaryGrid.innerHTML = entries
      .map(([label, value, total]) => {
        const safeLabel = escapeHtml(label);
        const safeValue = escapeHtml(value ?? 0);
        const safeTotal = total !== null ? escapeHtml(total) : null;
        return `
          <div class="rounded-lg border border-input bg-muted/40 p-4">
            <p class="text-sm text-muted-foreground">${safeLabel}</p>
            <p class="text-2xl font-semibold">
              ${safeValue}${safeTotal !== null ? ` <span class="text-sm text-muted-foreground">/ ${safeTotal}</span>` : ''}
            </p>
          </div>
        `;
      })
      .join('');
  };

  const renderOptimization = (report) => {
    if (!report) {
      optimizationBlock.innerHTML = '';
      return;
    }

    const processed = escapeHtml(report.totalFilesProcessed);
    const savingsMb = escapeHtml((report.sizeSavings / 1024 / 1024).toFixed(2));
    const savingsPct = escapeHtml(report.sizeSavingsPercentage.toFixed(1));
    const modernFormats = escapeHtml(report.formatConversions.webpConversions + report.formatConversions.avifConversions);
    const oversized = escapeHtml(report.oversizedImagesOptimized);
    const altTextGenerated = escapeHtml(report.missingAltTextGenerated);

    optimizationBlock.innerHTML = `
      <div class="rounded-lg border border-input bg-muted/40 p-4 space-y-2">
        <h3 class="text-lg font-semibold">Media optimization</h3>
        <p class="text-sm text-muted-foreground">
          Processed ${processed} files. Estimated savings: ${savingsMb} MB
          (${savingsPct}%).
        </p>
        <ul class="text-sm text-muted-foreground space-y-1">
          <li>Modern formats generated: ${modernFormats}</li>
          <li>Oversized images optimized: ${oversized}</li>
          <li>Alt text generated: ${altTextGenerated}</li>
        </ul>
      </div>
    `;
  };

  const renderPostMigrationReport = (report) => {
    if (!postOptimizationBlock) return;
    if (!report) {
      postOptimizationBlock.innerHTML = '';
      return;
    }

    const issues = Array.isArray(report.issues) ? report.issues : [];
    const recommendations = Array.isArray(report.recommendations) ? report.recommendations : [];

    const issuesPreview = issues
      .slice(0, 5)
      .map(
        (issue) => `
          <li>
            <strong>${escapeHtml(issue.severity?.toUpperCase?.() || '')}</strong> – ${escapeHtml(issue.message)}
            ${issue.suggestion ? `<div class="text-xs text-muted-foreground mt-1">Suggestion: ${escapeHtml(issue.suggestion)}</div>` : ''}
          </li>
        `
      )
      .join('');

    const recommendationsPreview = recommendations
      .slice(0, 5)
      .map(
        (rec) => `
          <li>
            <strong>${escapeHtml(rec.postTitle)}</strong> – ${rec.recommendations.slice(0, 2).map(escapeHtml).join('; ')}
          </li>
        `
      )
      .join('');

    const contentScanned = escapeHtml(report.contentScanned);
    const processingTime = escapeHtml(Math.round(report.processingTime / 1000));
    const imageUrlsUpdated = escapeHtml(report.imageUrlsUpdated);
    const brokenLinksFixed = escapeHtml(report.brokenLinksFixed);
    const altTextGenerated = escapeHtml(report.altTextGenerated);
    const structureOptimized = escapeHtml(report.contentStructureOptimized);
    const seoIssuesFixed = escapeHtml(report.seoIssuesFixed);

    postOptimizationBlock.innerHTML = `
      <div class="rounded-lg border border-input bg-muted/40 p-4 space-y-2">
        <h3 class="text-lg font-semibold">Post-migration cleanup</h3>
        <p class="text-sm text-muted-foreground">
          Scanned ${contentScanned} posts in ${processingTime}s.
        </p>
        <ul class="text-sm text-muted-foreground space-y-1">
          <li>Image URLs updated: ${imageUrlsUpdated}</li>
          <li>Broken links fixed: ${brokenLinksFixed}</li>
          <li>Alt text generated: ${altTextGenerated}</li>
          <li>Content structure optimized: ${structureOptimized}</li>
          <li>SEO issues fixed: ${seoIssuesFixed}</li>
        </ul>
      </div>
      ${issues.length ? `
        <div class="rounded-lg border border-primary/30 bg-primary/10 p-4 space-y-3">
          <h3 class="text-lg font-semibold">Cleanup issues</h3>
          <ul class="space-y-2 text-sm">
            ${issuesPreview}
          </ul>
        </div>
      ` : ''}
      ${recommendations.length ? `
        <div class="rounded-lg border border-input bg-muted/40 p-4 space-y-3">
          <h3 class="text-lg font-semibold">SEO recommendations</h3>
          <ul class="space-y-2 text-sm text-muted-foreground">
            ${recommendationsPreview}
          </ul>
        </div>
      ` : ''}
    `;
  };

  const renderMessages = (block, items, title, intent) => {
    if (!items?.length) {
      block.classList.add('hidden');
      block.innerHTML = '';
      return;
    }

    block.classList.remove('hidden');
    const containerClass =
      intent === 'error'
        ? 'rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-3'
        : 'rounded-lg border border-primary/30 bg-primary/10 p-4 space-y-3';
    const safeTitle = escapeHtml(title);
    block.innerHTML = `
      <div class="${containerClass}">
        <h3 class="text-lg font-semibold">${safeTitle}</h3>
        <ul class="space-y-2 text-sm">
          ${items
            .map(
              (item) => `
                <li>
                  <strong>${escapeHtml(item.type?.toUpperCase?.() || '')}</strong> – ${escapeHtml(item.message)}
                  ${item.suggestion ? `<div class="text-xs text-muted-foreground mt-1">Suggestion: ${escapeHtml(item.suggestion)}</div>` : ''}
                </li>
              `
            )
            .join('')}
        </ul>
      </div>
    `;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    resetResults();
    resultsCard.classList.remove('hidden');
    statusText.textContent = 'Uploading WXR file and running migration...';
    submitButton.disabled = true;
    submitButton.textContent = 'Importing...';

    try {
      const formData = new FormData(form);
      const file = formData.get('file');

      if (file instanceof File && file.size > MAX_DIRECT_UPLOAD_BYTES) {
        statusText.textContent = 'Uploading large WXR file to storage...';
        appendProgressMessage('Uploading large WXR file to storage...');

        const uploadInit = await fetch('/api/admin/migration/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name }),
        });

        const uploadPayload = await uploadInit.json();
        if (!uploadInit.ok) {
          throw new Error(uploadPayload?.error || 'Failed to prepare upload');
        }

        const uploadResponse = await fetch(uploadPayload.signedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
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
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
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
      let finalResult = null;
      let streamError = null;

      const processLine = (line) => {
        if (!line.trim()) return;
        let eventData;
        try {
          eventData = JSON.parse(line);
        } catch (parseError) {
          console.warn('Unable to parse migration event', parseError, line);
          return;
        }

        if (eventData.type === 'progress') {
          handleProgressEvent(eventData.data);
        } else if (eventData.type === 'status') {
          if (eventData.message) {
            statusText.textContent = eventData.message;
            appendProgressMessage(eventData.message);
          }
          if (eventData.jobId) {
            currentJobId = eventData.jobId;
            rollbackSafe = Boolean(eventData.rollbackSafe);
          }
        } else if (eventData.type === 'result') {
          finalResult = eventData.data;
          if (finalResult?.redirectMappings?.length) {
            const downloadPayload = JSON.stringify(finalResult.redirectMappings, null, 2);
            if (redirectUrl) {
              URL.revokeObjectURL(redirectUrl);
            }
            redirectUrl = URL.createObjectURL(new Blob([downloadPayload], { type: 'application/json' }));
            redirectPreview.textContent = `${finalResult.redirectMappings.length} redirect mappings generated.`;
            redirectDownload.href = redirectUrl;
            redirectDownload.classList.remove('hidden');
          }
          if (finalResult?.summary) {
            renderSummary(finalResult.summary);
          }
          renderOptimization(finalResult?.optimizationReport);
          renderPostMigrationReport(finalResult?.postMigrationReport);
          renderMessages(warningsBlock, finalResult?.warnings, 'Warnings', 'warn');
          renderMessages(errorsBlock, finalResult?.errors, 'Errors', 'error');
        } else if (eventData.type === 'error') {
          streamError = eventData.message || 'Migration failed';
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
        if (finalResult?.summary) {
          renderSummary(finalResult.summary);
        }
        renderOptimization(finalResult?.optimizationReport);
        renderPostMigrationReport(finalResult?.postMigrationReport);
        renderMessages(warningsBlock, finalResult?.warnings, 'Warnings', 'warn');
        renderMessages(errorsBlock, finalResult?.errors, 'Errors', 'error');
      }

      if (rollbackSafe && undoButton) {
        undoButton.disabled = false;
        if (undoNote) {
          undoNote.textContent = 'Undo will remove imported content for this migration.';
        }
      }
    } catch (error) {
      console.error('Migration failed:', error);
      if (statusText) {
        statusText.textContent = 'Migration failed. Please check the logs.';
      }
      renderMessages(errorsBlock, [{ type: 'error', message: error?.message || 'Migration failed' }], 'Errors', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Run Migration';
    }
  });

  undoButton?.addEventListener('click', async () => {
    if (!currentJobId || !undoButton) return;
    undoButton.disabled = true;
    undoNote.textContent = 'Undoing migration...';

    try {
      const response = await fetch('/api/admin/migration/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: currentJobId }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Undo failed');
      }

      undoNote.textContent = 'Migration rolled back. Refresh to confirm changes.';
      resetResults();
    } catch (error) {
      console.error('Undo failed:', error);
      undoNote.textContent = error?.message || 'Undo failed';
      undoButton.disabled = false;
    }
  });
});
