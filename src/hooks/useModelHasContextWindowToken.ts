import { agentSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { aiModelSelectors, useAiInfraStore } from '@/store/aiInfra';

export const useModelHasContextWindowToken = () => {
  const model = useAgentStore(agentSelectors.currentAgentModel);
  const provider = useAgentStore(agentSelectors.currentAgentModelProvider);

  return useAiInfraStore(aiModelSelectors.isModelHasContextWindowToken(model, provider));
};
