'use client';

import { memo } from 'react';

import PageRouteRedirect from '@/features/Pages/PageRouteRedirect';

const PageTableSpaceRedirectPage = memo(() => {
  return <PageRouteRedirect pageKind="table" />;
});

PageTableSpaceRedirectPage.displayName = 'PageTableSpaceRedirectPage';

export default PageTableSpaceRedirectPage;
