'use client';

import { memo } from 'react';

import PageRouteRedirect from '@/features/Pages/PageRouteRedirect';

const PagesSpaceRedirectPage = memo(() => {
  return <PageRouteRedirect pageKind="doc" />;
});

PagesSpaceRedirectPage.displayName = 'PagesSpaceRedirectPage';

export default PagesSpaceRedirectPage;
