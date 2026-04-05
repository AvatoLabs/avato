'use client';

import { Center } from '@lobehub/ui';
import { memo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useSWR from 'swr';

import Loading from '@/components/Loading/BrandTextLoading';
import { lambdaClient } from '@/libs/trpc/client';

import { buildSpaceRootPath } from './paths';
import { SPACE_LIST_KEY } from './SpaceList';
import {
  buildPendingGovernancePath,
  useTeamSpaceMemoryScopeSummaries,
} from './useTeamSpaceMemoryScopeSummaries';

const appendSearch = (path: string, search: string) => {
  if (!search) return path;

  return `${path}${path.includes('?') ? '&' : '?'}${search.slice(1)}`;
};

const SpaceRedirectPage = memo(() => {
  const location = useLocation();
  const { data, isLoading } = useSWR(SPACE_LIST_KEY, () => lambdaClient.space.listSpaces.query(), {
    revalidateOnFocus: false,
  });
  const { pendingGovernanceCountBySpaceId, pendingGovernanceTargetBySpaceId } =
    useTeamSpaceMemoryScopeSummaries(data);

  if (isLoading || !data) {
    return (
      <Center height={'100%'} width={'100%'}>
        <Loading debugId="resource-space-redirect" />
      </Center>
    );
  }

  const pendingTeamSpace = data.find((space) => {
    if (space.kind !== 'team') return false;

    return (pendingGovernanceCountBySpaceId.get(space.id) ?? 0) > 0;
  });

  const pendingTarget = pendingTeamSpace
    ? (pendingGovernanceTargetBySpaceId.get(pendingTeamSpace.id) ?? null)
    : null;

  if (pendingTeamSpace?.id && pendingTarget) {
    return (
      <Navigate
        replace
        to={appendSearch(
          buildPendingGovernancePath(pendingTeamSpace.id, pendingTarget),
          location.search,
        )}
      />
    );
  }

  const personalSpace = data.find((space) => space.kind === 'personal');
  const targetSpace = personalSpace || data[0];

  if (!targetSpace?.id) {
    return null;
  }

  return (
    <Navigate replace to={appendSearch(buildSpaceRootPath(targetSpace.id), location.search)} />
  );
});

SpaceRedirectPage.displayName = 'SpaceRedirectPage';

export default SpaceRedirectPage;
