export const buildContentRootPath = (spaceId?: string | null) =>
  spaceId ? `/content/spaces/${spaceId}` : '/content';

export const buildContentFolderPath = (spaceId: string | null | undefined, folderSlug: string) =>
  `${buildContentRootPath(spaceId)}/${folderSlug}`;

export const buildSourceSetPath = (spaceId: string | null | undefined, sourceSetId: string) =>
  spaceId
    ? `/content/spaces/${spaceId}/source-sets/${sourceSetId}`
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

  return `${basePath}?file=${encodeURIComponent(fileId)}`;
};

export const buildSharedContentPath = () => '/content/shared';

export const buildContentTrashPath = (spaceId?: string | null) =>
  spaceId ? `/content/spaces/${spaceId}/trash` : '/content/trash';

export const buildSourceSetTrashPath = (spaceId: string | null | undefined, sourceSetId: string) =>
  `${buildSourceSetPath(spaceId, sourceSetId)}/trash`;

export const buildSpaceSettingsPath = (spaceId: string) => `/content/spaces/${spaceId}/settings`;

export const buildPublicContentSharePath = (token: string) => `/share/r/${token}`;
