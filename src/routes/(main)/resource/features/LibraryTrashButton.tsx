'use client';

import { ActionIcon } from '@lobehub/ui';
import { Trash2 } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DocumentTrashModal } from '@/routes/(main)/resource/features/modal/DocumentTrashModal';

export const LibraryTrashButton = memo<{ knowledgeBaseId?: string }>(({ knowledgeBaseId }) => {
  const { t } = useTranslation('file');
  const [open, setOpen] = useState(false);

  return (
    <>
      <ActionIcon
        aria-label={t('trash.open')}
        icon={Trash2}
        onClick={() => setOpen(true)}
        size={{ blockSize: 32, size: 16 }}
        title={t('trash.open')}
      />
      <DocumentTrashModal
        knowledgeBaseId={knowledgeBaseId}
        onClose={() => setOpen(false)}
        open={open}
      />
    </>
  );
});

LibraryTrashButton.displayName = 'LibraryTrashButton';
