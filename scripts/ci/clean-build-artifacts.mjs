#!/usr/bin/env node

import { isAbsolute, relative, resolve, sep } from 'node:path';
import { rmSync } from 'node:fs';

const projectRoot = process.cwd();
const generatedPaths = [
  '.netlify/v1',
  '.netlify/functions',
  '.netlify/functions-internal',
  '.vercel/output',
  'build',
  'dist'
];

for (const generatedPath of generatedPaths) {
  const target = resolve(projectRoot, generatedPath);
  const relativeTarget = relative(projectRoot, target);

  if (
    !relativeTarget
    || relativeTarget === '..'
    || relativeTarget.startsWith(`..${sep}`)
    || isAbsolute(relativeTarget)
  ) {
    throw new Error(`Refusing to clean unsafe build path: ${target}`);
  }

  rmSync(target, { recursive: true, force: true });
}

console.log(`Cleaned ${generatedPaths.length} generated build path(s).`);
