import { describe, expect, it } from 'vitest';

import { estimateUsageCost } from '../pricing.js';

describe('AI usage pricing estimates', () => {
  it('uses exact token pricing for OpenAI text models', () => {
    const estimate = estimateUsageCost({
      capability: 'text',
      provider: 'openai',
      model: 'gpt-5',
      requestCount: 1,
      inputTokens: 2_000,
      outputTokens: 500
    });

    expect(estimate.method).toBe('exact');
    expect(estimate.estimatedUsd).toBeCloseTo(0.0075, 6);
    expect(estimate.minimumUsd).toBeCloseTo(0.0075, 6);
    expect(estimate.maximumUsd).toBeCloseTo(0.0075, 6);
  });

  it('maps gateway text models to the upstream provider pricing', () => {
    const estimate = estimateUsageCost({
      capability: 'text',
      provider: 'gateway',
      model: 'anthropic/claude-3-5-sonnet-latest',
      requestCount: 1,
      inputTokens: 1_000,
      outputTokens: 500
    });

    expect(estimate.method).toBe('exact');
    expect(estimate.estimatedUsd).toBeCloseTo(0.0105, 6);
  });

  it('returns a range for OpenAI image generations when quality is unknown', () => {
    const estimate = estimateUsageCost({
      capability: 'image',
      provider: 'openai',
      model: 'gpt-image-1',
      requestCount: 2,
      inputTokens: 0,
      outputTokens: 0,
      metadata: {
        size: '1792x1024'
      }
    });

    expect(estimate.method).toBe('range');
    expect(estimate.minimumUsd).toBeCloseTo(0.032, 6);
    expect(estimate.maximumUsd).toBeCloseTo(0.5, 6);
  });

  it('estimates Gemini image generation by recorded resolution', () => {
    const estimate = estimateUsageCost({
      capability: 'image',
      provider: 'gemini',
      model: 'gemini-3-pro-image-preview',
      requestCount: 1,
      inputTokens: 0,
      outputTokens: 0,
      metadata: {
        resolution: '4K'
      }
    });

    expect(estimate.method).toBe('estimate');
    expect(estimate.estimatedUsd).toBeCloseTo(0.24, 6);
  });

  it('returns a plan-dependent range for ElevenLabs narration', () => {
    const estimate = estimateUsageCost({
      capability: 'audio',
      provider: 'elevenlabs',
      model: 'eleven_multilingual_v2',
      requestCount: 1,
      inputTokens: 0,
      outputTokens: 0,
      metadata: {
        textLength: 2_000
      }
    });

    expect(estimate.method).toBe('range');
    expect(estimate.minimumUsd).toBeCloseTo(0.24, 6);
    expect(estimate.maximumUsd).toBeCloseTo(0.6, 6);
  });
});
