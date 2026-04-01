'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/slices/auth/selectors';

import { resolveSpaceDisplayName } from './resolveSpaceDisplayName';

const SPACE_LIST_KEY = 'resource-space-list';

export const useSpaceName = (spaceId?: string | null) => {
  const { t } = useTranslation('file');
  const username = useUserStore(userProfileSelectors.username);
  const fullName = useUserStore(userProfileSelectors.fullName);
  const { data } = useSWR(
    spaceId ? SPACE_LIST_KEY : null,
    () => lambdaClient.space.listSpaces.query(),
    {
      revalidateOnFocus: false,
    },
  );

  return useMemo(() => {
    if (!spaceId) return undefined;

    return resolveSpaceDisplayName(
      data?.find((space) => space.id === spaceId),
      t,
      {
        fullName,
        username,
      },
    );
  }, [data, fullName, spaceId, t, username]);
};
