'use client';

import { Button, Flexbox } from '@lobehub/ui';
import { useTheme } from 'antd-style';
import { PlayIcon } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import urlJoin from 'url-join';

import { useQueryRoute } from '@/hooks/useQueryRoute';
import { useAgentGroupStore } from '@/store/agentGroup';
import { agentGroupSelectors } from '@/store/agentGroup/selectors';

const ActionBar = memo(() => {
    const { t } = useTranslation('setting');
    const theme = useTheme();
    const router = useQueryRoute();
    const groupId = useAgentGroupStore(agentGroupSelectors.activeGroupId);

    const handleStartChat = useCallback(() => {
        if (!groupId) return;
        router.push(urlJoin('/group', groupId));
    }, [groupId, router]);

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
            <Flexbox horizontal align={'center'} gap={12}>
                <Button icon={PlayIcon} size={'large'} type={'primary'} onClick={handleStartChat}>
                    {t('settingAgent.action.startConversation')}
                </Button>
            </Flexbox>
        </Flexbox>
    );
});

ActionBar.displayName = 'ActionBar';

export default ActionBar;
