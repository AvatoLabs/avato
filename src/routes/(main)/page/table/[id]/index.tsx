'use client';

import { memo } from 'react';

import { PageDetail } from '@/features/Pages';

const PageTableDetailPage = memo(() => {
  return <PageDetail pageKind="table" />;
});

PageTableDetailPage.displayName = 'PageTableDetailPage';

export default PageTableDetailPage;
