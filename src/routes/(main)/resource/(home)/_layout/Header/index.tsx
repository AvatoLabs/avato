'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import SubSidebarTitleBar from '@/features/NavPanel/components/SubSidebarTitleBar';
import { buildResourceRootPath } from '@/features/ResourceSpaces';
import { LibraryTrashButton } from '@/routes/(main)/resource/features/LibraryTrashButton';

import CategoryMenu from './CategoryMenu';

const Header = memo(() => {
  const { t } = useTranslation('common');
  const { spaceId } = useParams<{ spaceId?: string }>();
  const resourceRoot = buildResourceRootPath(spaceId);

  return (
    <>
      <SubSidebarTitleBar
        right={<LibraryTrashButton />}
        title={t('tab.resource')}
        titleTo={resourceRoot}
      />
      <CategoryMenu />
    </>
  );
});

export default Header;
