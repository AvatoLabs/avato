import { type ReactNode } from 'react';
import { memo } from 'react';

import { agentSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { ChatSettingsTabs } from '@/store/global/initialState';

import AgentChat from './AgentChat';
import AgentMeta from './AgentMeta';
import AgentModal from './AgentModal';
import AgentOpening from './AgentOpening';
import AgentSources from './AgentSources';

export interface AgentSettingsContentProps {
  loadingSkeleton: ReactNode;
  tab: ChatSettingsTabs;
}

const AgentSettingsContent = memo<AgentSettingsContentProps>(({ tab, loadingSkeleton }) => {
  const loading = useAgentStore(agentSelectors.isAgentConfigLoading);

  if (loading) return loadingSkeleton;

  return (
    <>
      {tab === ChatSettingsTabs.Meta && <AgentMeta />}
      {tab === ChatSettingsTabs.Opening && <AgentOpening />}
      {tab === ChatSettingsTabs.Sources && <AgentSources />}
      {tab === ChatSettingsTabs.Chat && <AgentChat />}
      {tab === ChatSettingsTabs.Modal && <AgentModal />}
    </>
  );
});

export default AgentSettingsContent;
