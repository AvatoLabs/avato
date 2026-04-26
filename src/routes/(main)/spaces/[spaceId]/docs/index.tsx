'use client';

import { memo } from 'react';

import { PageEntry } from '@/features/Pages';

const SpaceDocsPage = memo(() => {
  return <PageEntry pageKind="doc" />;
});

SpaceDocsPage.displayName = 'SpaceDocsPage';

export default SpaceDocsPage;
