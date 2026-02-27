import type { EditorJsToolsLoader } from '../../types.js';
import { normalizeFeatureFlag } from '@/lib/features/flags';

const normalizeOpenAiImageSize = (value?: string): string => {
  if (value === '1536x1024') return '1792x1024';
  if (value === '1024x1536') return '1024x1792';
  if (value === '1792x1024' || value === '1024x1792' || value === '1024x1024') {
    return value;
  }
  return '1024x1024';
};

export const loadAiEditorTools: EditorJsToolsLoader = async (data) => {
  try {
    const [settingsResponse, statusResponse] = await Promise.all([
      fetch('/api/admin/settings?keys=features.ai.enabled,features.ai.enableImages,features.ai.imageSize,features.ai.imageAspectRatio,features.ai.imageResolution,features.ai.defaultProvider.image'),
      fetch('/api/features/ai/status')
    ]);

    if (!settingsResponse.ok) {
      return {};
    }

    const settings = await settingsResponse.json();
    const statusAvailable = statusResponse.ok;
    const status = statusAvailable ? await statusResponse.json() : null;
    const aiSuiteEnabled = normalizeFeatureFlag(settings['features.ai.enabled'], false);
    const imagesEnabled = normalizeFeatureFlag(settings['features.ai.enableImages'], true);
    const provider = settings['features.ai.defaultProvider.image'] || 'openai';
    const imageProviders = Array.isArray(status?.imageProviders) ? status.imageProviders : [];
    const providerReady = imageProviders.includes(provider) || !statusAvailable;
    const hasAiImageBlock = Array.isArray(data?.blocks)
      ? data.blocks.some((block) => block?.type === 'aiImage')
      : false;
    const allowToolbox = aiSuiteEnabled && imagesEnabled && providerReady;

    if (!allowToolbox && !hasAiImageBlock) {
      return {};
    }

    const { default: AiImageTool } = await import('./ai-image.js');

    return {
      aiImage: {
        class: AiImageTool,
        config: {
          endpoint: '/api/features/ai/image',
          size: normalizeOpenAiImageSize(settings['features.ai.imageSize'] || '1024x1024'),
          aspectRatio: settings['features.ai.imageAspectRatio'] || '1:1',
          resolution: settings['features.ai.imageResolution'] || '1K',
          showSize: provider !== 'gemini',
          showAspectRatio: provider === 'gemini',
          showResolution: provider === 'gemini',
          readOnly: !allowToolbox
        },
        toolbox: allowToolbox ? undefined : false
      }
    };
  } catch (error) {
    console.warn('Failed to load AI editor tools', error);
    return {};
  }
};
