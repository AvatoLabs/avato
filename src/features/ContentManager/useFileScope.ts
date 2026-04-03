'use client';

import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { buildContentRootPath } from '@/features/ResourceSpaces';

export type FileScope = 'all' | 'unassigned';

const FILE_SCOPE_QUERY_KEY = 'scope';

export const getFileScope = (searchParams: URLSearchParams): FileScope =>
  searchParams.get(FILE_SCOPE_QUERY_KEY) === 'unassigned' ? 'unassigned' : 'all';

export const buildFileScopeSearch = (
  scope: FileScope,
  searchParams?: URLSearchParams | URLSearchParams,
) => {
  const nextParams = new URLSearchParams(searchParams);

  nextParams.delete('file');
  nextParams.delete('files');

  if (scope === 'all') {
    nextParams.delete(FILE_SCOPE_QUERY_KEY);
  } else {
    nextParams.set(FILE_SCOPE_QUERY_KEY, scope);
  }

  const query = nextParams.toString();

  return query ? `?${query}` : '';
};

export const useFileScope = (spaceId?: string | null) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scope = getFileScope(searchParams);

  const setScope = useCallback(
    (nextScope: FileScope, nextSpaceId?: string | null) => {
      const targetSpaceId = nextSpaceId ?? spaceId;
      const basePath = buildContentRootPath(targetSpaceId);
      const nextSearch = buildFileScopeSearch(nextScope, searchParams);

      navigate(`${basePath}${nextSearch}`, { replace: true });
    },
    [navigate, searchParams, spaceId],
  );

  return { scope, setScope };
};
