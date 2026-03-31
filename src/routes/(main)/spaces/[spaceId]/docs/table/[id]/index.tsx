'use client';

import { memo } from 'react';

import { PageDetail } from '@/features/Pages';

const SpaceTableDetailPage = memo(() => {
  return <PageDetail pageKind="table" />;
});

SpaceTableDetailPage.displayName = 'SpaceTableDetailPage';

export default SpaceTableDetailPage;
