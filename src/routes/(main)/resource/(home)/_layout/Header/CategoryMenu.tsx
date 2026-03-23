'use client';

import { Flexbox } from '@lobehub/ui';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { RESOURCE_ENTRY_ICONS } from '@/config/resourceIcons';
import NavItem from '@/features/NavPanel/components/NavItem';
import { buildResourceRootPath } from '@/features/ResourceSpaces';
import { FilesTabs } from '@/types/files';

import { useResourceManagerStore } from '../../../features/store';

const CategoryMenu = memo(() => {
  const { t } = useTranslation('file');
  const { spaceId } = useParams<{ spaceId?: string }>();
  const [activeKey, setMode] = useResourceManagerStore((s) => [s.category, s.setMode]);
  const navigate = useNavigate();
  const basePath = buildResourceRootPath(spaceId);

  const items = useMemo(
    () => [
      {
        icon: RESOURCE_ENTRY_ICONS.all,
        key: FilesTabs.All,
        title: t('tab.all'),
        url: basePath,
      },
      {
        icon: RESOURCE_ENTRY_ICONS.documents,
        key: FilesTabs.Documents,
        title: t('tab.documents'),
        url: `${basePath}?category=documents`,
      },
      {
        icon: RESOURCE_ENTRY_ICONS.images,
        key: FilesTabs.Images,
        title: t('tab.images'),
        url: `${basePath}?category=images`,
      },
      {
        icon: RESOURCE_ENTRY_ICONS.audios,
        key: FilesTabs.Audios,
        title: t('tab.audios'),
        url: `${basePath}?category=audios`,
      },
      {
        icon: RESOURCE_ENTRY_ICONS.videos,
        key: FilesTabs.Videos,
        title: t('tab.videos'),
        url: `${basePath}?category=videos`,
      },
    ],
    [basePath, t],
  );

  return (
    <Flexbox gap={1} paddingInline={4}>
      {items.map((item) => (
        <Link
          key={item.key}
          to={item.url}
          onClick={(e) => {
            e.preventDefault();
            setMode('explorer');
            navigate(item.url, { replace: true });
          }}
        >
          <NavItem active={activeKey === item.key} icon={item.icon} title={item.title} />
        </Link>
      ))}
    </Flexbox>
  );
});

CategoryMenu.displayName = 'CategoryMenu';

export default CategoryMenu;
