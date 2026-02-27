import { getEnv } from '../../../../env.js';
import { DEFAULT_ANTHROPIC_MODEL, getApiTimeoutMs } from '../config.js';
import type {
  AiProvider,
  AiProviderKey,
  GenerateContentOptions,
  GenerateContentResponse
} from '../types.js';

const providerKey: AiProviderKey = 'anthropic';
const apiKey = getEnv('ANTHROPIC_API_KEY');

if (!apiKey) {
  console.warn('⚠️  ANTHROPIC_API_KEY is not set. Anthropic provider is disabled.');
}

export class AnthropicProvider implements AiProvider {
  async generate(options: GenerateContentOptions): Promise<GenerateContentResponse> {
    if (!apiKey) {
      throw new Error('Anthropic provider is not configured. Set ANTHROPIC_API_KEY.');
    }

    const {
      prompt,
      system,
      model = DEFAULT_ANTHROPIC_MODEL,
      temperature = 0.7,
      maxOutputTokens = 800
    } = options;

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

export function isAnthropicConfigured(): boolean {
  return Boolean(apiKey);
}
