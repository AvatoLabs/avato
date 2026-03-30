'use client';

import { Flexbox, Tag } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { APP_ENTRY_ICONS } from '@/config/entryIcons';
import { type NavItemProps } from '@/features/NavPanel/components/NavItem';
import NavItem from '@/features/NavPanel/components/NavItem';
import { glassSidebarStyles } from '@/features/NavPanel/glassSidebar.styles';
import { useActiveTabKey } from '@/hooks/useActiveTabKey';
import { useGlobalStore } from '@/store/global';
import { SidebarTabKey } from '@/store/global/initialState';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';
import { isModifierClick } from '@/utils/navigation';

interface Item {
  badge?: 'beta' | 'new';
  hidden?: boolean | undefined;
  icon: NavItemProps['icon'];
  key: string;
  onClick?: () => void;
  sectionBreak?: boolean;
  title: NavItemProps['title'];
  url?: string;
}

const Nav = memo(() => {
  const tab = useActiveTabKey();
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const { t: tHome } = useTranslation('home');
  const { t: tSetting } = useTranslation('setting');
  const toggleCommandMenu = useGlobalStore((s) => s.toggleCommandMenu);
  const { showMarket, showAiImage } = useServerConfigStore(featureFlagsSelectors);

  const globalActions: Item[] = useMemo(
    () => [
      {
        icon: APP_ENTRY_ICONS.search,
        key: 'search',
        onClick: () => {
          toggleCommandMenu(true);
        },
        title: t('tab.search'),
      },
    ],
    [t, toggleCommandMenu],
  );

  const mainNav: Item[] = useMemo(
    () => [
      {
        icon: APP_ENTRY_ICONS.home,
        key: SidebarTabKey.Home,
        title: t('tab.home'),
        url: '/',
      },
      {
        icon: APP_ENTRY_ICONS.page,
        key: 'docs',
        title: t('tab.pages'),
        url: '/docs',
      },
      {
        badge: 'beta',
        icon: APP_ENTRY_ICONS.studio,
        key: SidebarTabKey.Studio,
        sectionBreak: true,
        title: t('tab.avatoStudio'),
        url: '/studio',
      },
      {
        icon: APP_ENTRY_ICONS.resource,
        key: 'content',
        title: t('tab.resource'),
        url: '/content',
      },
      {
        icon: APP_ENTRY_ICONS.memory,
        key: SidebarTabKey.Memory,
        title: t('tab.memory'),
        url: '/memory',
      },
      {
        /** 服务端已有视频生成能力（lambda/video）；入口常驻侧栏，不依赖 enableBusinessFeatures */
        icon: APP_ENTRY_ICONS.video,
        key: SidebarTabKey.Video,
        title: t('tab.video'),
        url: '/video',
      },
      {
        hidden: !showAiImage,
        icon: APP_ENTRY_ICONS.image,
        key: SidebarTabKey.Image,
        title: t('tab.aiImage'),
        url: '/image',
      },
      {
        hidden: !showMarket,
        icon: APP_ENTRY_ICONS.community,
        key: SidebarTabKey.Community,
        sectionBreak: true,
        title: t('tab.community'),
        url: '/community',
      },
    ],
    [showAiImage, showMarket, t],
  );

  const newBadge = (
    <Tag color="blue" size="small">
      {t('new')}
    </Tag>
  );
  const betaBadge = (
    <Tag
      color={cssVar.colorPrimary}
      size="small"
      style={{ marginInlineStart: 4 }}
      variant="outlined"
    >
      {tSetting('tab.beta')}
    </Tag>
  );

  const renderItem = (item: Item) => {
    const extra = item.badge === 'new' ? newBadge : item.badge === 'beta' ? betaBadge : undefined;
    const mt = item.sectionBreak ? 10 : undefined;
    const content = (
      <NavItem
        active={tab === item.key}
        extra={extra}
        hidden={item.hidden}
        icon={item.icon}
        key={item.key}
        style={{ marginTop: mt }}
        title={item.title}
        onClick={item.onClick}
      />
    );
    if (!item.url) return content;

    return (
      <NavItem
        active={tab === item.key}
        extra={extra}
        hidden={item.hidden}
        href={item.url}
        icon={item.icon}
        key={item.key}
        style={{ marginTop: mt }}
        title={item.title}
        onClick={(e) => {
          if (isModifierClick(e)) return;
          item?.onClick?.();
          navigate(item.url);
        }}
      />
    );
  };

  return (
    <Flexbox gap={2} paddingBlock={'4px 0'} paddingInline={6}>
      {globalActions.map(renderItem)}
      <span className={glassSidebarStyles.sectionLabel}>
        {tHome('workspace.sidebar.section.navigation')}
      </span>
      {mainNav.map(renderItem)}
    </Flexbox>
  );
});

export default Nav;
