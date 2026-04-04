'use client';

import { useMemo } from 'react';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

import { SPACE_LIST_KEY } from './SpaceList';
import { canCreateSpaceMemory } from './spaceMemoryCapabilities';

export const useSpaceMemoryCandidateTargets = (preferredSpaceId?: string) => {
  const { data, isLoading } = useSWR(SPACE_LIST_KEY, () => lambdaClient.space.listSpaces.query(), {
    revalidateOnFocus: false,
  });

  const teamSpaces = useMemo(
    () => (data ?? []).filter((space) => canCreateSpaceMemory(space)),
    [data],
  );

  const defaultSpaceId = useMemo(() => {
    if (preferredSpaceId && teamSpaces.some((space) => space.id === preferredSpaceId)) {
      return preferredSpaceId;
    }

    return teamSpaces[0]?.id;
  }, [preferredSpaceId, teamSpaces]);

  return {
    defaultSpaceId,
    isLoading,
    teamSpaces,
  };
};
