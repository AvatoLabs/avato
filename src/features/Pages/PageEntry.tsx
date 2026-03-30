'use client';

import { memo, Suspense } from 'react';

import Loading from '@/components/Loading/BrandTextLoading';
import { type PageKind } from '@/utils/docs';

import PageTitle from './PageTitle';
import PageWorkspace from './PageWorkspace';

interface PageEntryProps {
  pageKind: PageKind;
}

const PageEntry = memo<PageEntryProps>(({ pageKind }) => {
  return (
    <>
      <PageTitle pageKind={pageKind} />
      <Suspense fallback={<Loading debugId="PagesPage" />}>
        <PageWorkspace pageKind={pageKind} />
      </Suspense>
    </>
  );
});

PageEntry.displayName = 'PageEntry';

export default PageEntry;
