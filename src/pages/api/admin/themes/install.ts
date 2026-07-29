import type { APIRoute } from 'astro';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { requireAdmin } from '../../../../lib/auth/auth-helpers.js';
import { recordAuditEvent } from '../../../../lib/audit.js';

const PROJECT_ROOT = process.cwd();
const THEME_INSTALL_SCRIPT = join(PROJECT_ROOT, 'infra/themes/install.js');

const runInstaller = (archivePath: string) =>
  new Promise<void>((resolve, reject) => {
    execFile(process.execPath, [THEME_INSTALL_SCRIPT, archivePath], { cwd: PROJECT_ROOT }, (error, stdout, stderr) => {
      if (error) {
        const message = [stderr, stdout, error.message]
          .map((value) => value?.toString().trim())
          .filter(Boolean)
          .join('\n')
          .replace(/^❌\s*/gm, '');
        reject(new Error(message || 'Failed to install theme package.'));
      } else {
        resolve();
      }
    });
  });

export const POST: APIRoute = async ({ request }) => {
  let tempRoot: string | null = null;
  try {
    const user = await requireAdmin(request);
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'Theme package file is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    tempRoot = await mkdtemp(join(tmpdir(), 'adastro-theme-'));
    const archivePath = join(tempRoot, file.name || 'theme.zip');
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(archivePath, buffer);

    await runInstaller(archivePath);
    await recordAuditEvent({
      actor: user,
      action: 'theme.install',
      entityType: 'theme',
      entityLabel: file.name || 'theme.zip',
      metadata: { packageName: file.name || 'theme.zip' }
    });

    return new Response(JSON.stringify({
      success: true,
      requiresRestart: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Theme install failed:', error);
    const message = error instanceof Error && error.message.trim().length > 0
      ? error.message.trim()
      : 'Failed to install theme package.';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }
};
