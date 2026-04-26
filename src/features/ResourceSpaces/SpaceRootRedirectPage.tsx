'use client';

import { memo } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';

import { buildFilesRootPath } from './paths';

const appendSearch = (path: string, search: string) => {
  if (!search) return path;

  return `${path}${path.includes('?') ? '&' : '?'}${search.slice(1)}`;
};

const SpaceRootRedirectPage = memo(() => {
  const location = useLocation();
  const { spaceId } = useParams<{ spaceId?: string }>();

  if (!spaceId) return null;

  return <Navigate replace to={appendSearch(buildFilesRootPath(spaceId), location.search)} />;
});

SpaceRootRedirectPage.displayName = 'SpaceRootRedirectPage';

export default SpaceRootRedirectPage;
