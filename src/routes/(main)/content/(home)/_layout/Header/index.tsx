'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import SubSidebarTitleBar from '@/features/NavPanel/components/SubSidebarTitleBar';
import { buildContentRootPath } from '@/features/ResourceSpaces';

const Header = memo(() => {
  const { t } = useTranslation('file');
  const { spaceId } = useParams<{ spaceId?: string }>();
  const resourceRoot = buildContentRootPath(spaceId);

  return (
    <>
      <SubSidebarTitleBar
        backTo="/"
        backUseHistory={false}
        title={t('spaceContent.title', { defaultValue: 'Content' })}
        titleTo={resourceRoot}
      />
    </>
  );
});

export default Header;
