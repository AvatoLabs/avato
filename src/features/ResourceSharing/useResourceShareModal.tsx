'use client';

import { createModal } from '@lobehub/ui';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { type ResourceKind } from '@/types/resource';

import ResourceShareModal from './ResourceShareModal';

interface OpenShareModalParams {
  id: string;
  kind: ResourceKind;
  name: string;
}

export const useResourceShareModal = () => {
  const { t } = useTranslation('file');

  const open = useCallback(
    (params: OpenShareModalParams) => {
      createModal({
        children: <ResourceShareModal {...params} />,
        focusTriggerAfterClose: true,
        footer: null,
        title: t('share.title'),
        width: 720,
      });
    },
    [t],
  );

  return { open };
};
