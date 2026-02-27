import type { FeatureServerModule } from '../types.js';

export const COMMENTS_FEATURE_SERVER_MODULE: FeatureServerModule = {
  id: 'comments',
  loadApi: async () => (await import('./api.js')).COMMENTS_FEATURE_API
};

export const FEATURE_SERVER_MODULE = COMMENTS_FEATURE_SERVER_MODULE;
