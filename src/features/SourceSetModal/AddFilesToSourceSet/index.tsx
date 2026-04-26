import { Flexbox, Icon } from '@lobehub/ui';
import { createModal, useModalContext } from '@lobehub/ui/base-ui';
import { BookUp2Icon } from 'lucide-react';
import { memo, Suspense, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import SelectForm from './SelectForm';

interface AddFilesToSourceSetModalProps {
  fileIds: string[];
  onClose?: () => void;
  sourceSetId?: string;
}

interface ModalContentProps {
  fileIds: string[];
  onClose?: () => void;
  sourceSetId?: string;
}

const ModalContent = memo<ModalContentProps>(({ fileIds, onClose, sourceSetId }) => {
  const { t } = useTranslation('sourceSet');
  const { close } = useModalContext();
  const handleClose = () => {
    close();
    onClose?.();
  };

  return (
    <>
      <Flexbox horizontal gap={8} paddingBlock={16} paddingInline={16} style={{ paddingBottom: 0 }}>
        <Icon icon={BookUp2Icon} />
        {t('addToSourceSet.title')}
      </Flexbox>
      <Flexbox padding={16} style={{ paddingTop: 0 }}>
        <SelectForm fileIds={fileIds} sourceSetId={sourceSetId} onClose={handleClose} />
      </Flexbox>
    </>
  );
});

ModalContent.displayName = 'AddFilesToSourceSetModalContent';

export const useAddFilesToSourceSetModal = () => {
  const open = useCallback((params?: AddFilesToSourceSetModalProps) => {
    createModal({
      children: (
        <Suspense fallback={<div style={{ minHeight: 200 }} />}>
          <ModalContent
            fileIds={params?.fileIds || []}
            onClose={params?.onClose}
            sourceSetId={params?.sourceSetId}
          />
        </Suspense>
      ),
      footer: null,
      title: null,
    });
  }, []);

  return { open };
};
