'use client';

import { Button, Center, Empty } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';
import useSWR from 'swr';

import Loading from '@/components/Loading/BrandTextLoading';
import { lambdaClient } from '@/libs/trpc/client';

import { buildResourceRootPath } from './paths';

const SpaceRedirectPage = memo(() => {
  const { t } = useTranslation(['common', 'discover']);
  const location = useLocation();
  const { data, error, isLoading, mutate } = useSWR(
    'resource-space-list',
    () => lambdaClient.space.listSpaces.query(),
    { revalidateOnFocus: false },
  );

  if (error) {
    return (
      <Center height={'100%'} width={'100%'}>
        <Empty
          description={t('list.error.description', { ns: 'discover' })}
          extra={
            <Button type={'primary'} onClick={() => void mutate()}>
              {t('retry', { ns: 'common' })}
            </Button>
          }
          title={t('list.error.title', { ns: 'discover' })}
          type={'page'}
        />
      </Center>
    );
  }

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

  return <Navigate replace to={`${buildResourceRootPath(targetSpace.id)}${location.search}`} />;
});

SpaceRedirectPage.displayName = 'SpaceRedirectPage';

export default SpaceRedirectPage;
