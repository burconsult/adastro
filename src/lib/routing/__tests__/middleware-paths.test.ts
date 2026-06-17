import { describe, expect, it } from 'vitest';
import {
  shouldBypassSetupRedirect,
  shouldRedirectToDefaultLocale
} from '../middleware-paths.js';

describe('middleware path bypasses', () => {
  it('does not localize Vercel image optimizer requests', () => {
    expect(shouldRedirectToDefaultLocale('/_vercel/image')).toBe(false);
    expect(shouldRedirectToDefaultLocale('/_vercel/image/foo')).toBe(false);
    expect(shouldRedirectToDefaultLocale('/_image')).toBe(false);
    expect(shouldRedirectToDefaultLocale('/_image/foo')).toBe(false);
  });

  it('allows internal optimizer requests before setup is complete', () => {
    expect(shouldBypassSetupRedirect('/_vercel/image')).toBe(true);
    expect(shouldBypassSetupRedirect('/_image')).toBe(true);
  });

  it('still redirects public content routes to the default locale', () => {
    expect(shouldRedirectToDefaultLocale('/articles')).toBe(true);
    expect(shouldRedirectToDefaultLocale('/about')).toBe(true);
  });

  it('continues to bypass concrete static assets', () => {
    expect(shouldRedirectToDefaultLocale('/images/article_image_02.webp')).toBe(false);
    expect(shouldBypassSetupRedirect('/favicon.svg')).toBe(true);
  });
});
