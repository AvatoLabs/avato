'use client';

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type PageScope = 'all' | 'unassigned';

export const DEFAULT_PAGE_SCOPE: PageScope = 'all';

export const normalizePageScope = (scope: string | null | undefined): PageScope => {
  if (scope === 'unassigned') return 'unassigned';

  return DEFAULT_PAGE_SCOPE;
};

export const getPageScopeFromSearch = (search: string): PageScope => {
  const searchParams = new URLSearchParams(search);

  return normalizePageScope(searchParams.get('scope'));
};

export const usePageScope = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const scope = useMemo(() => normalizePageScope(searchParams.get('scope')), [searchParams]);

  const setScope = useCallback(
    (nextScope: PageScope) => {
      const nextSearchParams = new URLSearchParams(searchParams);

      if (nextScope === DEFAULT_PAGE_SCOPE) {
        nextSearchParams.delete('scope');
      } else {
        nextSearchParams.set('scope', nextScope);
      }

      setSearchParams(nextSearchParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return { scope, setScope };
};
