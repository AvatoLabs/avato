'use client';

import { memo, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import NotFound from '@/components/404';
import NProgress from '@/components/NProgress';
import {
  buildFileScopeSearch,
  buildSourceSetFileScope,
} from '@/features/ContentManager/useFileScope';
import {
  buildContentFolderPath,
  buildContentItemPath,
  buildContentRootPath,
} from '@/features/ResourceSpaces';

import { useSourceSetItem } from '../features/hooks/useSourceSetItem';

const SourceSetPage = memo(() => {
  const {
    id: sourceSetId,
    fileId,
    slug,
    spaceId,
  } = useParams<{
    fileId?: string;
    id: string;
    slug?: string;
    spaceId?: string;
  }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { data, isLoading } = useSourceSetItem(sourceSetId || '');

  useEffect(() => {
    if (!sourceSetId || !data?.spaceId) return;

    const resolvedSpaceId = spaceId || data.spaceId;
    const basePath = fileId
      ? buildContentItemPath(
          slug
            ? buildContentFolderPath(resolvedSpaceId, slug)
            : buildContentRootPath(resolvedSpaceId),
          fileId,
        )
      : slug
        ? buildContentFolderPath(resolvedSpaceId, slug)
        : buildContentRootPath(resolvedSpaceId);

    const nextSearch = buildFileScopeSearch(buildSourceSetFileScope(sourceSetId), searchParams);
    navigate(`${basePath}${nextSearch}`, { replace: true });
  }, [data?.spaceId, fileId, navigate, searchParams, slug, sourceSetId, spaceId]);

  if (!isLoading && !data) return <NotFound />;

  return (
    <>
      <NProgress />
    </>
  );
});

SourceSetPage.displayName = 'SourceSetPage';

export default SourceSetPage;
