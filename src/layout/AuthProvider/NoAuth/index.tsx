'use client';

import { type PropsWithChildren } from 'react';
import { memo, useEffect } from 'react';
import { createStoreUpdater } from 'zustand-utils';

import { useUserStore } from '@/store/user';

const NoAuthProvider = memo<PropsWithChildren>(({ children }) => {
  const useStoreUpdater = createStoreUpdater(useUserStore);

  useStoreUpdater('isLoaded', true);
  useStoreUpdater('isSignedIn', true);

  useEffect(() => {
    useUserStore.setState({
      user: {
        avatar: '',
        email: 'local@localhost',
        fullName: 'Local User',
        id: 'local-user',
        username: 'local-user',
      },
    });
  }, []);

  return children;
});

export default NoAuthProvider;
