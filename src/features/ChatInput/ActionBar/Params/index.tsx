import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CHAT_INPUT_ACTION_ICONS } from '@/config/entryIcons';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';

import { useAgentId } from '../../hooks/useAgentId';
import Action from '../components/Action';
import Controls from './Controls';

const Params = memo(() => {
  const agentId = useAgentId();
  const [isLoading] = useAgentStore((s) => [
    agentByIdSelectors.isAgentConfigLoadingById(agentId)(s),
  ]);
  const [updating, setUpdating] = useState(false);
  const { t } = useTranslation('setting');

  if (isLoading) return <Action disabled icon={CHAT_INPUT_ACTION_ICONS.params} />;

  return (
    <Action
      icon={CHAT_INPUT_ACTION_ICONS.params}
      loading={updating}
      showTooltip={false}
      title={t('settingModel.params.title')}
      popover={{
        content: <Controls setUpdating={setUpdating} updating={updating} />,
      }}
    />
  );
});

export default Params;
