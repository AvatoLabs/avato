import { getWorkspaceSpaceIdFromPathname } from '@/helpers/activeWorkspaceSpace';

interface ResolveFileStoreSpaceIdParams {
  pathname?: string | null;
  queryFilterSpaceId?: string;
  spaceId?: string | null;
}

export const resolveFileStoreSpaceId = ({
  pathname,
  queryFilterSpaceId,
  spaceId,
}: ResolveFileStoreSpaceIdParams): string | undefined => {
  if (spaceId) return spaceId;

  const routeSpaceId = getWorkspaceSpaceIdFromPathname(
    pathname ?? (typeof window !== 'undefined' ? window.location.pathname : undefined),
  );
  if (routeSpaceId) return routeSpaceId;

  return queryFilterSpaceId ?? undefined;
};
