'use client';

import { useUnmount } from 'ahooks';
import { memo, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { createStoreUpdater } from 'zustand-utils';

import Loading from '@/components/Loading/BrandTextLoading';
import PageExplorer from '@/features/PageExplorer';
import { usePageStore } from '@/store/page';
import { getIdFromIdentifier } from '@/utils/identifier';
import { type PageKind } from '@/utils/page';

import PageTitle from './PageTitle';

interface PageDetailProps {
  pageKind: PageKind;
}

const PageDetail = memo<PageDetailProps>(({ pageKind }) => {
  const storeUpdater = createStoreUpdater(usePageStore);
  const params = useParams<{ id: string }>();

  const pageId = getIdFromIdentifier(params.id ?? '', 'docs');
  storeUpdater('selectedPageId', pageId);

  useUnmount(() => {
    usePageStore.setState({ selectedPageId: undefined });
  });

  return (
    <>
      <PageTitle pageKind={pageKind} />
      <Suspense fallback={<Loading debugId="PagesPage" />}>
        <PageExplorer pageId={pageId} pageKind={pageKind} />
      </Suspense>
    </>
  );
});

PageDetail.displayName = 'PageDetail';

export default PageDetail;
