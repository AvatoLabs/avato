'use client';

import { Button, Dropdown, Flexbox, Icon } from '@lobehub/ui';
import { App } from 'antd';
import { useTheme } from 'antd-style';
import {
  Clock,
  CopyIcon,
  DownloadIcon,
  MoreHorizontalIcon,
  PlayIcon,
  TrashIcon,
} from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import urlJoin from 'url-join';

import { useQueryRoute } from '@/hooks/useQueryRoute';
import { agentSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { useChatStore } from '@/store/chat';
import { useHomeStore } from '@/store/home/store';
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';

const ActionBar = memo(() => {
  const { t } = useTranslation(['setting', 'common']);
  const { message } = App.useApp();
  const theme = useTheme();
  const router = useQueryRoute();
  const agentId = useAgentStore((s) => s.activeAgentId);
  const agent = useAgentStore((s) => (s.activeAgentId ? s.agentMap[s.activeAgentId] : undefined));
  const agentTitle = useAgentStore(agentSelectors.currentAgentTitle);
  const switchTopic = useChatStore((s) => s.switchTopic);
  const enableBusinessFeatures = useServerConfigStore(serverConfigSelectors.enableBusinessFeatures);
  const [duplicateAgent, removeAgent] = useHomeStore((s) => [s.duplicateAgent, s.removeAgent]);

  const handleStartChat = useCallback(() => {
    if (!agentId) return;
    switchTopic(null, { skipRefreshMessage: true });
    router.push(urlJoin('/agent', agentId));
  }, [agentId, router, switchTopic]);

  const handleCreateCronJob = useCallback(() => {
    if (!agentId) return;
    router.push(urlJoin('/agent', agentId, 'cron', 'new'));
  }, [agentId, router]);

  const handleDuplicate = useCallback(async () => {
    if (!agentId) return;
    try {
      await duplicateAgent(agentId);
      message.success(t('myAgents.actions.duplicateSuccess'));
    } catch (error) {
      console.error('Failed to duplicate agent:', error);
      message.error(t('myAgents.errors.duplicateFailed'));
    }
  }, [agentId, duplicateAgent, message, t]);

  const handleDelete = useCallback(async () => {
    if (!agentId) return;
    try {
      await removeAgent(agentId);
      message.success(t('myAgents.actions.deleteSuccess'));
      router.push('/');
    } catch (error) {
      console.error('Failed to delete agent:', error);
      message.error(t('myAgents.errors.deleteFailed'));
    }
  }, [agentId, removeAgent, router, message, t]);

  const handleExport = useCallback(() => {
    if (!agent) return;

    const dataStr = JSON.stringify(agent, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${agentTitle || 'agent'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [agent, agentTitle]);

  const moreMenuItems = [
    {
      icon: <Icon icon={CopyIcon} size={{ size: 16 }} />,
      key: 'duplicate',
      label: t('duplicate', { ns: 'common' }),
      onClick: handleDuplicate,
    },
    {
      icon: <Icon icon={DownloadIcon} size={{ size: 16 }} />,
      key: 'export',
      label: t('export', { ns: 'common' }),
      onClick: handleExport,
    },
    {
      type: 'divider' as const,
    },
    {
      danger: true,
      icon: <Icon icon={TrashIcon} size={{ size: 16 }} />,
      key: 'delete',
      label: t('delete', { ns: 'common' }),
      onClick: handleDelete,
    },
  ];

  return (
    <Flexbox
      horizontal
      align={'center'}
      justify={'space-between'}
      padding={'16px 24px'}
      style={{
        background: theme.colorBgContainer,
        border: `1px solid ${theme.colorBorderSecondary}`,
        borderRadius: theme.borderRadiusLG,
      }}
    >
      <Flexbox horizontal align={'center'} gap={12}>
        <Button icon={PlayIcon} size={'large'} type={'primary'} onClick={handleStartChat}>
          {t('startConversation', { ns: 'setting' })}
        </Button>
      </Flexbox>

      <Flexbox horizontal align={'center'} gap={8}>
        {enableBusinessFeatures && (
          <Button icon={Clock} size={'large'} onClick={handleCreateCronJob}>
            {t('agentCronJobs.addJob', { ns: 'setting' })}
          </Button>
        )}
        <Dropdown
          menu={{
            items: moreMenuItems,
          }}
          placement={'topRight'}
        >
          <Button icon={MoreHorizontalIcon} size={'large'} type={'text'} />
        </Dropdown>
      </Flexbox>
    </Flexbox>
  );
});

ActionBar.displayName = 'ActionBar';

export default ActionBar;
