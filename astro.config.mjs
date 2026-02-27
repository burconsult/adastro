// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import netlify from '@astrojs/netlify';

const normalizedAdapter = process.env.ASTRO_ADAPTER?.trim().toLowerCase();
const platformAdapter = process.env.NETLIFY
  ? 'netlify'
  : 'vercel';
const resolvedAdapter = normalizedAdapter === 'netlify' || normalizedAdapter === 'vercel'
  ? normalizedAdapter
  : platformAdapter;

const NETLIFY_EXCLUDE_FILES = [
  './.git/**',
  './.netlify/v1/**',
  './.netlify/functions/**',
  './.netlify/functions-internal/**',
  './.vercel/**',
  './docs/**',
  './external_docs/**',
  './release/**',
  './tests/**',
  './**/.DS_Store'
];

const adapter = resolvedAdapter === 'netlify'
  ? netlify({ excludeFiles: NETLIFY_EXCLUDE_FILES })
  : vercel();

/** @param {unknown} value */
const normalizeSiteUrl = (value) => {
  if (!value || typeof value !== 'string') return null;
  try {
    const parsed = new URL(value.trim());
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
};

const resolvedSiteUrl = normalizeSiteUrl(process.env.SITE_URL) || 'https://example.com';
const NON_PUBLIC_SITEMAP_PREFIXES = ['/admin', '/auth', '/setup', '/profile', '/test'];

// https://astro.build/config
export default defineConfig({
  site: resolvedSiteUrl,
  output: 'server', // Enable server-side rendering for API routes
  adapter,
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover'
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Keep script assets as file URLs (never inline as data: URIs),
      // so strict CSP script-src 'self' continues to work.
      assetsInlineLimit: 0
    }
  },

  integrations: [
    react({
      include: ['**/react/*', '**/components/**/*.tsx', '**/components/**/*.jsx']
    }), 
    sitemap({
      filter: (page) => {
        try {
          const pathname = new URL(page).pathname.replace(/\/$/, '') || '/';
          return !NON_PUBLIC_SITEMAP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
        } catch {
          return true;
        }
      }
    })
  ],
  image: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co'
      }
    ]
  }
});
