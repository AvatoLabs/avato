'use client';

import { memo } from 'react';

import PageRouteRedirect from '@/features/Pages/PageRouteRedirect';

const PageDetailRedirectPage = memo(() => {
  return <PageRouteRedirect includeId pageKind="doc" />;
});

PageDetailRedirectPage.displayName = 'PageDetailRedirectPage';

export default PageDetailRedirectPage;
