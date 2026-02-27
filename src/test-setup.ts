import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.location (browser-like test environments only)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'location', {
    value: {
      href: 'http://127.0.0.1:4321',
      pathname: '/',
      search: '',
      hash: '',
    },
    writable: true,
  });
}

// Mock alert
global.alert = vi.fn();

// Mock fetch if not already mocked
if (!global.fetch) {
  global.fetch = vi.fn();
}

const suppressedWarnSnippets = [
  'Multiple GoTrueClient instances detected',
  'OPENAI_API_KEY is not set',
  'GOOGLE_GENAI_API_KEY is not set',
  'ANTHROPIC_API_KEY is not set',
  'ELEVENLABS_API_KEY is not set'
];

const originalWarn = console.warn.bind(console);
console.warn = (...args) => {
  const [first] = args;
  if (typeof first === 'string' && suppressedWarnSnippets.some((snippet) => first.includes(snippet))) {
    return;
  }
  originalWarn(...args);
};
