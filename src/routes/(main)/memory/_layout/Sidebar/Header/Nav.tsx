'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { BrainCircuitIcon, SearchIcon } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { type NavItemProps } from '@/features/NavPanel/components/NavItem';
import NavItem from '@/features/NavPanel/components/NavItem';
import { usePathname } from '@/libs/router/navigation';
import { useGlobalStore } from '@/store/global';
import { isModifierClick } from '@/utils/navigation';

interface Item {
  icon: NavItemProps['icon'];
  key: string;
  onClick?: () => void;
  title: NavItemProps['title'];
  url?: string;
}

enum MemoryTabKey {
  Home = 'home',
}

const styles = createStaticStyles(({ css, cssVar }) => ({
  sectionTitle: css`
    margin-block: 4px 2px;
    padding-inline: 8px;
    font-size: 12px;
    font-weight: 500;
    color: ${cssVar.colorTextDescription};
  `,
}));

const useActiveTabKey = () => {
  const pathname = usePathname();
  if (pathname === '/memory') return MemoryTabKey.Home;
  if (pathname.startsWith('/memory/')) return MemoryTabKey.Home;
  return MemoryTabKey.Home;
};

const Nav = memo(() => {
  const tab = useActiveTabKey();
  const navigate = useNavigate();
  const { t } = useTranslation('memory');
  const toggleCommandMenu = useGlobalStore((s) => s.toggleCommandMenu);

  const items: Item[] = useMemo(
    () => [
      {
        icon: SearchIcon,
        key: 'search',
        onClick: () => {
          toggleCommandMenu(true);
        },
        title: t('tab.search'),
      },
      {
        icon: BrainCircuitIcon,
        key: MemoryTabKey.Home,
        title: t('tab.home'),
        url: '/memory',
      },
    ],
    [t, toggleCommandMenu],
  );

  return (
    <Flexbox gap={1} paddingInline={4}>
      {items.map((item) => {
        if (item.key === MemoryTabKey.Home) {
          return (
            <Flexbox gap={1} key={'personal-section'}>
              <div className={styles.sectionTitle}>
                <Text fontSize={12} type={'secondary'} weight={500}>
                  {t('personalSectionTitle')}
                </Text>
              </div>
              <Link
                key={item.key}
                to={item.url!}
                onClick={(e) => {
                  if (isModifierClick(e)) return;
                  e.preventDefault();
                  item?.onClick?.();
                  navigate(item.url!);
                }}
              >
                <NavItem active={tab === item.key} icon={item.icon} title={item.title} />
              </Link>
            </Flexbox>
          );
        }

        const content = (
          <NavItem
            active={tab === item.key}
            icon={item.icon}
            key={item.key}
            title={item.title}
            onClick={item.onClick}
          />
        );
        if (!item.url) return content;

        return (
          <Link
            key={item.key}
            to={item.url}
            onClick={(e) => {
              if (isModifierClick(e)) return;
              e.preventDefault();
              item?.onClick?.();
              if (item.url) {
                navigate(item.url);
              }
            }}
          >
            <NavItem active={tab === item.key} icon={item.icon} title={item.title} />
          </Link>
        );
      })}
    </Flexbox>
  );
});

export default Nav;
