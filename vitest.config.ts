import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/.vercel/**',
      '**/.netlify/**',
      '**/dist/**'
    ],
    env: {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
      SUPABASE_SECRET_KEY: 'test-secret-key',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
