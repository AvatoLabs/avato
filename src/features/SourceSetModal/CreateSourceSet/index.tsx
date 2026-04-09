import { Flexbox } from '@lobehub/ui';
import { createModal, useModalContext } from '@lobehub/ui/base-ui';
import { memo, Suspense, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import CreateForm from './CreateForm';

interface ModalContentProps {
  id?: string;
  initialValues?: { name?: string; description?: string };
  onSuccess?: (id: string) => void;
  spaceId?: string;
}

const ModalContent = memo<ModalContentProps>(({ id, initialValues, onSuccess, spaceId }) => {
  const { close } = useModalContext();

  return (
    <Flexbox paddingInline={8} style={{ paddingBottom: 8 }}>
      <CreateForm
        id={id}
        initialValues={initialValues}
        spaceId={spaceId}
        onClose={close}
        onSuccess={onSuccess}
      />
    </Flexbox>
  );
});

ModalContent.displayName = 'CreateSourceSetModalContent';

interface OpenParams {
  id?: string;
  initialValues?: { name?: string; description?: string };
  onSuccess?: (id: string) => void;
  spaceId?: string;
}

export const useCreateSourceSetModal = () => {
  const { t } = useTranslation('sourceSet');

  const open = useCallback(
    (props?: OpenParams) => {
      const isEditMode = !!props?.id;

      createModal({
        children: (
          <Suspense fallback={<div style={{ minHeight: 200 }} />}>
            <ModalContent
              id={props?.id}
              initialValues={props?.initialValues}
              spaceId={props?.spaceId}
              onSuccess={props?.onSuccess}
            />
          </Suspense>
        ),
        footer: null,
        title: isEditMode ? t('createNew.edit.title') : t('createNew.title'),
        width: 420,
      });
    },
    [t],
  );

  return { open };
};
