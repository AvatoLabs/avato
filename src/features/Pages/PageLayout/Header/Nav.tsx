'use client';

import { Flexbox } from '@lobehub/ui';
import { FileText, SearchIcon, Table2 } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { type NavItemProps } from '@/features/NavPanel/components/NavItem';
import NavItem from '@/features/NavPanel/components/NavItem';
import { usePageKind } from '@/features/Pages/usePageKind';
import { usePageSpaceId } from '@/features/Pages/usePageSpaceId';
import { useGlobalStore } from '@/store/global';
import { getPageRootPath, TABLE_PAGE_KIND } from '@/utils/docs';
import { isModifierClick } from '@/utils/navigation';

interface Item {
  icon: NavItemProps['icon'];
  key: 'doc' | 'search' | 'table';
  onClick?: () => void;
  title: NavItemProps['title'];
  url?: string;
}

const Nav = memo(() => {
  const pageKind = usePageKind();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const toggleCommandMenu = useGlobalStore((s) => s.toggleCommandMenu);
  const pageSpaceId = usePageSpaceId();

  const items: Item[] = useMemo(
    () => [
      {
        icon: SearchIcon,
        key: 'search',
        onClick: () => toggleCommandMenu(true),
        title: t('tab.search'),
      },
      {
        icon: FileText,
        key: 'doc',
        title: t('tab.pages'),
        url: getPageRootPath(undefined, pageSpaceId),
      },
      {
        icon: Table2,
        key: 'table',
        title: t('tab.table'),
        url: getPageRootPath(TABLE_PAGE_KIND, pageSpaceId),
      },
    ],
    [pageSpaceId, t, toggleCommandMenu],
  );

  return (
    <Flexbox gap={1} paddingInline={4}>
      {items.map((item) => {
        const content = (
          <NavItem
            active={pageKind === item.key}
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
              item.onClick?.();
              navigate(`${item.url!}${location.search}`);
            }}
          >
            <NavItem active={pageKind === item.key} icon={item.icon} title={item.title} />
          </Link>
        );
      })}
    </Flexbox>
  );
});

Nav.displayName = 'PageLayoutHeaderNav';

export default Nav;
