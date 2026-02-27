import type { APIRoute } from 'astro';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { requireAdmin } from '../../../../lib/auth/auth-helpers.js';

const PROJECT_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const THEME_INSTALL_SCRIPT = join(PROJECT_ROOT, 'infra/themes/install.js');

const runInstaller = (archivePath: string) =>
  new Promise<void>((resolve, reject) => {
    execFile(process.execPath, [THEME_INSTALL_SCRIPT, archivePath], { cwd: PROJECT_ROOT }, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

export const POST: APIRoute = async ({ request }) => {
  let tempRoot: string | null = null;
  try {
    await requireAdmin(request);
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

    return new Response(JSON.stringify({
      success: true,
      requiresRestart: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Theme install failed:', error);
    return new Response(JSON.stringify({ error: 'Failed to install theme package.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }
};
