'use client';

import { memo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { buildFilesTrashPath } from './paths';

const LegacyTrashRedirectPage = memo(() => {
  const location = useLocation();

  return <Navigate replace to={`${buildFilesTrashPath()}${location.search}`} />;
});

LegacyTrashRedirectPage.displayName = 'LegacyTrashRedirectPage';

export default LegacyTrashRedirectPage;
