'use client';

import { type PropsWithChildren } from 'react';
import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createStoreUpdater } from 'zustand-utils';

import { useUserStore } from '@/store/user';

const NoAuthProvider = memo<PropsWithChildren>(({ children }) => {
  const { t } = useTranslation('common');
  const useStoreUpdater = createStoreUpdater(useUserStore);

  useStoreUpdater('isLoaded', true);
  useStoreUpdater('isSignedIn', true);

  useEffect(() => {
    useUserStore.setState({
      user: {
        avatar: '',
        email: 'local@localhost',
        fullName: t('userPanel.localUser'),
        id: 'local-user',
        username: 'local-user',
      },
    });
  }, [t]);

  return children;
});

export default NoAuthProvider;
