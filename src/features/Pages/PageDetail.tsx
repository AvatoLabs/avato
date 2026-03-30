'use client';

import { useUnmount } from 'ahooks';
import { memo, Suspense, useEffect } from 'react';
import { useParams } from 'react-router-dom';

import Loading from '@/components/Loading/BrandTextLoading';
import PageExplorer from '@/features/PageExplorer';
import { usePageStore } from '@/store/docs';
import { type PageKind } from '@/utils/docs';
import { getIdFromIdentifier } from '@/utils/identifier';

import PageTitle from './PageTitle';

interface PageDetailProps {
  pageKind: PageKind;
}

const PageDetail = memo<PageDetailProps>(({ pageKind }) => {
  const params = useParams<{ id: string }>();
  const pageId = getIdFromIdentifier(params.id ?? '', 'docs');
  const setSelectedPageId = usePageStore((s) => s.setSelectedPageId);

  useEffect(() => {
    setSelectedPageId(pageId, false);
  }, [pageId, setSelectedPageId]);

  useUnmount(() => {
    usePageStore.getState().setSelectedPageId(null, false);
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
