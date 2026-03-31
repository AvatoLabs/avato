'use client';

import { memo } from 'react';

import { PageDetail } from '@/features/Pages';

const PagesSpaceDetailPage = memo(() => {
  return <PageDetail pageKind="doc" />;
});

PagesSpaceDetailPage.displayName = 'PagesSpaceDetailPage';

export default PagesSpaceDetailPage;
