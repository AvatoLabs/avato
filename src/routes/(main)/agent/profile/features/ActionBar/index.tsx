'use client';

import { Button, Dropdown, Flexbox, Icon } from '@lobehub/ui';
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
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';

const ActionBar = memo(() => {
    const { t } = useTranslation(['setting', 'common']);
    const theme = useTheme();
    const router = useQueryRoute();
    const agentId = useAgentStore((s) => s.activeAgentId);
    const switchTopic = useChatStore((s) => s.switchTopic);
    const enableBusinessFeatures = useServerConfigStore(serverConfigSelectors.enableBusinessFeatures);
    const [deleteAgent, duplicateAgent] = useAgentStore((s) => [s.deleteAgent, s.duplicateAgent]);
    const agent = useAgentStore(agentSelectors.currentAgentItem);

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
        await duplicateAgent(agentId);
    }, [agentId, duplicateAgent]);

    const handleDelete = useCallback(async () => {
        if (!agentId) return;
        await deleteAgent(agentId);
        router.push('/');
    }, [agentId, deleteAgent, router]);

    const handleExport = useCallback(() => {
        if (!agent) return;
        const dataStr = JSON.stringify(agent, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${agent.meta?.title || 'agent'}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [agent]);

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
                borderRadius: theme.borderRadiusLG,
                border: `1px solid ${theme.colorBorderSecondary}`,
            }}
        >
            {/* Primary Actions */}
            <Flexbox horizontal align={'center'} gap={12}>
                <Button
                    icon={PlayIcon}
                    size={'large'}
                    type={'primary'}
                    onClick={handleStartChat}
                >
                    {t('settingAgent.action.startConversation')}
                </Button>
            </Flexbox>

            {/* Secondary Actions */}
            <Flexbox horizontal align={'center'} gap={8}>
                {enableBusinessFeatures && (
                    <Button
                        icon={Clock}
                        size={'large'}
                        onClick={handleCreateCronJob}
                    >
                        {t('agentCronJobs.addJob')}
                    </Button>
                )}
                <Dropdown
                    menu={{
                        items: moreMenuItems,
                    }}
                    placement={'topRight'}
                >
                    <Button
                        icon={MoreHorizontalIcon}
                        size={'large'}
                        type={'text'}
                    />
                </Dropdown>
            </Flexbox>
        </Flexbox>
    );
});

ActionBar.displayName = 'ActionBar';

export default ActionBar;
