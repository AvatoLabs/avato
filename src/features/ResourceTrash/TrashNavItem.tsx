'use client';

import { type ReactNode } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { getFileScope, getSourceSetScopeId } from '@/features/ContentManager/useFileScope';
import NavItem from '@/features/NavPanel/components/NavItem';
import {
  buildFilesTrashPath,
  buildSourceSetTrashPath,
} from '@/features/ResourceSpaces/paths';

export const TrashNavItem = memo<{
  sourceSetId?: string;
  spaceId?: string;
  title?: ReactNode;
}>(({ sourceSetId, spaceId, title }) => {
  const { t } = useTranslation('file');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentSourceSetId = getSourceSetScopeId(getFileScope(searchParams)) ?? undefined;

  const targetPath = sourceSetId
    ? buildSourceSetTrashPath(spaceId, sourceSetId)
    : buildFilesTrashPath(spaceId);
  const activeBasePath = location.pathname === buildFilesTrashPath(spaceId);
  const isActive = sourceSetId
    ? activeBasePath && currentSourceSetId === sourceSetId
    : activeBasePath && !currentSourceSetId;

  return (
    <NavItem
      active={isActive}
      icon={RESOURCE_ENTRY_ICONS.trash}
      title={title ?? t('trash.title')}
      onClick={() => navigate(targetPath)}
    />
  );
});

TrashNavItem.displayName = 'TrashNavItem';
