import { getPageSpaceIdFromPathname } from '@/utils/docs';

interface ResolvePageStoreSpaceIdParams {
  pathname?: string | null;
  queryFilterSpaceId?: string;
  spaceId?: string | null;
}

export const resolvePageStoreSpaceId = ({
  pathname,
  queryFilterSpaceId,
  spaceId,
}: ResolvePageStoreSpaceIdParams): string | undefined => {
  if (spaceId) return spaceId;

  const routeSpaceId = getPageSpaceIdFromPathname(
    pathname ?? (typeof window !== 'undefined' ? window.location.pathname : undefined),
  );
  if (routeSpaceId) return routeSpaceId;

  return queryFilterSpaceId ?? undefined;
};
