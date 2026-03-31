'use client';

import { memo } from 'react';

import { PageEntry } from '@/features/Pages';

const PagesSpacePage = memo(() => {
  return <PageEntry pageKind="doc" />;
});

PagesSpacePage.displayName = 'PagesSpacePage';

export default PagesSpacePage;
