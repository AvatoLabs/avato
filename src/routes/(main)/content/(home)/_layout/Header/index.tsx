'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';

import { useFileScope } from '@/features/ContentManager/useFileScope';
import SubSidebarTitleBar from '@/features/NavPanel/components/SubSidebarTitleBar';
import {
  buildFilesRootPath,
  buildFilesTrashPath,
  buildSharedFilesPath,
  useSpaceName,
} from '@/features/ResourceSpaces';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';

const Header = memo(() => {
  const { t } = useTranslation(['common', 'file']);
  const location = useLocation();
  const { spaceId } = useParams<{ spaceId?: string }>();
  const { sourceSetId } = useFileScope(spaceId);
  const spaceName = useSpaceName(spaceId);
  const sourceSetName = useSourceSetStore(
    sourceSetSelectors.getSourceSetNameById(sourceSetId || ''),
  );
  const resourceRoot = buildFilesRootPath(spaceId);
  const isSharedSurface = location.pathname === buildSharedFilesPath();
  const isTrashSurface = location.pathname === buildFilesTrashPath(spaceId);
  const showBackButton = !isSharedSurface && !isTrashSurface;

  const title = isSharedSurface
    ? `${t('space.quickAccessTitle', { ns: 'file' })} / ${t('shared.title', { ns: 'file' })}`
    : isTrashSurface
      ? sourceSetName
        ? `${sourceSetName} / ${t('trash.title', { ns: 'file' })}`
        : spaceName
          ? `${spaceName} / ${t('trash.title', { ns: 'file' })}`
          : `${t('space.quickAccessTitle', { ns: 'file' })} / ${t('trash.title', { ns: 'file' })}`
      : t('tab.files', { ns: 'common' });

  return (
    <SubSidebarTitleBar
      backTo="/"
      backUseHistory={false}
      showBackButton={showBackButton}
      title={title}
      titleTo={showBackButton ? resourceRoot : undefined}
    />
  );
});

export default Header;
