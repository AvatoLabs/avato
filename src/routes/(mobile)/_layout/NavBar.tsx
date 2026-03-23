'use client';

import { Icon } from '@lobehub/ui';
import { type TabBarProps } from '@lobehub/ui/mobile';
import { TabBar } from '@lobehub/ui/mobile';
import { createStaticStyles } from 'antd-style';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { APP_ENTRY_ICONS } from '@/config/entryIcons';
import { MOBILE_TABBAR_HEIGHT } from '@/const/layoutTokens';
import { useActiveTabKey } from '@/hooks/useActiveTabKey';
import { SidebarTabKey } from '@/store/global/initialState';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

const styles = createStaticStyles(({ css, cssVar }) => ({
  active: css`
    color: ${cssVar.colorPrimary};
  `,
  container: css`
    position: fixed;
    z-index: 100;
    inset-block-end: 0;
    inset-inline: 0;

    border-block-start: 1px solid
      color-mix(in srgb, ${cssVar.colorBorderSecondary} 72%, transparent);

    background: color-mix(in srgb, ${cssVar.colorBgContainer} 90%, transparent);
    backdrop-filter: saturate(1.2) blur(18px);
    box-shadow: 0 -6px 20px rgb(0 0 0 / 3%);
  `,
}));

const NavBar = memo(() => {
  const { t } = useTranslation('common');
  const activeKey = useActiveTabKey();
  const navigate = useNavigate();

  const { showMarket } = useServerConfigStore(featureFlagsSelectors);

  const items: TabBarProps['items'] = useMemo(
    () =>
      [
        {
          icon: (active: boolean) => (
            <Icon className={active ? styles.active : undefined} icon={APP_ENTRY_ICONS.chat} />
          ),
          key: SidebarTabKey.Chat,
          onClick: () => {
            navigate('/agent');
          },
          title: t('tab.chat'),
        },
        showMarket && {
          icon: (active: boolean) => (
            <Icon className={active ? styles.active : undefined} icon={APP_ENTRY_ICONS.community} />
          ),
          key: SidebarTabKey.Community,
          onClick: () => {
            navigate('/community');
          },
          title: t('tab.community'),
        },
        {
          icon: (active: boolean) => (
            <Icon className={active ? styles.active : undefined} icon={APP_ENTRY_ICONS.resource} />
          ),
          key: SidebarTabKey.Resource,
          onClick: () => {
            navigate('/resource');
          },
          title: t('tab.resource'),
        },
        {
          icon: (active: boolean) => (
            <Icon className={active ? styles.active : undefined} icon={APP_ENTRY_ICONS.me} />
          ),
          key: SidebarTabKey.Me,
          onClick: () => {
            navigate('/me');
          },
          title: t('tab.me'),
        },
      ].filter(Boolean) as TabBarProps['items'],
    [navigate, showMarket, t],
  );

  return (
    <TabBar
      safeArea
      activeKey={activeKey}
      className={styles.container}
      height={MOBILE_TABBAR_HEIGHT}
      items={items}
    />
  );
});

NavBar.displayName = 'NavBar';

export default NavBar;
