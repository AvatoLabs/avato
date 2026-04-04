'use client';

import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { buildFilesRootPath } from '@/features/ResourceSpaces';

export type FileScope = 'all' | 'unassigned' | `source-set:${string}`;

const FILE_SCOPE_QUERY_KEY = 'scope';

export const buildSourceSetFileScope = (sourceSetId: string): FileScope =>
  `source-set:${sourceSetId}`;

export const getSourceSetScopeId = (scope: FileScope | string | null | undefined) =>
  scope?.startsWith('source-set:') ? scope.slice('source-set:'.length) : null;

export const getFileScope = (searchParams: URLSearchParams): FileScope => {
  const scope = searchParams.get(FILE_SCOPE_QUERY_KEY);

  if (scope === 'unassigned') return 'unassigned';
  if (scope?.startsWith('source-set:')) return scope as FileScope;

  return 'all';
};

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
  const sourceSetId = getSourceSetScopeId(scope);

  const setScope = useCallback(
    (nextScope: FileScope, nextSpaceId?: string | null) => {
      const targetSpaceId = nextSpaceId ?? spaceId;
      const basePath = buildFilesRootPath(targetSpaceId);
      const nextSearch = buildFileScopeSearch(nextScope, searchParams);

      navigate(`${basePath}${nextSearch}`, { replace: true });
    },
    [navigate, searchParams, spaceId],
  );

  return { scope, setScope, sourceSetId };
};
