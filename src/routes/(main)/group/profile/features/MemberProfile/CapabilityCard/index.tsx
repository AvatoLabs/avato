'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { Collapse } from 'antd';
import { useTheme } from 'antd-style';
import isEqual from 'fast-deep-equal';
import { BrainIcon, PuzzleIcon, SparklesIcon } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import ModelSelect from '@/features/ModelSelect';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { useGroupProfileStore } from '@/store/groupProfile';

import AgentTool from '../AgentTool';

interface CapabilityCardProps {
    readOnly?: boolean;
}

const CapabilityCard = memo<CapabilityCardProps>(({ readOnly }) => {
    const { t } = useTranslation('setting');
    const theme = useTheme();
    const agentId = useGroupProfileStore((s) => s.activeTabId);
    const config = useAgentStore(agentByIdSelectors.getAgentConfigById(agentId), isEqual);
    const updateAgentConfigById = useAgentStore((s) => s.updateAgentConfigById);

    const [activeKeys, setActiveKeys] = useState<string[]>([]);

    const modelDisplay = useMemo(() => {
        if (!config?.model || !config?.provider) return null;
        return `${config.provider} / ${config.model}`;
    }, [config?.model, config?.provider]);

    const handleConfigChange = (newConfig: { model?: string; provider?: string }) => {
        if (!readOnly && agentId) {
            updateAgentConfigById(agentId, newConfig);
        }
    };

    const collapseItems = useMemo(
        () => [
            {
                key: 'model',
                label: (
                    <Flexbox horizontal align={'center'} gap={12}>
                        <Icon icon={BrainIcon} size={{ size: 18 }} />
                        <Flexbox flex={1}>
                            <span style={{ fontSize: 14, fontWeight: 500 }}>{t('settingAgent.model.title')}</span>
                            {modelDisplay && (
                                <span style={{ fontSize: 12, color: theme.colorTextSecondary }}>{modelDisplay}</span>
                            )}
                        </Flexbox>
                    </Flexbox>
                ),
                children: (
                    <Flexbox gap={16} padding={'12px 0'}>
                        <ModelSelect
                            initialWidth
                            value={{
                                model: config?.model,
                                provider: config?.provider,
                            }}
                            onChange={handleConfigChange}
                        />
                    </Flexbox>
                ),
            },
            {
                key: 'tools',
                label: (
                    <Flexbox horizontal align={'center'} gap={12}>
                        <Icon icon={PuzzleIcon} size={{ size: 18 }} />
                        <Flexbox flex={1}>
                            <span style={{ fontSize: 14, fontWeight: 500 }}>{t('settingAgent.tools.title')}</span>
                            <span style={{ fontSize: 12, color: theme.colorTextSecondary }}>
                                {t('settingAgent.tools.desc')}
                            </span>
                        </Flexbox>
                    </Flexbox>
                ),
                children: (
                    <Flexbox padding={'12px 0'}>
                        <AgentTool />
                    </Flexbox>
                ),
            },
        ],
        [t, theme, config?.model, config?.provider, modelDisplay, handleConfigChange],
    );

    return (
        <div
            style={{
                background: theme.colorBgContainer,
                borderRadius: theme.borderRadiusLG,
                marginBottom: 16,
                overflow: 'hidden',
                border: `1px solid ${theme.colorBorderSecondary}`,
            }}
        >
            <Flexbox
                horizontal
                align={'center'}
                padding={'16px 24px'}
                style={{ borderBottom: `1px solid ${theme.colorBorderSecondary}` }}
            >
                <Icon icon={SparklesIcon} size={{ size: 20 }} style={{ color: theme.colorPrimary }} />
                <span
                    style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: theme.colorText,
                        marginLeft: 12,
                    }}
                >
                    {t('settingAgent.capability.title')}
                </span>
            </Flexbox>

            <Collapse
                accordion
                activeKey={activeKeys}
                bordered={false}
                expandIconPosition={'end'}
                items={collapseItems}
                style={{ background: 'transparent' }}
                onChange={(keys) => setActiveKeys(Array.isArray(keys) ? keys : [keys])}
            />
        </div>
    );
});

CapabilityCard.displayName = 'CapabilityCard';

export default CapabilityCard;
