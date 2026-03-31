export const buildSpaceRootPath = (spaceId?: string | null) =>
  spaceId ? `/spaces/${spaceId}` : '/content';

export const buildContentRootPath = (spaceId?: string | null) =>
  spaceId ? `${buildSpaceRootPath(spaceId)}/files` : '/content';

export const buildSourceSetsRootPath = (spaceId?: string | null) =>
  spaceId ? `${buildSpaceRootPath(spaceId)}/source-sets` : '/content/source-sets';

const normalizeContentPath = (path: string) => {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
};

export const stripContentItemPath = (pathname: string) => {
  const normalizedPath = normalizeContentPath(pathname);

  return normalizedPath.replace(/\/item\/[^/]+$/, '') || '/';
};

export const buildContentItemPath = (basePath: string, fileId: string) =>
  `${stripContentItemPath(normalizeContentPath(basePath))}/item/${encodeURIComponent(fileId)}`;

export const buildContentFolderPath = (spaceId: string | null | undefined, folderSlug: string) =>
  `${buildContentRootPath(spaceId)}/${folderSlug}`;

export const buildSourceSetPath = (spaceId: string | null | undefined, sourceSetId: string) =>
  spaceId
    ? `${buildSourceSetsRootPath(spaceId)}/${sourceSetId}`
    : `/content/source-sets/${sourceSetId}`;

export const buildSourceSetFolderPath = (
  spaceId: string | null | undefined,
  sourceSetId: string,
  folderSlug: string,
) => `${buildSourceSetPath(spaceId, sourceSetId)}/${folderSlug}`;

export const buildContentPreviewPath = (
  spaceId: string | null | undefined,
  fileId: string,
  sourceSetId?: string | null,
) => {
  const basePath = sourceSetId
    ? buildSourceSetPath(spaceId, sourceSetId)
    : buildContentRootPath(spaceId);

  return buildContentItemPath(basePath, fileId);
};

export const buildSharedContentPath = () => '/content/shared';

export const buildContentTrashPath = (spaceId?: string | null) =>
  spaceId ? `${buildContentRootPath(spaceId)}/trash` : '/content/trash';

export const buildSourceSetTrashPath = (spaceId: string | null | undefined, sourceSetId: string) =>
  `${buildSourceSetPath(spaceId, sourceSetId)}/trash`;

export const buildSpaceSettingsPath = (spaceId: string) =>
  `${buildSpaceRootPath(spaceId)}/settings`;

export const buildSpaceMembersPath = (spaceId: string) => `${buildSpaceRootPath(spaceId)}/members`;

export const buildPublicContentSharePath = (token: string) => `/share/r/${token}`;
