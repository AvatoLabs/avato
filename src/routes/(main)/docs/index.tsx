'use client';

import { memo } from 'react';

import { PageEntry } from '@/features/Pages';

/**
 * Pages route - dedicated page for managing documents/docss
 * This is extracted from the /content route to have its own dedicated space
 */
const PagesPage = memo(() => {
  return <PageEntry pageKind="doc" />;
});

PagesPage.displayName = 'PagesPage';

export default PagesPage;
