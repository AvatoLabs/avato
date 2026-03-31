'use client';

import { memo } from 'react';

import { PageEntry } from '@/features/Pages';

const PageTableSpacePage = memo(() => {
  return <PageEntry pageKind="table" />;
});

PageTableSpacePage.displayName = 'PageTableSpacePage';

export default PageTableSpacePage;
