'use client';

import { DEFAULT_AVATAR, EDITOR_DEBOUNCE_TIME } from '@lobechat/const';
import { Flexbox, Icon, Input, Skeleton, Tooltip } from '@lobehub/ui';
import { useDebounceFn } from 'ahooks';
import { useTheme } from 'antd-style';
import isEqual from 'fast-deep-equal';
import { PaletteIcon, Type } from 'lucide-react';
import { memo, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import EmojiPicker from '@/components/EmojiPicker';
import BackgroundSwatches from '@/features/AgentSetting/AgentMeta/BackgroundSwatches';
import SupervisorAvatar from '@/routes/(main)/group/features/GroupAvatar';
import { agentSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { useFileStore } from '@/store/file';
import { useGlobalStore } from '@/store/global';
import { globalGeneralSelectors } from '@/store/global/selectors';
import { useGroupProfileStore } from '@/store/groupProfile';

const MAX_AVATAR_SIZE = 1024 * 1024;

interface IdentityCardProps {
  readOnly?: boolean;
}

const IdentityCard = memo<IdentityCardProps>(({ readOnly }) => {
  const { t } = useTranslation(['setting', 'common', 'chat']);
  const theme = useTheme();
  const locale = useGlobalStore(globalGeneralSelectors.currentLanguage);

  const agentId = useGroupProfileStore((s) => s.activeTabId);
  const agentMeta = useAgentStore(agentSelectors.getAgentMetaById(agentId), isEqual);
  const optimisticUpdateAgentMeta = useAgentStore((s) => s.optimisticUpdateAgentMeta);

  const uploadWithProgress = useFileStore((s) => s.uploadWithProgress);
  const [uploading, setUploading] = useState(false);
  const [localTitle, setLocalTitle] = useState(agentMeta.title || '');

  useEffect(() => {
    setLocalTitle(agentMeta.title || '');
  }, [agentMeta.title]);

  const { run: debouncedSaveTitle } = useDebounceFn(
    (value: string) => {
      optimisticUpdateAgentMeta(agentId, { title: value });
    },
    { wait: EDITOR_DEBOUNCE_TIME },
  );

  const handleAvatarChange = (emoji: string) => {
    optimisticUpdateAgentMeta(agentId, { avatar: emoji });
  };

  const handleAvatarUpload = useCallback(
    async (file: File) => {
      if (file.size > MAX_AVATAR_SIZE) {
        return;
      }
      setUploading(true);
      try {
        const result = await uploadWithProgress({ file });
        if (result?.url) {
          optimisticUpdateAgentMeta(agentId, { avatar: result.url });
        }
      } finally {
        setUploading(false);
      }
    },
    [uploadWithProgress, optimisticUpdateAgentMeta, agentId],
  );

  const handleAvatarDelete = useCallback(() => {
    optimisticUpdateAgentMeta(agentId, { avatar: undefined });
  }, [optimisticUpdateAgentMeta, agentId]);

  const handleBackgroundColorChange = (color?: string) => {
    if (color !== undefined) {
      optimisticUpdateAgentMeta(agentId, { backgroundColor: color });
    }
  };

  if (readOnly) {
    return (
      <div
        style={{
          background: theme.colorBgContainer,
          borderRadius: theme.borderRadiusLG,
          marginBottom: 16,
          padding: 24,
          border: `1px solid ${theme.colorBorderSecondary}`,
        }}
      >
        <Flexbox
          gap={16}
          style={{ cursor: 'default' }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <div style={{ width: 120, height: 120 }}>
            <SupervisorAvatar size={120} />
          </div>
          <Flexbox
            style={{
              fontSize: 32,
              fontWeight: 600,
            }}
          >
            {t('group.profile.supervisor', { ns: 'chat' })}
          </Flexbox>
        </Flexbox>
      </div>
    );
  }

  return (
    <div
      style={{
        background: theme.colorBgContainer,
        borderRadius: theme.borderRadiusLG,
        marginBottom: 16,
        padding: 24,
        border: `1px solid ${theme.colorBorderSecondary}`,
      }}
    >
      <Flexbox
        horizontal
        gap={24}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <Flexbox align={'center'} gap={12}>
          <EmojiPicker
            allowUpload
            allowDelete={!!agentMeta.avatar}
            loading={uploading}
            locale={locale}
            shape={'square'}
            size={120}
            value={agentMeta.avatar}
            background={
              agentMeta.backgroundColor && agentMeta.backgroundColor !== 'rgba(0,0,0,0)'
                ? agentMeta.backgroundColor
                : undefined
            }
            customRender={
              agentMeta.avatar && agentMeta.avatar !== DEFAULT_AVATAR
                ? undefined
                : () => {
                  return (
                    <div style={{ width: 120, height: 120 }}>
                      <SupervisorAvatar size={120} />
                    </div>
                  );
                }
            }
            customTabs={[
              {
                label: (
                  <Tooltip title={t('settingAgent.backgroundColor.title', { ns: 'setting' })}>
                    <Icon icon={PaletteIcon} size={{ size: 20, strokeWidth: 2.5 }} />
                  </Tooltip>
                ),
                render: () => (
                  <Flexbox padding={8} width={332}>
                    <Suspense
                      fallback={
                        <Flexbox gap={8}>
                          <Skeleton.Button block style={{ height: 38 }} />
                          <Skeleton.Button block style={{ height: 38 }} />
                        </Flexbox>
                      }
                    >
                      <BackgroundSwatches
                        gap={8}
                        shape={'square'}
                        size={38}
                        value={agentMeta.backgroundColor}
                        onChange={handleBackgroundColorChange}
                      />
                    </Suspense>
                  </Flexbox>
                ),
                value: 'background',
              },
            ]}
            popupProps={{ placement: 'bottomLeft' }}
            onChange={handleAvatarChange}
            onDelete={handleAvatarDelete}
            onUpload={handleAvatarUpload}
          />
        </Flexbox>

        <Flexbox flex={1} gap={16} style={{ minWidth: 0 }}>
          <Flexbox gap={8}>
            <Flexbox horizontal align={'center'} gap={8}>
              <Icon icon={Type} size={{ size: 16 }} style={{ color: theme.colorTextSecondary }} />
              <span style={{ fontSize: 12, color: theme.colorTextSecondary }}>
                {t('settingAgent.name.title', { ns: 'setting' })}
              </span>
            </Flexbox>
            <Input
              placeholder={t('settingAgent.name.placeholder', { ns: 'setting' })}
              value={localTitle}
              variant={'borderless'}
              style={{
                fontSize: 32,
                fontWeight: 600,
                padding: 0,
                width: '100%',
                color: theme.colorText,
              }}
              onChange={(e) => {
                setLocalTitle(e.target.value);
                debouncedSaveTitle(e.target.value);
              }}
            />
          </Flexbox>
        </Flexbox>
      </Flexbox>
    </div>
  );
});

IdentityCard.displayName = 'IdentityCard';

export default IdentityCard;
