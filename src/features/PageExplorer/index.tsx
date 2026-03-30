'use client';

import { memo, useCallback } from 'react';

import { PageEditor } from '@/features/PageEditor';
import { pageSelectors, usePageStore } from '@/store/docs';
import {
  DEFAULT_PAGE_KIND,
  getPageKindFromDocument,
  type PageKind,
  TABLE_PAGE_KIND,
} from '@/utils/docs';

interface PageExplorerProps {
  pageId: string;
  pageKind?: PageKind;
}

/**
 * Dedicated for the /docs route
 *
 * Work together with a sidebar @/features/Pages/PageLayout/Body
 */
const TABLE_EDITOR_MIN_WIDTH = 1120;

const PageExplorer = memo<PageExplorerProps>(({ pageId, pageKind = DEFAULT_PAGE_KIND }) => {
  const updatePageOptimistically = usePageStore((s) => s.updatePageOptimistically);
  const useFetchPageDetail = usePageStore((s) => s.useFetchPageDetail);
  useFetchPageDetail(pageId);

  // Get document title and emoji from PageStore
  const document = usePageStore(pageSelectors.getDocumentById(pageId));
  const parentId = document?.parentId ?? undefined;
  const sourceSetId = document?.sourceSetId ?? undefined;
  const title = document?.title;
  const emoji = document?.metadata?.emoji as string | undefined;
  const isTablePage =
    getPageKindFromDocument(document) === TABLE_PAGE_KIND || pageKind === TABLE_PAGE_KIND;

  // Optimistic update handlers for title and emoji
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      updatePageOptimistically(pageId, { title: newTitle });
    },
    [pageId, updatePageOptimistically],
  );

  const handleEmojiChange = useCallback(
    (newEmoji: string | undefined) => {
      updatePageOptimistically(pageId, { emoji: newEmoji });
    },
    [pageId, updatePageOptimistically],
  );

  return (
    <PageEditor
      allowHorizontalScroll={isTablePage}
      contentMinWidth={isTablePage ? TABLE_EDITOR_MIN_WIDTH : undefined}
      emoji={emoji}
      key={pageId}
      pageId={pageId}
      pageKind={isTablePage ? TABLE_PAGE_KIND : pageKind}
      parentId={parentId}
      sourceSetId={sourceSetId}
      title={title}
      onEmojiChange={handleEmojiChange}
      onTitleChange={handleTitleChange}
    />
  );
});

export default PageExplorer;
