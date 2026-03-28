'use client';

import { ActionIcon } from '@lobehub/ui';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RESOURCE_ENTRY_ICONS } from '@/config/resourceIcons';
import { ResourceTrashModal } from '@/routes/(main)/resource/features/modal/ResourceTrashModal';

export const LibraryTrashButton = memo<{
  knowledgeBaseId?: string;
  spaceId?: string;
}>(({ knowledgeBaseId, spaceId }) => {
  const { t } = useTranslation('file');
  const [open, setOpen] = useState(false);

  return (
    <>
      <ActionIcon
        aria-label={t('trash.open')}
        icon={RESOURCE_ENTRY_ICONS.trash}
        size={{ blockSize: 32, size: 16 }}
        title={t('trash.open')}
        onClick={() => setOpen(true)}
      />
      <ResourceTrashModal
        knowledgeBaseId={knowledgeBaseId}
        open={open}
        spaceId={spaceId}
        onClose={() => setOpen(false)}
      />
    </>
  );
});

LibraryTrashButton.displayName = 'LibraryTrashButton';
