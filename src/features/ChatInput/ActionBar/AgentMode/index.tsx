import { ActionIcon } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { ACTION_ENTRY_ICONS } from '@/config/entryIcons';
import { useAgentId } from '@/features/ChatInput/hooks/useAgentId';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';

const AgentModeToggle = memo(() => {
  const { t } = useTranslation('chat');
  const agentId = useAgentId();
  const [enableAgentMode, updateAgentConfigById] = useAgentStore((s) => [
    agentByIdSelectors.getAgentEnableModeById(agentId)(s),
    s.updateAgentConfigById,
  ]);

  const handleToggle = (checked: boolean) => {
    updateAgentConfigById(agentId, { enableAgentMode: checked });
  };

  return (
    <ActionIcon
      icon={ACTION_ENTRY_ICONS.createAgent}
      title={t('agentMode.title', { defaultValue: 'Agent Mode' })}
      style={{
        color: enableAgentMode ? 'var(--colorPrimary)' : undefined,
      }}
      onClick={() => {
        handleToggle(!enableAgentMode);
      }}
    />
  );
});

AgentModeToggle.displayName = 'AgentModeToggle';

export default AgentModeToggle;
