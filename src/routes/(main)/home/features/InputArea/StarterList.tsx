import { type ButtonProps } from '@lobehub/ui';
import { Button, Tooltip } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ACTION_ENTRY_ICONS, APP_ENTRY_ICONS } from '@/config/entryIcons';
import { useCreateMenuItems } from '@/routes/(main)/home/_layout/hooks/useCreateMenuItems';

const styles = createStaticStyles(({ css, cssVar }) => ({
  button: css`
    height: 36px;
    padding-inline: 13px;
    border-color: color-mix(
      in srgb,
      ${cssVar.colorBorderSecondary} 66%,
      ${cssVar.colorBorder} 34%
    ) !important;
    border-radius: 999px;

    font-size: 13px;
    font-weight: 600;
    color: color-mix(in srgb, ${cssVar.colorTextSecondary} 88%, ${cssVar.colorText} 12%);
    letter-spacing: 0.01em;

    background: color-mix(
      in srgb,
      ${cssVar.colorBgContainer} 96%,
      ${cssVar.colorFillTertiary} 4%
    ) !important;
    box-shadow: 0 12px 24px -22px color-mix(in srgb, ${cssVar.colorText} 55%, transparent) !important;

    transition:
      transform ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      border-color ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      background ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      color ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      box-shadow ${cssVar.motionDurationMid} ${cssVar.motionEaseOut};

    &:hover {
      transform: translateY(-1px);

      border-color: color-mix(
        in srgb,
        ${cssVar.colorPrimaryBorder} 28%,
        ${cssVar.colorBorderSecondary} 72%
      ) !important;

      color: ${cssVar.colorText} !important;

      background: color-mix(
        in srgb,
        ${cssVar.colorPrimaryBg} 8%,
        ${cssVar.colorBgContainer} 92%
      ) !important;
      box-shadow: 0 18px 30px -24px color-mix(in srgb, ${cssVar.colorText} 62%, transparent) !important;
    }

    &:active {
      transform: translateY(0) scale(0.985);
    }
  `,
  root: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  `,
}));

type StarterKey = 'agent' | 'group' | 'image' | 'write';

interface StarterItem {
  action: () => Promise<void> | void;
  disabled?: boolean;
  icon?: ButtonProps['icon'];
  key: StarterKey;
  titleKey: 'starter.createAgent' | 'starter.createGroup' | 'starter.image' | 'starter.write';
}

const StarterList = memo(() => {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const { createAgent, createEmptyGroup, createPage } = useCreateMenuItems();
  const [pendingKey, setPendingKey] = useState<StarterKey | null>(null);

  const items: StarterItem[] = useMemo(
    () => [
      {
        action: createAgent,
        icon: ACTION_ENTRY_ICONS.createAgent,
        key: 'agent',
        titleKey: 'starter.createAgent',
      },
      {
        action: createEmptyGroup,
        icon: ACTION_ENTRY_ICONS.createGroup,
        key: 'group',
        titleKey: 'starter.createGroup',
      },
      {
        action: createPage,
        icon: ACTION_ENTRY_ICONS.write,
        key: 'write',
        titleKey: 'starter.write',
      },
      {
        action: () => navigate('/image?model=gemini-3.1-flash-image-preview:image'),
        icon: APP_ENTRY_ICONS.image,
        key: 'image',
        titleKey: 'starter.image',
      },
    ],
    [createAgent, createEmptyGroup, createPage, navigate],
  );

  return (
    <div className={styles.root}>
      {items.map((item) => {
        const button = (
          <Button
            className={styles.button}
            disabled={item.disabled || pendingKey !== null}
            icon={item.icon}
            key={item.key}
            loading={pendingKey === item.key}
            shape={'round'}
            variant={'outlined'}
            iconProps={{
              color: cssVar.colorTextDescription,
              size: { size: 16, strokeWidth: 2 },
            }}
            onClick={async () => {
              try {
                setPendingKey(item.key);
                await item.action();
              } finally {
                setPendingKey(null);
              }
            }}
          >
            {t(item.titleKey)}
          </Button>
        );

        if (!item.disabled) return button;

        return (
          <Tooltip key={item.key} title={t('starter.developing')}>
            {button}
          </Tooltip>
        );
      })}
    </div>
  );
});

StarterList.displayName = 'StarterList';

export default StarterList;
