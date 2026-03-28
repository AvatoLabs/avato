'use client';

import { Modal } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { TrashContent } from '@/features/ResourceTrash';

export const ResourceTrashModal = memo<{
  knowledgeBaseId?: string;
  onClose: () => void;
  open: boolean;
  spaceId?: string;
}>(({ knowledgeBaseId, open, onClose, spaceId }) => {
  const { t } = useTranslation('file');

  return (
    <Modal
      destroyOnClose
      footer={null}
      open={open}
      title={t('trash.title')}
      width={560}
      onCancel={onClose}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <TrashContent
        enabled={open}
        knowledgeBaseId={knowledgeBaseId}
        spaceId={spaceId}
        variant="modal"
      />
    </Modal>
  );
});

ResourceTrashModal.displayName = 'ResourceTrashModal';
