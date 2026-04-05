'use client';

import { Center } from '@lobehub/ui';
import { memo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useSWR from 'swr';

import Loading from '@/components/Loading/BrandTextLoading';
import { lambdaClient } from '@/libs/trpc/client';

import { buildFilesTrashPath } from './paths';
import { SPACE_LIST_KEY } from './SpaceList';

const appendSearch = (path: string, search: string) => {
  if (!search) return path;

  return `${path}${path.includes('?') ? '&' : '?'}${search.slice(1)}`;
};

const SpaceTrashRedirectPage = memo(() => {
  const location = useLocation();
  const { data, isLoading } = useSWR(SPACE_LIST_KEY, () => lambdaClient.space.listSpaces.query(), {
    revalidateOnFocus: false,
  });

  if (isLoading || !data) {
    return (
      <Center height={'100%'} width={'100%'}>
        <Loading debugId="resource-space-trash-redirect" />
      </Center>
    );
  }

  const personalSpace = data.find((space) => space.kind === 'personal');
  const targetSpace = personalSpace || data[0];

  if (!targetSpace?.id) return null;

  return (
    <Navigate replace to={appendSearch(buildFilesTrashPath(targetSpace.id), location.search)} />
  );
});

SpaceTrashRedirectPage.displayName = 'SpaceTrashRedirectPage';

export default SpaceTrashRedirectPage;
