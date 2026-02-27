import type { FeatureServerModule } from './types.js';
import { AI_FEATURE_SERVER_MODULE } from './ai/server.js';
import { COMMENTS_FEATURE_SERVER_MODULE } from './comments/server.js';
import { NEWSLETTER_FEATURE_SERVER_MODULE } from './newsletter/server.js';
// @feature-server-installer-imports

export const FEATURE_SERVER_MANIFEST: FeatureServerModule[] = [
  AI_FEATURE_SERVER_MODULE,
  COMMENTS_FEATURE_SERVER_MODULE,
  NEWSLETTER_FEATURE_SERVER_MODULE,
  // @feature-server-installer-list
];
