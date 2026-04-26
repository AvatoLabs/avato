'use client';

import { memo } from 'react';
import { Link } from 'react-router-dom';

import { isCanonicalDocumentEntry } from '@/features/ContentManager/utils/isCanonicalDocumentEntry';
import { buildPageScopeSearch, createSourceSetPageScope } from '@/features/Pages/usePageScope';
import { buildFilesPreviewPath } from '@/features/ResourceSpaces';
import GroupSkeleton from '@/routes/(main)/home/features/components/GroupSkeleton';
import { RECENT_BLOCK_SIZE } from '@/routes/(main)/home/features/const';
import { homeRecentSelectors } from '@/store/home/selectors';
import { useHomeStore } from '@/store/home/store';
import { getPageDetailPath } from '@/utils/docs';

import RecentResourceItem from './Item';

const RecentResourceList = memo(() => {
  const files = useHomeStore(homeRecentSelectors.recentResources);
  const isInit = useHomeStore(homeRecentSelectors.isRecentResourcesInit);

  // Loading state
  if (!isInit) {
    return (
      <GroupSkeleton
        height={RECENT_BLOCK_SIZE.RESOURCE.HEIGHT}
        variant={'resource'}
        width={RECENT_BLOCK_SIZE.RESOURCE.WIDTH}
      />
    );
  }

  return files.map((file) => {
    const hasCanonicalDocumentIdentity = isCanonicalDocumentEntry({
      id: file.id,
      sourceType: file.sourceType,
    });
    const canonicalDocPath = getPageDetailPath(file.id, 'doc', file.spaceId);
    const canonicalDocSearch = file.sourceSetId
      ? buildPageScopeSearch(createSourceSetPageScope(file.sourceSetId))
      : '';
    const fileUrl = hasCanonicalDocumentIdentity
      ? `${canonicalDocPath}${canonicalDocSearch}`
      : buildFilesPreviewPath(file.spaceId, file.fileId || file.id);

    return (
      <Link
        key={file.id}
        to={fileUrl}
        style={{
          color: 'inherit',
          textDecoration: 'none',
        }}
      >
        <RecentResourceItem file={file} />
      </Link>
    );
  });
});

export default RecentResourceList;
