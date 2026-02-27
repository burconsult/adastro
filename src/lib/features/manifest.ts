import type { FeatureModule } from './types.js';
import { AI_FEATURE_MODULE } from './ai/index.js';
import { COMMENTS_FEATURE_MODULE } from './comments/index.js';
import { NEWSLETTER_FEATURE_MODULE } from './newsletter/index.js';
// @feature-installer-imports

export const FEATURE_MANIFEST: FeatureModule[] = [
  AI_FEATURE_MODULE,
  COMMENTS_FEATURE_MODULE,
  NEWSLETTER_FEATURE_MODULE,
  // @feature-installer-list
];
