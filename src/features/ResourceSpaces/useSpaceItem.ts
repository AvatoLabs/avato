'use client';

import { useMemo } from 'react';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

import { SPACE_LIST_KEY } from './SpaceList';

export const useSpaceItem = (spaceId?: string | null) => {
  const { data, isLoading } = useSWR(
    spaceId ? SPACE_LIST_KEY : null,
    () => lambdaClient.space.listSpaces.query(),
    {
      revalidateOnFocus: false,
    },
  );

  const space = useMemo(() => {
    if (!spaceId) return undefined;

    return data?.find((item) => item.id === spaceId);
  }, [data, spaceId]);

  return { isLoading, space };
};
