'use client';

import { memo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { buildSharedFilesPath } from './paths';

const LegacySharedFilesRedirectPage = memo(() => {
  const location = useLocation();

  return <Navigate replace to={`${buildSharedFilesPath()}${location.search}`} />;
});

LegacySharedFilesRedirectPage.displayName = 'LegacySharedFilesRedirectPage';

export default LegacySharedFilesRedirectPage;
