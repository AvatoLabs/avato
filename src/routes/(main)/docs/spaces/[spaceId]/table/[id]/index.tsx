'use client';

import { memo } from 'react';

import { PageDetail } from '@/features/Pages';

const PageTableSpaceDetailPage = memo(() => {
  return <PageDetail pageKind="table" />;
});

PageTableSpaceDetailPage.displayName = 'PageTableSpaceDetailPage';

export default PageTableSpaceDetailPage;
