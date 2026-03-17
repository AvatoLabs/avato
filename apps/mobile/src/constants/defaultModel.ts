/**
 * Default model constants — aligned with Web (packages/const).
 * Used when user has no default and server default is unavailable.
 */
export const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
export const DEFAULT_PROVIDER = 'anthropic';

export const DEFAULT_AGENT_CONFIG = {
  model: DEFAULT_MODEL,
  provider: DEFAULT_PROVIDER,
} as const;
