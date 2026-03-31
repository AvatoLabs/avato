import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { buildPageScopeSearch, createSourceSetPageScope } from '@/features/Pages/usePageScope';
import {
  buildSpaceRootPath,
  SurfaceBreadcrumb,
  type SurfaceBreadcrumbSegment,
  useSpaceName,
} from '@/features/ResourceSpaces';
import { pageSelectors, usePageStore } from '@/store/docs';
import { useFileStore } from '@/store/file';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';
import { getPageRootPath, TABLE_PAGE_KIND } from '@/utils/docs';

import { usePageEditorStore } from '../store';

interface FolderCrumb {
  id: string;
  name: string;
}

const Breadcrumb = memo(() => {
  const { t } = useTranslation('file');
  const navigate = useNavigate();

  const [documentId, pageKind, title, sourceSetId, parentId] = usePageEditorStore((s) => [
    s.documentId,
    s.pageKind,
    s.title,
    s.sourceSetId,
    s.parentId,
  ]);
  const pageDocument = usePageStore(pageSelectors.getDocumentById(documentId));
  const spaceId = pageDocument?.spaceId ?? undefined;

  const sourceSetName = useSourceSetStore(
    sourceSetSelectors.getSourceSetNameById(sourceSetId || ''),
  );
  const spaceName = useSpaceName(spaceId);

  // Fetch the parent folder to get its slug
  const useFetchKnowledgeItem = useFileStore((s) => s.useFetchKnowledgeItem);
  const { data: parentFolder } = useFetchKnowledgeItem(parentId);

  // Fetch folder breadcrumb chain from backend using parent folder's slug
  const useFetchFolderBreadcrumb = useFileStore((s) => s.useFetchFolderBreadcrumb);
  const { data: folderChain = [] } = useFetchFolderBreadcrumb(
    parentFolder?.slug || null,
    parentFolder?.spaceId ?? undefined,
  );

  const documentTitle = title || t('docEditor.titlePlaceholder');
  const resolvedSpaceLabel = spaceName || spaceId || t('space.sectionTitle');
  const surfaceLabel =
    pageKind === TABLE_PAGE_KIND
      ? t('tab.table', { defaultValue: 'Tables' })
      : t('tab.pages', { defaultValue: 'Docs' });
  const docsRootPath = getPageRootPath(pageKind, spaceId);
  const scopedDocsSearch =
    sourceSetId && buildPageScopeSearch(createSourceSetPageScope(sourceSetId));
  const docsPath = scopedDocsSearch ? `${docsRootPath}${scopedDocsSearch}` : docsRootPath;
  const segments = useMemo<SurfaceBreadcrumbSegment[]>(
    () => [
      ...(spaceId
        ? [
            {
              key: 'space',
              label: resolvedSpaceLabel,
              onClick: () => navigate(buildSpaceRootPath(spaceId)),
            },
          ]
        : []),
      {
        key: 'docs',
        label: surfaceLabel,
        onClick: spaceId ? () => navigate(docsPath) : undefined,
      },
      ...(sourceSetId
        ? [
            {
              key: 'source-set',
              label: sourceSetName || t('sourceSet.title'),
              onClick: spaceId ? () => navigate(docsPath) : undefined,
            },
          ]
        : []),
      ...folderChain.map((folder: FolderCrumb) => ({
        key: folder.id,
        label: folder.name,
      })),
      {
        current: true,
        key: 'current-document',
        label: documentTitle,
      },
    ],
    [
      docsPath,
      documentTitle,
      folderChain,
      navigate,
      resolvedSpaceLabel,
      sourceSetId,
      sourceSetName,
      spaceId,
      surfaceLabel,
      t,
    ],
  );

  return <SurfaceBreadcrumb segments={segments} />;
});

Breadcrumb.displayName = 'Breadcrumb';

export default Breadcrumb;
