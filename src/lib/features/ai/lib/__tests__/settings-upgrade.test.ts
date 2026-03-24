import { describe, expect, it } from 'vitest';

import { buildAiSettingsUpgrade } from '../settings-upgrade.js';

describe('AI settings upgrade', () => {
  it('maps legacy provider-specific settings into capability-scoped defaults', () => {
    const upgraded = buildAiSettingsUpgrade({
      'features.ai.enableSeo': true,
      'features.ai.enableImages': true,
      'features.ai.enableAudio': false,
      'features.ai.defaultProvider.text': 'openai',
      'features.ai.defaultProvider.image': 'gemini',
      'features.ai.defaultProvider.audio': 'elevenlabs',
      'features.ai.model.text.openai': 'gpt-5',
      'features.ai.model.image.gemini': 'gemini-2.5-flash-image',
      'features.ai.model.audio.elevenlabs': 'eleven_turbo_v2',
      'features.ai.voice.elevenlabs': 'voice-123',
      'features.ai.imageSize': '1792x1024',
      'features.ai.imageAspectRatio': '16:9',
      'features.ai.imageResolution': '2K',
      'features.ai.usageCaps.enabled': true,
      'features.ai.usageCaps.seoDailyRequests': 5,
      'features.ai.usageCaps.imageDailyRequests': 3,
      'features.ai.usageCaps.audioDailyRequests': 2
    });

    expect(upgraded['features.ai.tools.seo.enabled']).toBe(true);
    expect(upgraded['features.ai.tools.audio.enabled']).toBe(false);
    expect(upgraded['features.ai.capabilities.text.defaultProvider']).toBe('openai');
    expect(upgraded['features.ai.capabilities.text.defaultModel']).toBe('gpt-5');
    expect(upgraded['features.ai.capabilities.image.defaultProvider']).toBe('gemini');
    expect(upgraded['features.ai.capabilities.image.defaultModel']).toBe('gemini-2.5-flash-image');
    expect(upgraded['features.ai.capabilities.audio.defaultProvider']).toBe('elevenlabs');
    expect(upgraded['features.ai.capabilities.audio.defaultModel']).toBe('eleven_turbo_v2');
    expect(upgraded['features.ai.capabilities.audio.defaultVoice']).toBe('voice-123');
    expect(upgraded['features.ai.capabilities.image.defaultSize']).toBe('1792x1024');
    expect(upgraded['features.ai.capabilities.image.defaultAspectRatio']).toBe('16:9');
    expect(upgraded['features.ai.capabilities.image.defaultResolution']).toBe('2K');
    expect(upgraded['features.ai.limits.enabled']).toBe(true);
    expect(upgraded['features.ai.limits.audioDailyRequests']).toBe(2);
  });
});
