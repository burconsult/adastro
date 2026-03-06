import type { FeatureServerModule } from '../types.js';
import { COMMENTS_FEATURE_MCP_EXTENSION } from './mcp.js';

export const COMMENTS_FEATURE_SERVER_MODULE: FeatureServerModule = {
  id: 'comments',
  server: {
    mcp: COMMENTS_FEATURE_MCP_EXTENSION
  },
  loadApi: async () => (await import('./api.js')).COMMENTS_FEATURE_API
};

export const FEATURE_SERVER_MODULE = COMMENTS_FEATURE_SERVER_MODULE;
