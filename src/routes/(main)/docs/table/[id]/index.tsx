'use client';

import { memo } from 'react';

import PageRouteRedirect from '@/features/Pages/PageRouteRedirect';

const PageTableDetailRedirectPage = memo(() => {
  return <PageRouteRedirect includeId pageKind="table" />;
});

PageTableDetailRedirectPage.displayName = 'PageTableDetailRedirectPage';

export default PageTableDetailRedirectPage;
