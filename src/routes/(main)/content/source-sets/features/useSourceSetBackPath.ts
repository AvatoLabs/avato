'use client';

import { useLocation, useParams } from 'react-router-dom';

import {
  buildContentRootPath,
  buildSourceSetFolderPath,
  buildSourceSetPath,
} from '@/features/ResourceSpaces';
import { useFolderPath } from '@/routes/(main)/content/features/hooks/useFolderPath';
import { useContentManagerFetchContentFolderBreadcrumb } from '@/routes/(main)/content/features/store';

export const useSourceSetBackPath = () => {
  const location = useLocation();
  const { id, spaceId } = useParams<{ id?: string; spaceId?: string }>();
  const { currentFolderSlug } = useFolderPath();
  const { data: folderBreadcrumb = [] } = useContentManagerFetchContentFolderBreadcrumb(
    currentFolderSlug,
    spaceId,
  );

  const contentRootPath = buildContentRootPath(spaceId);
  if (!id) return contentRootPath;

  const sourceSetRootPath = buildSourceSetPath(spaceId, id);

  if (location.pathname.endsWith('/trash')) {
    return sourceSetRootPath;
  }

  if (!currentFolderSlug) {
    return contentRootPath;
  }

  if (folderBreadcrumb.length <= 1) {
    return sourceSetRootPath;
  }

  const parentFolder = folderBreadcrumb.at(-2);
  if (!parentFolder) return sourceSetRootPath;

  return buildSourceSetFolderPath(spaceId, id, parentFolder.slug || parentFolder.id);
};
