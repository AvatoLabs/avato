import { Skeleton } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  buildContentFolderPath,
  buildContentRootPath,
  buildSourceSetFolderPath,
  buildSourceSetPath,
  buildSpaceRootPath,
  SurfaceBreadcrumb,
} from '@/features/ResourceSpaces';
import { useSpaceName } from '@/features/ResourceSpaces/useSpaceName';
import { useFolderPath } from '@/routes/(main)/content/features/hooks/useFolderPath';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { useFileStore } from '@/store/file';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';

interface BreadcrumbProps {
  fileName?: string;
}

interface FolderCrumb {
  id: string;
  name: string;
  slug: string;
}

const Breadcrumb = memo<BreadcrumbProps>(({ fileName }) => {
  const { t } = useTranslation(['common', 'file']);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentFolderSlug, sourceSetId: currentSourceSetId } = useFolderPath();

  const [setMode, setCurrentViewItemId, spaceId] = useContentManagerStore((s) => [
    s.setMode,
    s.setCurrentViewItemId,
    s.spaceId,
  ]);

  const rootSourceSetId = currentSourceSetId;
  const sourceSetName = useSourceSetStore(
    sourceSetSelectors.getSourceSetNameById(rootSourceSetId || ''),
  );
  const spaceName = useSpaceName(spaceId);

  // Fetch folder breadcrumb chain from backend
  const useFetchFolderBreadcrumb = useFileStore((s) => s.useFetchFolderBreadcrumb);
  const { data: folderChain = [] } = useFetchFolderBreadcrumb(currentFolderSlug, spaceId);

  // When in home mode (no source set selected), show the category breadcrumb.
  if (!rootSourceSetId && !currentFolderSlug && !fileName) {
    return null;
  }

  const clearViewAndSelection = () => {
    // If navigating while viewing a file, reset the file view mode
    if (fileName) {
      setMode('explorer');
      setCurrentViewItemId(undefined);
    }
  };

  const buildPreservedQueryString = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('file');
    newParams.delete('files');

    return newParams.toString();
  };

  const handleSpaceNavigate = () => {
    clearViewAndSelection();

    const queryString = buildPreservedQueryString();
    const basePath = buildSpaceRootPath(spaceId);

    navigate(queryString ? `${basePath}?${queryString}` : basePath);
  };

  const handleSectionNavigate = (slug: string | null) => {
    clearViewAndSelection();

    const queryString = buildPreservedQueryString();
    const basePath = rootSourceSetId
      ? slug
        ? buildSourceSetFolderPath(spaceId, rootSourceSetId, slug)
        : buildSourceSetPath(spaceId, rootSourceSetId)
      : slug
        ? buildContentFolderPath(spaceId, slug)
        : buildContentRootPath(spaceId);

    navigate(queryString ? `${basePath}?${queryString}` : basePath);
  };

  const isAtRoot = folderChain.length === 0 && !fileName;
  const isSectionClickable = folderChain.length > 0 || fileName;
  const resolvedSpaceLabel = spaceName || t('space.sectionTitle', { ns: 'file' });
  const segments = [
    {
      key: 'space',
      label: resolvedSpaceLabel,
      onClick: handleSpaceNavigate,
    },
    {
      current: isAtRoot,
      key: rootSourceSetId ? 'source-set' : 'files',
      label: rootSourceSetId
        ? sourceSetName || (
            <Skeleton.Button active size="small" style={{ height: 14, minWidth: 80, width: 80 }} />
          )
        : t('tab.files', { ns: 'common' }),
      onClick: isSectionClickable ? () => handleSectionNavigate(null) : undefined,
    },
    ...folderChain.map((folder: FolderCrumb, index: number) => ({
      current: index === folderChain.length - 1 && !fileName,
      key: folder.id,
      label: folder.name,
      onClick:
        index === folderChain.length - 1 && !fileName
          ? undefined
          : () => handleSectionNavigate(folder.slug),
    })),
    ...(fileName
      ? [
          {
            current: true,
            key: 'current-file',
            label: fileName,
          },
        ]
      : []),
  ];

  return <SurfaceBreadcrumb segments={segments} />;
});

Breadcrumb.displayName = 'Breadcrumb';

export default Breadcrumb;
