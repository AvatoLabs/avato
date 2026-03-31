'use client';

import { memo } from 'react';

import { PageDetail } from '@/features/Pages';

const SpaceDocDetailPage = memo(() => {
  return <PageDetail pageKind="doc" />;
});

SpaceDocDetailPage.displayName = 'SpaceDocDetailPage';

export default SpaceDocDetailPage;
