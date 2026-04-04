'use client';

import { Center } from '@lobehub/ui';
import { memo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useSWR from 'swr';

import Loading from '@/components/Loading/BrandTextLoading';
import { lambdaClient } from '@/libs/trpc/client';

import { buildSpaceRootPath } from './paths';
import { SPACE_LIST_KEY } from './SpaceList';

const SpaceRedirectPage = memo(() => {
  const location = useLocation();
  const { data, isLoading } = useSWR(SPACE_LIST_KEY, () => lambdaClient.space.listSpaces.query(), {
    revalidateOnFocus: false,
  });

  if (isLoading || !data) {
    return (
      <Center height={'100%'} width={'100%'}>
        <Loading debugId="resource-space-redirect" />
      </Center>
    );
  }

  const personalSpace = data.find((space) => space.kind === 'personal');
  const targetSpace = personalSpace || data[0];

  if (!targetSpace?.id) {
    return null;
  }

  return <Navigate replace to={`${buildSpaceRootPath(targetSpace.id)}${location.search}`} />;
});

SpaceRedirectPage.displayName = 'SpaceRedirectPage';

export default SpaceRedirectPage;
