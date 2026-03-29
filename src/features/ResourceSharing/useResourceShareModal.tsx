'use client';

import { createModal } from '@lobehub/ui/base-ui';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { type ContentKind } from '@/types/content';

import ResourceShareModal from './ResourceShareModal';

interface OpenShareModalParams {
  id: string;
  kind: ContentKind;
  name: string;
}

export const useResourceShareModal = () => {
  const { t } = useTranslation('file');

  const open = useCallback(
    (params: OpenShareModalParams) => {
      createModal({
        children: <ResourceShareModal {...params} />,
        focusable: { focusTriggerAfterClose: true },
        footer: null,
        title: t('share.title'),
        width: 760,
      });
    },
    [t],
  );

  return { open };
};
