'use client';

import { createModal } from '@lobehub/ui/base-ui';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';

import CreateSpaceForm from './CreateSpaceForm';
import { SPACE_LIST_KEY } from './SpaceList';

export const useOpenCreateSpaceModal = (onCreated: (spaceId: string) => void) => {
  const { t } = useTranslation('file');
  const { mutate } = useSWRConfig();

  return useCallback(() => {
    createModal({
      children: (
        <CreateSpaceForm
          onCreated={(spaceId) => {
            void mutate(SPACE_LIST_KEY);
            onCreated(spaceId);
          }}
        />
      ),
      footer: null,
      title: t('space.create.title'),
      width: 420,
    });
  }, [mutate, onCreated, t]);
};
