'use client';

import { Modal } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { TrashContent } from '@/features/ResourceTrash';

export const ResourceTrashModal = memo<{
  sourceSetId?: string;
  onClose: () => void;
  open: boolean;
  spaceId?: string;
}>(({ sourceSetId, open, onClose, spaceId }) => {
  const { t } = useTranslation('file');

  return (
    <Modal
      destroyOnHidden
      footer={null}
      open={open}
      title={t('trash.title')}
      width={560}
      onCancel={onClose}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <TrashContent enabled={open} sourceSetId={sourceSetId} spaceId={spaceId} variant="modal" />
    </Modal>
  );
});

ResourceTrashModal.displayName = 'ResourceTrashModal';
