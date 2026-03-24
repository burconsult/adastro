import { getEnv } from '../../../../env.js';
import { DEFAULT_TEXT_MODELS, getApiTimeoutMs } from '../config.js';
import type { AiProviderId, AiTextProvider, GenerateTextOptions, GenerateTextResponse } from '../types.js';

const providerKey: AiProviderId = 'anthropic';

export class AnthropicTextProvider implements AiTextProvider {
  async generateText(options: GenerateTextOptions): Promise<GenerateTextResponse> {
    const apiKey = getEnv('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('Anthropic provider is not configured. Set ANTHROPIC_API_KEY.');
    }

    const {
      prompt,
      system,
      model = DEFAULT_TEXT_MODELS.anthropic,
      temperature = 0.7,
      maxOutputTokens = 800
    } = options;

    if (!model) {
      throw new Error('Anthropic text generation model is not configured.');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxOutputTokens,
        temperature,
        system,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: AbortSignal.timeout(getApiTimeoutMs())
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Anthropic request failed: ${response.status} ${response.statusText} ${errorText}`.trim());
    }

    const data = await response.json();
    const text = Array.isArray(data?.content)
      ? data.content.map((part: any) => part?.text ?? '').join('')
      : '';

    return {
      text,
      provider: providerKey,
      model,
      usage: data?.usage
        ? {
            inputTokens: data.usage.input_tokens,
            outputTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens
          }
        : undefined,
      raw: data
    };
  }
}
