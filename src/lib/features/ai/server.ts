import type { FeatureServerModule } from '../types.js';
import { AI_FEATURE_MCP_EXTENSION } from './mcp.js';

export const AI_FEATURE_SERVER_MODULE: FeatureServerModule = {
  id: 'ai',
  server: {
    mcp: AI_FEATURE_MCP_EXTENSION
  },
  loadApi: async () => (await import('./api.js')).AI_FEATURE_API
};

export const FEATURE_SERVER_MODULE = AI_FEATURE_SERVER_MODULE;
