import type { FeatureServerModule } from '../types.js';
import { NEWSLETTER_PROFILE_API_EXTENSION } from './profile-api.js';

export const NEWSLETTER_FEATURE_SERVER_MODULE: FeatureServerModule = {
  id: 'newsletter',
  server: {
    profileApi: NEWSLETTER_PROFILE_API_EXTENSION
  },
  loadApi: async () => (await import('./api.js')).NEWSLETTER_FEATURE_API
};

export const FEATURE_SERVER_MODULE = NEWSLETTER_FEATURE_SERVER_MODULE;
