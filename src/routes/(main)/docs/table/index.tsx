'use client';

import { memo } from 'react';

import PageRouteRedirect from '@/features/Pages/PageRouteRedirect';

const PageTableRedirectPage = memo(() => {
  return <PageRouteRedirect pageKind="table" />;
});

PageTableRedirectPage.displayName = 'PageTableRedirectPage';

export default PageTableRedirectPage;
