import { describe, expect, it } from 'vitest';
import { resolveLegacyVercelImageRedirect } from '../vercel-image-redirect.js';

const origin = 'https://www.adastro.no';

describe('resolveLegacyVercelImageRedirect', () => {
  it('accepts root-relative public image paths', () => {
    expect(resolveLegacyVercelImageRedirect('/images/article_image_02.webp', origin))
      .toBe('/images/article_image_02.webp');
  });

  it('accepts same-origin absolute public image paths', () => {
    expect(resolveLegacyVercelImageRedirect('https://www.adastro.no/images/article_image_02.webp?q=1', origin))
      .toBe('/images/article_image_02.webp?q=1');
  });

  it('rejects external absolute URLs', () => {
    expect(resolveLegacyVercelImageRedirect('https://example.com/images/article_image_02.webp', origin))
      .toBeNull();
  });

  it('rejects protocol-relative URLs', () => {
    expect(resolveLegacyVercelImageRedirect('//example.com/images/article_image_02.webp', origin))
      .toBeNull();
  });

  it('rejects non-image local paths', () => {
    expect(resolveLegacyVercelImageRedirect('/admin', origin)).toBeNull();
  });
});
