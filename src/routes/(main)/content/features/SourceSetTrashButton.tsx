'use client';

import { ActionIcon } from '@lobehub/ui';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { ResourceTrashModal } from '@/routes/(main)/content/features/modal/ResourceTrashModal';

export const SourceSetTrashButton = memo<{
  sourceSetId?: string;
  spaceId?: string;
}>(({ sourceSetId, spaceId }) => {
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
        open={open}
        sourceSetId={sourceSetId}
        spaceId={spaceId}
        onClose={() => setOpen(false)}
      />
    </>
  );
});

SourceSetTrashButton.displayName = 'SourceSetTrashButton';
