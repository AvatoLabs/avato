import { DEFAULT_PROVIDER } from '@lobechat/business-const';
import { DEFAULT_MODEL } from '@lobechat/const';

interface ModelProviderConfig {
  model?: string | null;
  provider?: string | null;
}

export const isCompleteModelProviderConfig = (
  config?: ModelProviderConfig | null,
): config is Required<ModelProviderConfig> => !!config?.model && !!config?.provider;

export const isLegacyPageAgentModelConfig = (config?: ModelProviderConfig | null) =>
  config?.model === DEFAULT_MODEL && config?.provider === DEFAULT_PROVIDER;

export const resolveModelProviderWithFallback = (
  preferred?: ModelProviderConfig | null,
  fallback?: ModelProviderConfig | null,
): ModelProviderConfig => {
  if (isCompleteModelProviderConfig(preferred)) {
    return { model: preferred.model, provider: preferred.provider };
  }

  if (isCompleteModelProviderConfig(fallback)) {
    return { model: fallback.model, provider: fallback.provider };
  }

  return {};
};

export const shouldSyncPageAgentToUserDefault = (
  pageAgentConfig?: ModelProviderConfig | null,
  userDefaultConfig?: ModelProviderConfig | null,
) => {
  if (!isCompleteModelProviderConfig(userDefaultConfig)) return false;
  if (!isCompleteModelProviderConfig(pageAgentConfig)) return true;

  if (
    pageAgentConfig.model === userDefaultConfig.model &&
    pageAgentConfig.provider === userDefaultConfig.provider
  ) {
    return false;
  }

  return isLegacyPageAgentModelConfig(pageAgentConfig);
};
