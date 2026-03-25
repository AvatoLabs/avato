import { agentSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';

export const useModelAndProvider = (modelProp?: string, providerProp?: string) => {
  const [storeModel, storeProvider] = useAgentStore((s) => [
    agentSelectors.currentAgentModel(s),
    agentSelectors.currentAgentModelProvider(s),
  ]);

  const model = modelProp ?? storeModel;
  const provider = providerProp ?? storeProvider;

  return { model, provider };
};
