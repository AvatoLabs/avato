'use client';

import { memo } from 'react';
import { Link } from 'react-router-dom';

import GroupSkeleton from '@/routes/(main)/home/features/components/GroupSkeleton';
import { RECENT_BLOCK_SIZE } from '@/routes/(main)/home/features/const';
import { homeRecentSelectors } from '@/store/home/selectors';
import { useHomeStore } from '@/store/home/store';
import { getPageDetailPath, getPageKindFromDocument } from '@/utils/docs';

import RecentPageItem from './Item';

const RecentPageList = memo(() => {
  const documents = useHomeStore(homeRecentSelectors.recentPages);
  const isInit = useHomeStore(homeRecentSelectors.isRecentPagesInit);

  // Loading state
  if (!isInit) {
    return (
      <GroupSkeleton
        height={RECENT_BLOCK_SIZE.PAGE.HEIGHT}
        variant={'page'}
        width={RECENT_BLOCK_SIZE.PAGE.WIDTH}
      />
    );
  }

  return documents.map((document) => {
    const pageUrl = getPageDetailPath(
      document.id,
      getPageKindFromDocument(document),
      document.spaceId,
    );

    return (
      <Link
        key={document.id}
        to={pageUrl}
        style={{
          color: 'inherit',
          textDecoration: 'none',
        }}
      >
        <RecentPageItem document={document} />
      </Link>
    );
  });
});

export default RecentPageList;
