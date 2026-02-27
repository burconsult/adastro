import { describe, it, expect, beforeEach, vi } from 'vitest';

const resetEnv = () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.GOOGLE_GENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
};

describe('AI provider configuration', () => {
  beforeEach(() => {
    resetEnv();
    vi.resetModules();
  });

  it('returns no configured providers when keys are missing', async () => {
    const ai = await import('../index.js');
    expect(ai.getConfiguredProviders()).toEqual([]);
    await expect(ai.generateContent({ prompt: 'Hello world' })).rejects.toThrow(/configured/i);
  });

  it('detects OpenAI provider when API key is set', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const ai = await import('../index.js');
    expect(ai.getConfiguredProviders()).toEqual(['openai']);

    const provider = ai.getProvider('openai');
    expect(provider).toBeTruthy();
  });

  it('detects Gemini provider when API key is set', async () => {
    process.env.GOOGLE_GENAI_API_KEY = 'gemini-key';
    const ai = await import('../index.js');
    expect(ai.getConfiguredProviders()).toEqual(['gemini']);

    const provider = ai.getProvider('gemini');
    expect(provider).toBeTruthy();
  });

  it('detects Anthropic provider when API key is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';
    const ai = await import('../index.js');
    expect(ai.getConfiguredProviders()).toEqual(['anthropic']);

    const provider = ai.getProvider('anthropic');
    expect(provider).toBeTruthy();
  });

  it('detects multiple providers when keys are set', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.GOOGLE_GENAI_API_KEY = 'gemini-key';

    const ai = await import('../index.js');
    expect(ai.getConfiguredProviders()).toEqual(['openai', 'gemini']);
  });
});
