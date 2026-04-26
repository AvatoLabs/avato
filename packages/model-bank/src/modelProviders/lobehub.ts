import type { ModelProviderCard } from '@/types/llm';

const OFFICIAL_URL = process.env.NEXT_PUBLIC_OFFICIAL_URL || 'https://avato.turingmesh.com';

const LobeHub: ModelProviderCard = {
  chatModels: [],
  description:
    'Avato Cloud uses official APIs to access AI models and measures usage with Credits tied to model tokens.',
  enabled: true,
  id: 'lobehub',
  modelsUrl: `${OFFICIAL_URL}/zh/docs/usage/subscription/model-pricing`,
  name: 'Avato Cloud',
  settings: {
    modelEditable: false,
    showAddNewModel: false,
    showModelFetcher: false,
  },
  showConfig: false,
  url: OFFICIAL_URL,
};

export default LobeHub;

export const planCardModels = [
  'claude-sonnet-4-6',
  'gemini-3.1-pro-preview',
  'gpt-5.4',
  'deepseek-chat',
];
