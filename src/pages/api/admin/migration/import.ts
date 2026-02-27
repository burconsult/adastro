import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/auth/auth-helpers';
import { getSiteContentRouting } from '@/lib/site-config';
import { wordPressMigrationService } from '@/lib/services/wordpress-migration.js';
import { postMigrationOptimizer } from '@/lib/services/post-migration-optimizer.js';
import { getStorageBucketConfig } from '@/lib/storage/buckets';
import { supabaseAdmin } from '@/lib/supabase.js';

const encoder = new TextEncoder();
const MAX_MIGRATION_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_MIGRATION_UPLOAD_MB = Math.round(MAX_MIGRATION_UPLOAD_BYTES / (1024 * 1024));

export const POST: APIRoute = async ({ request }) => {
  await requireAdmin(request);
  const { migrationUploads: migrationBucket } = await getStorageBucketConfig();

  const formData = await request.formData();
  const file = formData.get('file');
  const storagePath = formData.get('storagePath');
  const filename = formData.get('filename');

  let fileToProcess: File | null = null;

  if (file instanceof File) {
    if (typeof file.size === 'number' && file.size > MAX_MIGRATION_UPLOAD_BYTES) {
      return new Response(JSON.stringify({
        error: `WXR file is too large. Maximum upload size is ${MAX_MIGRATION_UPLOAD_MB}MB.`
      }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    fileToProcess = file;
  } else if (typeof storagePath === 'string') {
    if (!storagePath.startsWith('wxr/')) {
      return new Response(JSON.stringify({ error: 'Invalid storage path' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data, error } = await supabaseAdmin.storage
      .from(migrationBucket)
      .download(storagePath);

    if (error || !data) {
      console.error('Migration import download failed:', error);
      return new Response(JSON.stringify({ error: 'Failed to download migration file' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (typeof data.size === 'number' && data.size > MAX_MIGRATION_UPLOAD_BYTES) {
      return new Response(JSON.stringify({
        error: `WXR file is too large. Maximum upload size is ${MAX_MIGRATION_UPLOAD_MB}MB.`
      }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const buffer = await data.arrayBuffer();
    const safeName = typeof filename === 'string' && filename.trim() ? filename : storagePath.split('/').pop() || 'migration.xml';
    fileToProcess = new File([buffer], safeName, { type: data.type || 'application/xml' });
  } else {
    return new Response(JSON.stringify({ error: 'No WXR file provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let articleBasePath: string | undefined;
  let articlePermalinkStyle: 'segment' | 'wordpress' | undefined;
  try {
    const contentRouting = await getSiteContentRouting();
    articleBasePath = contentRouting.articleBasePath;
    articlePermalinkStyle = contentRouting.articlePermalinkStyle;
  } catch {
    // Fall back to migration defaults if routing settings cannot be read.
  }

  const options = {
    includeDrafts: formData.get('includeDrafts') === 'true',
    overwriteExisting: formData.get('overwriteExisting') === 'true',
    generateAltText: formData.get('generateAltText') !== 'false',
    optimizeImages: formData.get('optimizeImages') !== 'false',
    newBaseUrl: formData.get('newBaseUrl')?.toString() || undefined,
    preserveURLStructure: formData.get('preserveURLStructure') === 'true',
    trialImport: formData.get('trialImport') === 'true',
    articleBasePath,
    articlePermalinkStyle
  };
  const runPostMigrationCleanup = formData.get('postMigrationCleanup') === 'true';
  const rollbackSafe = !options.overwriteExisting;

  const { data: job, error: jobError } = await supabaseAdmin
    .from('migration_jobs')
    .insert({
      filename: fileToProcess.name || 'migration.xml',
      status: 'processing',
      progress: 0,
      total_items: 0,
      processed_items: 0,
      options: { ...options, postMigrationCleanup: runPostMigrationCleanup },
      rollback_safe: rollbackSafe,
      started_at: new Date().toISOString()
    })
    .select('id')
    .single();

  if (jobError || !job) {
    console.error('Migration import job creation failed:', jobError);
    return new Response(JSON.stringify({ error: 'Failed to create migration job' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: any) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        send({ type: 'status', message: 'Starting migration…', jobId: job.id, rollbackSafe });

        let lastPercent = 0;

        const result = await wordPressMigrationService.importFromWXR(
          fileToProcess,
          options,
          async (update) => {
            send({ type: 'progress', data: update });
            if (update.percent !== lastPercent) {
              lastPercent = update.percent;
              await supabaseAdmin
                .from('migration_jobs')
                .update({
                  progress: update.percent
                })
                .eq('id', job.id);
            }
          },
          {
            onTotals: async (totalUnits) => {
              await supabaseAdmin
                .from('migration_jobs')
                .update({ total_items: totalUnits })
                .eq('id', job.id);
            },
            onArtifact: async (artifact) => {
              await supabaseAdmin
                .from('migration_artifacts')
                .insert({
                  job_id: job.id,
                  entity_type: artifact.type,
                  entity_id: artifact.id
                });
            }
          }
        );

        let postMigrationReport;
        let warnings = result.warnings;

        if (runPostMigrationCleanup) {
          send({ type: 'progress', data: { stage: 'cleanup', status: 'start', message: 'Running post-migration cleanup…', percent: 0 } });
          try {
            postMigrationReport = await postMigrationOptimizer.runPostMigrationOptimization();
            send({ type: 'progress', data: { stage: 'cleanup', status: 'complete', message: 'Post-migration cleanup complete.', percent: 100 } });
          } catch (error) {
            console.error('Post-migration cleanup failed:', error);
            warnings = [
              ...warnings,
              {
                type: 'post',
                id: 'post-migration',
                message: error instanceof Error ? error.message : 'Post-migration cleanup failed',
                suggestion: 'Retry the cleanup from the Migration screen after imports finish.'
              }
            ];
          }
        }

        await supabaseAdmin
          .from('migration_jobs')
          .update({
            status: result.success ? 'completed' : 'failed',
            progress: 100,
            results: result.summary,
            error_log: result.success ? null : JSON.stringify(result.errors),
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);

        send({
          type: 'result',
          data: { ...result, warnings, postMigrationReport, jobId: job.id, rollbackSafe }
        });
      } catch (error) {
        console.error('Migration import failed:', error);
        await supabaseAdmin
          .from('migration_jobs')
          .update({
            status: 'failed',
            error_log: error instanceof Error ? error.message : 'Migration failed',
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);
        send({
          type: 'error',
          message: error instanceof Error ? error.message : 'Migration failed'
        });
      } finally {
        if (typeof storagePath === 'string') {
          try {
            await supabaseAdmin.storage
              .from(migrationBucket)
              .remove([storagePath]);
          } catch (cleanupError) {
            console.warn('Failed to cleanup migration upload:', cleanupError);
          }
        }
        controller.close();
      }
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/jsonl',
      'Cache-Control': 'no-cache'
    }
  });
};
