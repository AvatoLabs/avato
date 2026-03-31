'use client';

import { memo } from 'react';

import PageRouteRedirect from '@/features/Pages/PageRouteRedirect';

const PageTableSpaceDetailRedirectPage = memo(() => {
  return <PageRouteRedirect includeId pageKind="table" />;
});

PageTableSpaceDetailRedirectPage.displayName = 'PageTableSpaceDetailRedirectPage';

export default PageTableSpaceDetailRedirectPage;
