'use client';

import { memo } from 'react';

import { PageEntry } from '@/features/Pages';

const PageTablePage = memo(() => {
  return <PageEntry pageKind="table" />;
});

PageTablePage.displayName = 'PageTablePage';

export default PageTablePage;
