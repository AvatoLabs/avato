'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { RESOURCE_ENTRY_ICONS } from '@/config/resourceIcons';
import NavItem from '@/features/NavPanel/components/NavItem';
import { buildResourceLibraryTrashPath, buildResourceTrashPath } from '@/features/ResourceSpaces';

export const TrashNavItem = memo<{
  knowledgeBaseId?: string;
  spaceId?: string;
}>(({ knowledgeBaseId, spaceId }) => {
  const { t } = useTranslation('file');
  const navigate = useNavigate();
  const location = useLocation();

  const targetPath = knowledgeBaseId
    ? buildResourceLibraryTrashPath(spaceId, knowledgeBaseId)
    : buildResourceTrashPath(spaceId);

  return (
    <NavItem
      active={location.pathname === targetPath}
      icon={RESOURCE_ENTRY_ICONS.trash}
      title={t('trash.title')}
      onClick={() => navigate(targetPath)}
    />
  );
});

TrashNavItem.displayName = 'TrashNavItem';
