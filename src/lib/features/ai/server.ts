import type { FeatureServerModule } from '../types.js';

export const AI_FEATURE_SERVER_MODULE: FeatureServerModule = {
  id: 'ai',
  loadApi: async () => (await import('./api.js')).AI_FEATURE_API
};

export const FEATURE_SERVER_MODULE = AI_FEATURE_SERVER_MODULE;
