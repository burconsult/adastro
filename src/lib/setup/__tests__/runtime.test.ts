import { afterEach, describe, expect, it } from 'vitest';
import {
  detectDeploymentTarget,
  normalizeDeploymentProvider,
  providerFromHost
} from '../runtime.js';

describe('setup runtime deployment detection', () => {
  afterEach(() => {
    delete process.env.ASTRO_ADAPTER;
    delete process.env.NETLIFY;
    delete process.env.NETLIFY_IMAGES_CDN_DOMAIN;
    delete process.env.NETLIFY_LOCAL;
    delete process.env.SITE_ID;
    delete process.env.DEPLOY_ID;
    delete process.env.CONTEXT;
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_PROJECT_ID;
  });

  it('normalizes deployment provider values', () => {
    expect(normalizeDeploymentProvider('NETLIFY')).toBe('netlify');
    expect(normalizeDeploymentProvider('vercel')).toBe('vercel');
    expect(normalizeDeploymentProvider('custom')).toBeNull();
  });

  it('derives provider from known hosts', () => {
    expect(providerFromHost('https://preview.adastro.netlify.app')).toBe('netlify');
    expect(providerFromHost('preview.adastro.vercel.app')).toBe('vercel');
    expect(providerFromHost('https://example.com')).toBeNull();
  });

  it('prefers explicit Netlify request headers', () => {
    const request = new Request('https://example.com/admin', {
      headers: {
        'x-nf-request-id': 'request-123'
      }
    });

    expect(detectDeploymentTarget(request)).toBe('netlify');
  });

  it('detects Netlify from forwarded host names', () => {
    const request = new Request('https://example.com/admin', {
      headers: {
        'x-forwarded-host': 'preview-adastro.netlify.app'
      }
    });

    expect(detectDeploymentTarget(request)).toBe('netlify');
  });

  it('falls back to Netlify runtime markers', () => {
    process.env.NETLIFY = 'true';

    const request = new Request('https://example.com/admin');
    expect(detectDeploymentTarget(request)).toBe('netlify');
  });

  it('returns custom when no platform markers are present', () => {
    const request = new Request('https://example.com/admin');
    expect(detectDeploymentTarget(request)).toBe('custom');
  });
});
