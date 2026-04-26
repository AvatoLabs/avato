'use client';

import { Block, Flexbox, Icon, type IconProps, Text } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import urlJoin from 'url-join';

import { ACTION_ENTRY_ICONS, APP_ENTRY_ICONS } from '@/config/entryIcons';
import { useQueryRoute } from '@/hooks/useQueryRoute';
import { usePathname } from '@/libs/router/navigation';
import { useActionSWR } from '@/libs/swr';
import { useChatStore } from '@/store/chat';
import { useGlobalStore } from '@/store/global';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';
import { useUserStore } from '@/store/user';
import { userGeneralSettingsSelectors } from '@/store/user/selectors';

const styles = createStaticStyles(({ css, cssVar }) => ({
  actionCard: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;

    margin-block-start: 6px;
    margin-inline: 8px;
    padding: 8px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorFillQuaternary};
  `,
  actionCardFullSpan: css`
    grid-column: 1 / -1;
  `,
  actionIcon: css`
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;

    width: 30px;
    height: 30px;
    border-radius: ${cssVar.borderRadius}px;

    color: var(--item-color);

    background: var(--item-icon-bg);
  `,
  actionItem: css`
    --item-border-color: transparent;
    --item-color: ${cssVar.colorTextSecondary};
    --item-icon-bg: ${cssVar.colorFillQuaternary};
    --item-surface: ${cssVar.colorBgContainer};

    min-width: 0;
    min-height: 70px;
    border: 1px solid var(--item-border-color);
    border-radius: ${cssVar.borderRadiusLG};

    color: var(--item-color);

    background: var(--item-surface);

    transition:
      background-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      border-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      transform ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &:hover {
      --item-border-color: color-mix(
        in srgb,
        ${cssVar.colorPrimary} 14%,
        ${cssVar.colorBorderSecondary}
      );
      --item-color: ${cssVar.colorText};
      --item-icon-bg: color-mix(in srgb, ${cssVar.colorPrimaryBg} 70%, ${cssVar.colorFillTertiary});
      --item-surface: color-mix(
        in srgb,
        ${cssVar.colorFillSecondary} 82%,
        ${cssVar.colorBgContainer}
      );

      transform: translateY(-1px);
    }

    &:active {
      transform: translateY(0);
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: 2px;
    }

    &[data-active='true'] {
      --item-border-color: color-mix(
        in srgb,
        ${cssVar.colorPrimary} 18%,
        ${cssVar.colorBorderSecondary}
      );
      --item-color: ${cssVar.colorText};
      --item-icon-bg: color-mix(in srgb, ${cssVar.colorPrimaryBg} 74%, ${cssVar.colorFillTertiary});
      --item-surface: color-mix(in srgb, ${cssVar.colorPrimaryBg} 38%, ${cssVar.colorBgContainer});
    }
  `,
  actionLabel: css`
    font-size: ${cssVar.fontSizeSM};
    font-weight: 500;
    line-height: 1.25;
    color: var(--item-color);
    white-space: normal;
  `,
}));

interface ActionItem {
  active?: boolean;
  hidden?: boolean;
  icon: IconProps['icon'];
  key: string;
  onClick: () => void;
  title: string;
}

const Nav = memo(() => {
  const { t } = useTranslation('chat');
  const { t: tTopic } = useTranslation('topic');
  const params = useParams();
  const agentId = params.aid;
  const pathname = usePathname();
  const isProfileActive = pathname.includes('/profile');
  const isIntegrationActive = pathname.includes('/channel');
  const router = useQueryRoute();
  const { isAgentEditable } = useServerConfigStore(featureFlagsSelectors);
  const toggleCommandMenu = useGlobalStore((s) => s.toggleCommandMenu);
  const isDevMode = useUserStore((s) => userGeneralSettingsSelectors.config(s).isDevMode);
  const hideProfile = !isAgentEditable;
  const switchTopic = useChatStore((s) => s.switchTopic);
  const [openNewTopicOrSaveTopic] = useChatStore((s) => [s.openNewTopicOrSaveTopic]);

  const { mutate } = useActionSWR('openNewTopicOrSaveTopic', openNewTopicOrSaveTopic);
  const handleNewTopic = () => {
    // If in agent sub-route, navigate back to agent chat first
    if (isProfileActive && agentId) {
      router.push(urlJoin('/agent', agentId));
    }
    mutate();
  };

  const actions: ActionItem[] = [
    {
      icon: ACTION_ENTRY_ICONS.newTopic,
      key: 'new-topic',
      onClick: handleNewTopic,
      title: tTopic('actions.addNewTopic'),
    },
    {
      active: isProfileActive,
      hidden: hideProfile,
      icon: ACTION_ENTRY_ICONS.profile,
      key: 'profile',
      onClick: () => {
        switchTopic(null, { skipRefreshMessage: true });
        router.push(urlJoin('/agent', agentId!, 'profile'));
      },
      title: t('tab.profile'),
    },
    {
      active: isIntegrationActive,
      hidden: hideProfile || !isDevMode,
      icon: ACTION_ENTRY_ICONS.integration,
      key: 'integration',
      onClick: () => {
        switchTopic(null, { skipRefreshMessage: true });
        router.push(urlJoin('/agent', agentId!, 'channel'));
      },
      title: t('tab.integration'),
    },
    {
      icon: APP_ENTRY_ICONS.search,
      key: 'search',
      onClick: () => {
        toggleCommandMenu(true);
      },
      title: t('tab.search'),
    },
  ].filter((item) => !item.hidden);

  return (
    <div className={styles.actionCard}>
      {actions.map((item, index) => {
        const isLastOddItem = actions.length % 2 === 1 && index === actions.length - 1;

        return (
          <Block
            clickable
            className={cx(styles.actionItem, isLastOddItem && styles.actionCardFullSpan)}
            data-active={item.active ? 'true' : undefined}
            key={item.key}
            padding={10}
            variant={'borderless'}
            onClick={item.onClick}
          >
            <Flexbox gap={10} justify={'space-between'} style={{ height: '100%' }}>
              <div className={styles.actionIcon}>
                <Icon color={'currentColor'} icon={item.icon} size={18} />
              </div>
              <Text className={styles.actionLabel}>{item.title}</Text>
            </Flexbox>
          </Block>
        );
      })}
    </div>
  );
});

export default Nav;
