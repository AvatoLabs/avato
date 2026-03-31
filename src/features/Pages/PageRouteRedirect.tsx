'use client';

import { Center } from '@lobehub/ui';
import { memo } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import useSWR from 'swr';

import Loading from '@/components/Loading/BrandTextLoading';
import { getActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { lambdaClient } from '@/libs/trpc/client';
import { getPageDetailPath, getPageRootPath, type PageKind } from '@/utils/docs';
import { getIdFromIdentifier } from '@/utils/identifier';

interface PageRouteRedirectProps {
  includeId?: boolean;
  pageKind?: PageKind;
}

const PageRouteRedirect = memo<PageRouteRedirectProps>(({ includeId = false, pageKind }) => {
  const location = useLocation();
  const { id, spaceId } = useParams<{ id?: string; spaceId?: string }>();
  const pageId = includeId && id ? getIdFromIdentifier(id, 'docs') : undefined;

  const activeSpaceId = getActiveWorkspaceSpaceId();
  const shouldFetchDocument = !!pageId && !spaceId;

  const { data: document, isLoading: isDocumentLoading } = useSWR(
    shouldFetchDocument ? ['page-route-redirect-document', pageId] : null,
    () => lambdaClient.document.getDocumentById.query({ id: pageId! }),
    { revalidateOnFocus: false },
  );

  const shouldFetchSpaces = !spaceId && !document?.spaceId && !activeSpaceId;

  const { data, isLoading } = useSWR(
    shouldFetchSpaces ? 'resource-space-list' : null,
    () => lambdaClient.space.listSpaces.query(),
    { revalidateOnFocus: false },
  );

  const fallbackSpaceId =
    activeSpaceId ?? data?.find((space) => space.kind === 'personal')?.id ?? data?.[0]?.id;
  const targetSpaceId = spaceId ?? document?.spaceId ?? fallbackSpaceId;

  if (!targetSpaceId) {
    if ((shouldFetchDocument && isDocumentLoading) || (shouldFetchSpaces && isLoading)) {
      return (
        <Center height={'100%'} width={'100%'}>
          <Loading debugId="page-route-redirect" />
        </Center>
      );
    }

    return null;
  }

  const targetPath =
    includeId && pageId
      ? getPageDetailPath(pageId, pageKind, targetSpaceId)
      : getPageRootPath(pageKind, targetSpaceId);

  return <Navigate replace to={`${targetPath}${location.search}`} />;
});

PageRouteRedirect.displayName = 'PageRouteRedirect';

export default PageRouteRedirect;
