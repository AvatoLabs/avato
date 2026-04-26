'use client';

import { memo } from 'react';

import { PageEntry } from '@/features/Pages';

const SpaceTablePage = memo(() => {
  return <PageEntry pageKind="table" />;
});

SpaceTablePage.displayName = 'SpaceTablePage';

export default SpaceTablePage;
