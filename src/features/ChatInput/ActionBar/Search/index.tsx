import { cssVar } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { CHAT_INPUT_ACTION_ICONS } from '@/config/entryIcons';
import { useIsMobile } from '@/hooks/useIsMobile';
import { agentByIdSelectors, chatConfigByIdSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';

import { useAgentEnableSearch } from '../../hooks/useAgentEnableSearch';
import { useAgentId } from '../../hooks/useAgentId';
import { useUpdateAgentConfig } from '../../hooks/useUpdateAgentConfig';
import Action from '../components/Action';
import Controls from './Controls';

const Search = memo(() => {
  const { t } = useTranslation('chat');
  const agentId = useAgentId();
  const { updateAgentChatConfig } = useUpdateAgentConfig();
  const [isLoading, mode] = useAgentStore((s) => [
    agentByIdSelectors.isAgentConfigLoadingById(agentId)(s),
    chatConfigByIdSelectors.getSearchModeById(agentId)(s),
  ]);
  const isAgentEnableSearch = useAgentEnableSearch();
  const isMobile = useIsMobile();

  if (isLoading) return <Action disabled icon={CHAT_INPUT_ACTION_ICONS.worldOff} />;

  return (
    <Action
      color={isAgentEnableSearch ? cssVar.colorInfo : undefined}
      icon={isAgentEnableSearch ? CHAT_INPUT_ACTION_ICONS.world : CHAT_INPUT_ACTION_ICONS.worldOff}
      showTooltip={false}
      title={t('search.title')}
      popover={{
        content: <Controls />,
        maxWidth: 320,
        minWidth: 320,
        placement: 'topLeft',
        styles: {
          content: {
            padding: 4,
          },
        },
        trigger: isMobile ? 'click' : 'hover',
      }}
      onClick={
        isMobile
          ? undefined
          : async (e) => {
              e?.preventDefault?.();
              e?.stopPropagation?.();
              const next = mode === 'off' ? 'auto' : 'off';
              await updateAgentChatConfig({ searchMode: next });
            }
      }
    />
  );
});

Search.displayName = 'Search';

export default Search;
