'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import SubSidebarTitleBar from '@/features/NavPanel/components/SubSidebarTitleBar';
import { buildFilesRootPath, SpaceSurfaceTitle } from '@/features/ResourceSpaces';

const Header = memo(() => {
  const { t } = useTranslation(['common', 'file']);
  const { spaceId } = useParams<{ spaceId?: string }>();
  const resourceRoot = buildFilesRootPath(spaceId);

  return (
    <>
      <SubSidebarTitleBar
        backTo="/"
        backUseHistory={false}
        titleTo={resourceRoot}
        title={
          <SpaceSurfaceTitle spaceId={spaceId} surfaceLabel={t('tab.files', { ns: 'common' })} />
        }
      />
    </>
  );
});

export default Header;
