'use client';

import { memo, Suspense } from 'react';

import Loading from '@/components/Loading/BrandTextLoading';
import PageExplorerPlaceholder from '@/features/PageExplorer/PageExplorerPlaceholder';
import { type PageKind } from '@/utils/docs';

import PageTitle from './PageTitle';

interface PageEntryProps {
  pageKind: PageKind;
}

const PageEntry = memo<PageEntryProps>(({ pageKind }) => {
  return (
    <>
      <PageTitle pageKind={pageKind} />
      <Suspense fallback={<Loading debugId="PagesPage" />}>
        <PageExplorerPlaceholder pageKind={pageKind} />
      </Suspense>
    </>
  );
});

PageEntry.displayName = 'PageEntry';

export default PageEntry;
