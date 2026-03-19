export const ICON_CDN_BASE =
  'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files';

export const getProviderIconUrl = (providerId: string, theme: 'light' | 'dark' = 'light') =>
  `${ICON_CDN_BASE}/${theme}/${providerId}.png`;

/** Infer provider ID from model ID when modelToProvider has no mapping (e.g. models not yet loaded). */
export const inferProviderFromModelId = (modelId: string): string | undefined => {
  const lower = modelId.toLowerCase();
  if (lower.startsWith('gpt') || lower.startsWith('o1-') || lower.startsWith('o3')) return 'openai';
  if (lower.includes('claude')) return 'anthropic';
  if (lower.includes('gemini')) return 'google';
  if (lower.includes('deepseek')) return 'deepseek';
  if (lower.includes('qwen')) return 'alibaba';
  if (lower.includes('minimax')) return 'minimax';
  if (lower.includes('doubao') || lower.includes('glow')) return 'doubao';
  if (lower.includes('moonshot')) return 'moonshot';
  if (lower.includes('step')) return 'step';
  if (lower.includes('llama')) return 'meta';
  if (lower.includes('mistral')) return 'mistral';
  if (lower.includes('cohere')) return 'cohere';
  if (lower.includes('groq')) return 'groq';
  return undefined;
};
