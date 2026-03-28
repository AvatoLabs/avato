'use client';

import { EDITOR_DEBOUNCE_TIME } from '@lobechat/const';
import { Flexbox, Icon, Input, Skeleton, Tooltip } from '@lobehub/ui';
import { useDebounceFn } from 'ahooks';
import { message } from 'antd';
import { useTheme } from 'antd-style';
import isEqual from 'fast-deep-equal';
import { PaletteIcon, Type } from 'lucide-react';
import { memo, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import EmojiPicker from '@/components/EmojiPicker';
import BackgroundSwatches from '@/features/AgentSetting/AgentMeta/BackgroundSwatches';
import { agentSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { useFileStore } from '@/store/file';
import { useGlobalStore } from '@/store/global';
import { globalGeneralSelectors } from '@/store/global/selectors';

const MAX_AVATAR_SIZE = 1024 * 1024; // 1MB limit for server actions

const IdentityCard = memo(() => {
    const { t } = useTranslation(['setting', 'common']);
    const theme = useTheme();
    const locale = useGlobalStore(globalGeneralSelectors.currentLanguage);

    // Get current meta from store
    const meta = useAgentStore(agentSelectors.currentAgentMeta, isEqual);
    const updateMeta = useAgentStore((s) => s.updateAgentMeta);

    // File upload
    const uploadWithProgress = useFileStore((s) => s.uploadWithProgress);
    const [uploading, setUploading] = useState(false);

    // Local state for inputs (to avoid stuttering during typing)
    const [localTitle, setLocalTitle] = useState(meta.title || '');
    const [localDescription, setLocalDescription] = useState(meta.description || '');

    // Sync local state when meta changes from external source
    useEffect(() => {
        setLocalTitle(meta.title || '');
        setLocalDescription(meta.description || '');
    }, [meta.title, meta.description]);

    // Debounced save for title
    const { run: debouncedSaveTitle } = useDebounceFn(
        (value: string) => {
            updateMeta({ title: value });
        },
        { wait: EDITOR_DEBOUNCE_TIME },
    );

    // Debounced save for description
    const { run: debouncedSaveDescription } = useDebounceFn(
        (value: string) => {
            updateMeta({ description: value });
        },
        { wait: EDITOR_DEBOUNCE_TIME },
    );

    // Handle avatar change (immediate save)
    const handleAvatarChange = (emoji: string) => {
        updateMeta({ avatar: emoji });
    };

    // Handle avatar upload
    const handleAvatarUpload = useCallback(
        async (file: File) => {
            if (file.size > MAX_AVATAR_SIZE) {
                message.error(t('settingAgent.avatar.sizeExceeded', { ns: 'setting' }));
                return;
            }

            setUploading(true);
            try {
                const result = await uploadWithProgress({ file });
                if (result?.url) {
                    updateMeta({ avatar: result.url });
                }
            } finally {
                setUploading(false);
            }
        },
        [uploadWithProgress, updateMeta, t],
    );

    // Handle avatar delete
    const handleAvatarDelete = useCallback(() => {
        updateMeta({ avatar: undefined });
    }, [updateMeta]);

    // Handle background color change (immediate save)
    const handleBackgroundColorChange = (color?: string) => {
        if (color !== undefined) {
            updateMeta({ backgroundColor: color });
        }
    };

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
                {/* Avatar Section - Left */}
                <Flexbox align={'center'} gap={12}>
                    <EmojiPicker
                        allowUpload
                        allowDelete={!!meta.avatar}
                        loading={uploading}
                        locale={locale}
                        shape={'square'}
                        size={120}
                        value={meta.avatar}
                        background={
                            meta.backgroundColor && meta.backgroundColor !== 'rgba(0,0,0,0)'
                                ? meta.backgroundColor
                                : undefined
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
                                                value={meta.backgroundColor}
                                                onChange={handleBackgroundColorChange}
                                            />
                                        </Suspense>
                                    </Flexbox>
                                ),
                                value: 'background',
                            },
                        ]}
                        popupProps={{
                            placement: 'bottomLeft',
                        }}
                        onChange={handleAvatarChange}
                        onDelete={handleAvatarDelete}
                        onUpload={handleAvatarUpload}
                    />
                </Flexbox>

                {/* Info Section - Right */}
                <Flexbox flex={1} gap={16} style={{ minWidth: 0 }}>
                    {/* Title Input */}
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

                    {/* Description Input */}
                    <Flexbox gap={8}>
                        <Flexbox horizontal align={'center'} gap={8}>
                            <Icon
                                icon={Type}
                                size={{ size: 16 }}
                                style={{ color: theme.colorTextSecondary }}
                            />
                            <span style={{ fontSize: 12, color: theme.colorTextSecondary }}>
                                {t('settingAgent.description.title', { ns: 'setting' })}
                            </span>
                        </Flexbox>
                        <Input
                            as={'textarea'}
                            rows={2}
                            placeholder={t('settingAgent.description.placeholder', { ns: 'setting' })}
                            value={localDescription}
                            variant={'borderless'}
                            style={{
                                fontSize: 14,
                                padding: 0,
                                width: '100%',
                                color: theme.colorTextSecondary,
                                resize: 'none',
                                minHeight: 60,
                            }}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                setLocalDescription(e.target.value);
                                debouncedSaveDescription(e.target.value);
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
