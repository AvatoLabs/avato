'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import SideBarHeaderLayout from '@/features/NavPanel/SideBarHeaderLayout';
import { buildResourceRootPath } from '@/features/ResourceSpaces';
import { LibraryTrashButton } from '@/routes/(main)/resource/features/LibraryTrashButton';

import CategoryMenu from './CategoryMenu';

const Header = memo(() => {
  const { t } = useTranslation('common');
  const { spaceId } = useParams<{ spaceId?: string }>();

  return (
    <>
      <SideBarHeaderLayout
        right={<LibraryTrashButton />}
        breadcrumb={[
          {
            href: buildResourceRootPath(spaceId),
            title: t('tab.resource'),
          },
        ]}
      />
      <CategoryMenu />
    </>
  );
});

export default Header;
