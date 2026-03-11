import { describe, expect, it } from 'vitest';
import { buildSystemPageBlueprints, getRequiredSystemPageSlugs } from '../system-pages';

describe('system page helpers', () => {
  it('derives required slugs from the article base path', () => {
    expect(getRequiredSystemPageSlugs('articles')).toEqual(['home', 'articles', 'about', 'contact']);
  });

  it('builds blueprints for all required system pages', () => {
    const blueprints = buildSystemPageBlueprints('articles');

    expect(blueprints.map((entry) => entry.slug)).toEqual(['home', 'articles', 'about', 'contact']);
    expect(blueprints[0]?.sections.length).toBeGreaterThan(0);
    expect(blueprints[1]?.template).toBe('blog');
  });
});
