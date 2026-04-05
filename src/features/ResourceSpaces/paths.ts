export const buildSpacesRootPath = () => '/spaces';
export const buildSpacesSharedPath = () => `${buildSpacesRootPath()}/shared`;
export const buildSpacesTrashPath = () => `${buildSpacesRootPath()}/trash`;
export const buildLegacySharedFilesPath = () => '/content/shared';
export const buildLegacyFilesTrashPath = () => '/content/trash';

export const buildSpaceRootPath = (spaceId?: string | null) =>
  spaceId ? `/spaces/${spaceId}` : buildSpacesRootPath();

export const buildFilesRootPath = (spaceId?: string | null) =>
  spaceId ? `${buildSpaceRootPath(spaceId)}/files` : buildSpacesRootPath();

const buildSourceSetScopeSearch = (sourceSetId: string) =>
  `?scope=${encodeURIComponent(`source-set:${sourceSetId}`)}`;

const normalizeFilesPath = (path: string) => {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
};

const normalizePathname = (pathname?: string | null) =>
  pathname ? normalizeFilesPath(pathname) : undefined;

export const isWorkspaceFilesSurfacePath = (
  pathname?: string | null,
  options?: { includeLegacySpecialRoutes?: boolean },
) => {
  const normalizedPath = normalizePathname(pathname);
  if (!normalizedPath) return false;

  if (
    normalizedPath === buildSpacesSharedPath() ||
    normalizedPath === buildSpacesTrashPath() ||
    /^\/spaces\/[^/]+\/files(?:\/|$)/.test(normalizedPath)
  ) {
    return true;
  }

  if (!options?.includeLegacySpecialRoutes) return false;

  return (
    normalizedPath === buildLegacySharedFilesPath() ||
    normalizedPath === buildLegacyFilesTrashPath()
  );
};

export const isWorkspaceResourcePath = (
  pathname?: string | null,
  options?: { includeLegacySpecialRoutes?: boolean },
) => {
  const normalizedPath = normalizePathname(pathname);
  if (!normalizedPath) return false;

  if (isWorkspaceFilesSurfacePath(normalizedPath, options)) return true;

  return /^\/spaces\/[^/]+\/(?:docs|settings|members|memory)(?:\/|$)/.test(normalizedPath);
};

export const stripFilesItemPath = (pathname: string) => {
  const normalizedPath = normalizeFilesPath(pathname);

  return normalizedPath.replace(/\/item\/[^/]+$/, '') || '/';
};

export const buildFilesItemPath = (basePath: string, fileId: string) =>
  `${stripFilesItemPath(normalizeFilesPath(basePath))}/item/${encodeURIComponent(fileId)}`;

export const buildFilesFolderPath = (spaceId: string | null | undefined, folderSlug: string) =>
  `${buildFilesRootPath(spaceId)}/${folderSlug}`;

export const buildSourceSetPath = (spaceId: string | null | undefined, sourceSetId: string) =>
  `${buildFilesRootPath(spaceId)}${buildSourceSetScopeSearch(sourceSetId)}`;

export const buildSourceSetFolderPath = (
  spaceId: string | null | undefined,
  sourceSetId: string,
  folderSlug: string,
) => `${buildFilesFolderPath(spaceId, folderSlug)}${buildSourceSetScopeSearch(sourceSetId)}`;

export const buildFilesPreviewPath = (
  spaceId: string | null | undefined,
  fileId: string,
  sourceSetId?: string | null,
) => {
  const previewPath = buildFilesItemPath(buildFilesRootPath(spaceId), fileId);

  return sourceSetId ? `${previewPath}${buildSourceSetScopeSearch(sourceSetId)}` : previewPath;
};

export const buildSharedFilesPath = () => buildSpacesSharedPath();

export const buildFilesTrashPath = (spaceId?: string | null) =>
  spaceId ? `${buildFilesRootPath(spaceId)}/trash` : buildSpacesTrashPath();

export const buildSourceSetTrashPath = (spaceId: string | null | undefined, sourceSetId: string) =>
  `${buildFilesTrashPath(spaceId)}${buildSourceSetScopeSearch(sourceSetId)}`;

export const buildSpaceSettingsPath = (spaceId: string) =>
  `${buildSpaceRootPath(spaceId)}/settings`;

export const buildSpaceMembersPath = (spaceId: string) => `${buildSpaceRootPath(spaceId)}/members`;

export const buildSpaceMemoryPath = (
  spaceId: string,
  section?: 'inbox' | 'playbooks' | 'policies' | 'published',
) =>
  `${buildSpaceRootPath(spaceId)}/memory${section ? `?section=${encodeURIComponent(section)}` : ''}`;

export const buildSpaceMemoryAuditPath = (
  spaceId: string,
  entryId: string,
  section?: 'inbox' | 'playbooks' | 'policies' | 'published',
) =>
  `${buildSpaceRootPath(spaceId)}/memory/audit/${encodeURIComponent(entryId)}${
    section ? `?section=${encodeURIComponent(section)}` : ''
  }`;

export const buildPublicContentSharePath = (token: string) => `/share/r/${token}`;
