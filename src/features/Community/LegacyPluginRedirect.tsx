'use client';

import { memo } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import urlJoin from 'url-join';

const LegacyPluginRedirect = memo(() => {
  const location = useLocation();
  const { slug } = useParams<{ slug?: string }>();

  const targetPath = slug ? urlJoin('/community/mcp', slug) : '/community/mcp';

  return <Navigate replace to={`${targetPath}${location.search}`} />;
});

LegacyPluginRedirect.displayName = 'LegacyPluginRedirect';

export default LegacyPluginRedirect;
