'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { Collapse } from 'antd';
import { useTheme } from 'antd-style';
import isEqual from 'fast-deep-equal';
import {
  BrainIcon,
  ChevronRightIcon,
  LibraryBig,
  PuzzleIcon,
  Settings2Icon,
  SparklesIcon,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import ModelSelect from '@/features/ModelSelect';
import { useOpenChatSettings } from '@/hooks/useInterceptingRoutes';
import { agentSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { ChatSettingsTabs } from '@/store/global/initialState';

import AgentSourcesInline from '../ProfileEditor/AgentSourcesInline';
import AgentTool from '../ProfileEditor/AgentTool';

const CapabilityCard = memo(() => {
  const { t } = useTranslation('setting');
  const theme = useTheme();
  const [config] = useAgentStore((s) => [agentSelectors.currentAgentConfig(s)], isEqual);
  const updateConfig = useAgentStore((s) => s.updateAgentConfig);
  const openAdvancedSettings = useOpenChatSettings(ChatSettingsTabs.Modal);

  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  const modelDisplay = useMemo(() => {
    if (!config.model || !config.provider) return null;
    return `${config.provider} / ${config.model}`;
  }, [config.model, config.provider]);

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
                <span
                  style={{
                    fontSize: 12,
                    color: theme.colorTextSecondary,
                  }}
                >
                  {modelDisplay}
                </span>
              )}
            </Flexbox>
          </Flexbox>
        ),
        children: (
          <Flexbox gap={16} padding={'12px 0'}>
            <ModelSelect
              initialWidth
              popupWidth={400}
              value={{
                model: config.model,
                provider: config.provider,
              }}
              onChange={updateConfig}
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
              <span
                style={{
                  fontSize: 12,
                  color: theme.colorTextSecondary,
                }}
              >
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
      {
        key: 'sources',
        label: (
          <Flexbox horizontal align={'center'} gap={12}>
            <Icon icon={LibraryBig} size={{ size: 18 }} />
            <Flexbox flex={1}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                {t('settingAgent.sources.title')}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: theme.colorTextSecondary,
                }}
              >
                {t('settingAgent.sources.desc')}
              </span>
            </Flexbox>
          </Flexbox>
        ),
        children: (
          <Flexbox padding={'12px 0'}>
            <AgentSourcesInline />
          </Flexbox>
        ),
      },
    ],
    [t, theme, config.model, config.provider, modelDisplay, updateConfig],
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
      {/* Header */}
      <Flexbox
        horizontal
        align={'center'}
        justify={'space-between'}
        padding={'16px 24px'}
        style={{
          borderBottom: `1px solid ${theme.colorBorderSecondary}`,
        }}
      >
        <Flexbox horizontal align={'center'} gap={12}>
          <Icon icon={SparklesIcon} size={{ size: 20 }} style={{ color: theme.colorPrimary }} />
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: theme.colorText,
            }}
          >
            {t('settingAgent.capability.title')}
          </span>
        </Flexbox>
        <Flexbox
          horizontal
          align={'center'}
          gap={4}
          style={{
            cursor: 'pointer',
            color: theme.colorTextSecondary,
            fontSize: 13,
          }}
          onClick={openAdvancedSettings}
        >
          <Icon icon={Settings2Icon} size={{ size: 14 }} />
          <span>{t('advancedSettings')}</span>
          <Icon icon={ChevronRightIcon} size={{ size: 14 }} />
        </Flexbox>
      </Flexbox>

      {/* Collapse Content */}
      <Collapse
        accordion
        activeKey={activeKeys}
        bordered={false}
        expandIconPosition={'end'}
        items={collapseItems}
        style={{
          background: 'transparent',
        }}
        onChange={(keys) => setActiveKeys(Array.isArray(keys) ? keys : [keys])}
      />
    </div>
  );
});

CapabilityCard.displayName = 'CapabilityCard';

export default CapabilityCard;
