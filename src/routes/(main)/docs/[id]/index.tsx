'use client';

import { memo } from 'react';

import { PageDetail } from '@/features/Pages';

/**
 * Pages route - dedicated page for managing documents/docss
 * This is extracted from the /content route to have its own dedicated space
 */
const PagesPage = memo(() => {
  return <PageDetail pageKind="doc" />;
});

PagesPage.displayName = 'PagesPage';

export default PagesPage;
