'use client';

import { memo } from 'react';

import PageRouteRedirect from '@/features/Pages/PageRouteRedirect';

const PagesSpaceDetailRedirectPage = memo(() => {
  return <PageRouteRedirect includeId pageKind="doc" />;
});

PagesSpaceDetailRedirectPage.displayName = 'PagesSpaceDetailRedirectPage';

export default PagesSpaceDetailRedirectPage;
