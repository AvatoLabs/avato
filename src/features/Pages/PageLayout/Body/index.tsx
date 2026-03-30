'use client';

import { Flexbox } from '@lobehub/ui';
import { memo, Suspense, useMemo } from 'react';

import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import PageEmpty from '@/features/PageEmpty';
import { usePageKind } from '@/features/Pages/usePageKind';
import { getActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { pageSelectors, usePageStore } from '@/store/docs';
import { useSourceSetStore } from '@/store/sourceSet';

import AllPagesDrawer from './AllPagesDrawer';
import List from './List';

/**
 * Page list sidebar
 */
const Body = memo(() => {
  const pageKind = usePageKind();
  const filteredDocumentsSelector = useMemo(
    () => pageSelectors.getFilteredDocumentsSnapshotByKind(pageKind),
    [pageKind],
  );

  const useFetchDocuments = usePageStore((s) => s.useFetchDocuments);
  const useFetchSourceSetList = useSourceSetStore((s) => s.useFetchSourceSetList);
  useFetchDocuments();
  useFetchSourceSetList(getActiveWorkspaceSpaceId());

  const isLoading = usePageStore(pageSelectors.isDocumentsLoading);
  const { displayed: filteredDocuments } = usePageStore(filteredDocumentsSelector);
  const searchKeywords = usePageStore((s) => s.searchKeywords);
  const [allPagesDrawerOpen, closeAllPagesDrawer] = usePageStore((s) => [
    s.allPagesDrawerOpen,
    s.closeAllPagesDrawer,
  ]);

  return (
    <Flexbox gap={6} paddingInline={8}>
      <Suspense fallback={<SkeletonList />}>
        {isLoading ? (
          <SkeletonList />
        ) : (
          <Flexbox gap={2} paddingBlock={2}>
            {filteredDocuments.length === 0 ? (
              <PageEmpty pageKind={pageKind} search={Boolean(searchKeywords.trim())} />
            ) : (
              <List />
            )}
          </Flexbox>
        )}
      </Suspense>
      <AllPagesDrawer open={allPagesDrawerOpen} onClose={closeAllPagesDrawer} />
    </Flexbox>
  );
});

export default Body;
