export const buildSpacesRootPath = () => '/spaces';

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

export const buildSharedFilesPath = () => '/content/shared';

export const buildFilesTrashPath = (spaceId?: string | null) =>
  spaceId ? `${buildFilesRootPath(spaceId)}/trash` : '/content/trash';

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
