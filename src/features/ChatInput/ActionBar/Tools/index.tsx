import { memo, Suspense, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CHAT_INPUT_ACTION_ICONS } from '@/config/entryIcons';
import { createSkillStoreModal } from '@/features/SkillStore';
import { useModelSupportToolUse } from '@/hooks/useModelSupportToolUse';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';

import { useAgentId } from '../../hooks/useAgentId';
import Action from '../components/Action';
import PopoverContent from './PopoverContent';
import { useControls } from './useControls';

const Tools = memo(() => {
  const { t } = useTranslation('setting');
  const [updating, setUpdating] = useState(false);
  const { marketItems } = useControls({
    setUpdating,
  });

  const agentId = useAgentId();
  const model = useAgentStore((s) => agentByIdSelectors.getAgentModelById(agentId)(s));
  const provider = useAgentStore((s) => agentByIdSelectors.getAgentModelProviderById(agentId)(s));

  const enableFC = useModelSupportToolUse(model, provider);

  const handleOpenStore = useCallback(() => {
    createSkillStoreModal();
  }, []);

  if (!enableFC)
    return (
      <Action
        disabled
        icon={CHAT_INPUT_ACTION_ICONS.tools}
        showTooltip={true}
        title={t('tools.disabled')}
      />
    );

  return (
    <Suspense
      fallback={<Action disabled icon={CHAT_INPUT_ACTION_ICONS.tools} title={t('tools.title')} />}
    >
      <Action
        icon={CHAT_INPUT_ACTION_ICONS.tools}
        loading={updating}
        showTooltip={false}
        title={t('tools.title')}
        popover={{
          content: <PopoverContent items={marketItems} onOpenStore={handleOpenStore} />,
          maxWidth: 320,
          minWidth: 320,
          styles: {
            content: {
              padding: 0,
            },
          },
        }}
      />
    </Suspense>
  );
});

export default Tools;
