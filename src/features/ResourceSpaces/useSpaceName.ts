'use client';

import { useMemo } from 'react';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

const SPACE_LIST_KEY = 'resource-space-list';

export const useSpaceName = (spaceId?: string | null) => {
  const { data } = useSWR(
    spaceId ? SPACE_LIST_KEY : null,
    () => lambdaClient.space.listSpaces.query(),
    {
      revalidateOnFocus: false,
    },
  );

  return useMemo(() => {
    if (!spaceId) return undefined;

    return data?.find((space) => space.id === spaceId)?.name;
  }, [data, spaceId]);
};
