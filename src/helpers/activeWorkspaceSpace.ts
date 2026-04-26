/**
 * Last Space the user selected in Resource Manager (URL-driven `setSpaceId`).
 * Optional hint for APIs that accept `spaceId` (e.g. market `exportAndUploadFile` → `createFileRecord` / `space_blobs`).
 * Cleared when Resource routes set `spaceId` to `undefined`.
 */
let activeWorkspaceSpaceId: string | undefined;

const normalizeSpaceId = (spaceId?: string | null): string | undefined => spaceId ?? undefined;

export function getWorkspaceSpaceIdFromPathname(pathname?: string | null): string | undefined {
  if (!pathname) return;

  const match = pathname.match(/^\/spaces\/([^/]+)(?:\/|$)/);
  const routeSpaceId = match?.[1];

  if (!routeSpaceId || routeSpaceId === 'shared' || routeSpaceId === 'trash') return;

  return decodeURIComponent(routeSpaceId);
}

export function getCurrentWorkspaceSpaceId(pathname?: string | null): string | undefined {
  if (pathname !== undefined) return getWorkspaceSpaceIdFromPathname(pathname);

  if (typeof window === 'undefined') return;

  return getWorkspaceSpaceIdFromPathname(window.location.pathname);
}

export function getActiveWorkspaceSpaceId(): string | undefined {
  return getCurrentWorkspaceSpaceId() ?? activeWorkspaceSpaceId;
}

export function resolveWorkspaceSpaceId(params?: {
  fallbackSpaceId?: string | null;
  pathname?: string | null;
  spaceId?: string | null;
}): string | undefined {
  const explicitSpaceId = normalizeSpaceId(params?.spaceId);
  const routeSpaceId = getCurrentWorkspaceSpaceId(params?.pathname);
  const fallbackSpaceId = normalizeSpaceId(params?.fallbackSpaceId);

  return explicitSpaceId ?? routeSpaceId ?? fallbackSpaceId ?? activeWorkspaceSpaceId;
}

export function setActiveWorkspaceSpaceId(spaceId: string | undefined): void {
  activeWorkspaceSpaceId = spaceId;
}
