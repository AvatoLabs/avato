'use client';

import { memo } from 'react';

import PageRouteRedirect from '@/features/Pages/PageRouteRedirect';

const PagesRedirectPage = memo(() => {
  return <PageRouteRedirect pageKind="doc" />;
});

PagesRedirectPage.displayName = 'PagesRedirectPage';

export default PagesRedirectPage;
