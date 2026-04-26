'use client';

import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { usePageSpaceId } from '@/features/Pages/usePageSpaceId';
import { getPageKindFromPathname, getPageRootPath } from '@/utils/docs';

const PAGE_SCOPE_SOURCE_SET_PREFIX = 'source-set:';

export type PageScope = 'all' | 'unassigned' | `${typeof PAGE_SCOPE_SOURCE_SET_PREFIX}${string}`;

export const DEFAULT_PAGE_SCOPE: PageScope = 'all';

export const normalizePageScope = (scope: string | null | undefined): PageScope => {
  if (scope === 'unassigned') return 'unassigned';
  if (
    scope?.startsWith(PAGE_SCOPE_SOURCE_SET_PREFIX) &&
    scope.length > PAGE_SCOPE_SOURCE_SET_PREFIX.length
  ) {
    return scope as PageScope;
  }

  return DEFAULT_PAGE_SCOPE;
};

export const createSourceSetPageScope = (sourceSetId: string): PageScope =>
  `${PAGE_SCOPE_SOURCE_SET_PREFIX}${sourceSetId}`;

export const getSourceSetIdFromPageScope = (scope: string | null | undefined): string | null => {
  const normalizedScope = normalizePageScope(scope);

  if (!normalizedScope.startsWith(PAGE_SCOPE_SOURCE_SET_PREFIX)) return null;

  return normalizedScope.slice(PAGE_SCOPE_SOURCE_SET_PREFIX.length) || null;
};

export const getPageScopeFromSearch = (search: string): PageScope => {
  const searchParams = new URLSearchParams(search);

  return normalizePageScope(searchParams.get('scope'));
};

export const buildPageScopeSearch = (
  scope: PageScope,
  search?: string | URLSearchParams,
): string => {
  const searchParams = new URLSearchParams(search);

  if (scope === DEFAULT_PAGE_SCOPE) {
    searchParams.delete('scope');
  } else {
    searchParams.set('scope', scope);
  }

  const nextSearch = searchParams.toString();

  return nextSearch ? `?${nextSearch}` : '';
};

export const usePageScope = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageSpaceId = usePageSpaceId();

  const scope = useMemo(() => normalizePageScope(searchParams.get('scope')), [searchParams]);
  const sourceSetId = useMemo(() => getSourceSetIdFromPageScope(scope), [scope]);

  const setScope = useCallback(
    (nextScope: PageScope, options?: { spaceId?: string | null }) => {
      const nextSearch = buildPageScopeSearch(nextScope, searchParams);
      const rootPath = getPageRootPath(
        getPageKindFromPathname(location.pathname),
        options?.spaceId ?? pageSpaceId,
      );
      const isRootPath = location.pathname === rootPath || location.pathname === `${rootPath}/`;

      if (isRootPath) {
        setSearchParams(new URLSearchParams(nextSearch), {
          replace: true,
        });

        return;
      }

      navigate(`${rootPath}${nextSearch}`, { replace: true });
    },
    [location.pathname, navigate, pageSpaceId, searchParams, setSearchParams],
  );

  return { scope, setScope, sourceSetId };
};
