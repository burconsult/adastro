#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE_URL = 'https://media.githubusercontent.com/media/iplocate/ip-address-databases/main/ip-to-country/ip-to-country.mmdb';
const targetPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(process.cwd(), 'public/data/geo/ip-to-country.mmdb');

const ensureParent = async (filePath) => {
  const parent = path.dirname(filePath);
  await fs.mkdir(parent, { recursive: true });
};

const run = async () => {
  console.log(`Downloading country database from ${SOURCE_URL}`);
  const response = await fetch(SOURCE_URL, { method: 'GET', redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to download country database: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await ensureParent(targetPath);
  await fs.writeFile(targetPath, Buffer.from(arrayBuffer));
  const stats = await fs.stat(targetPath);
  console.log(`Saved ${Math.round(stats.size / 1024 / 1024)} MB to ${targetPath}`);
  console.log('Data source attribution required by CC BY-SA 4.0: https://www.iplocate.io/');
};

run().catch((error) => {
  console.error('sync-analytics-geo-db failed:', error);
  process.exitCode = 1;
});

