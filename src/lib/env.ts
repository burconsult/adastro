const metaEnv: Record<string, string | undefined> = {
  AI_GATEWAY_API_KEY: import.meta.env.AI_GATEWAY_API_KEY,
  AI_GATEWAY_BASE_URL: import.meta.env.AI_GATEWAY_BASE_URL,
  OPENAI_API_KEY: import.meta.env.OPENAI_API_KEY,
  GOOGLE_GENAI_API_KEY: import.meta.env.GOOGLE_GENAI_API_KEY,
  ANTHROPIC_API_KEY: import.meta.env.ANTHROPIC_API_KEY,
  ELEVENLABS_API_KEY: import.meta.env.ELEVENLABS_API_KEY
};

export const getEnv = (key: string): string | undefined => {
  const fromMeta = metaEnv[key];
  if (typeof fromMeta === 'string' && fromMeta.length > 0) {
    return fromMeta;
  }

  const fromProcess = process.env[key];
  return typeof fromProcess === 'string' && fromProcess.length > 0 ? fromProcess : undefined;
};
