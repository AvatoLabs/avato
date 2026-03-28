export const buildResourceRootPath = (spaceId?: string | null) =>
  spaceId ? `/resource/space/${spaceId}` : '/resource';

export const buildResourceLibraryPath = (spaceId: string | null | undefined, libraryId: string) =>
  spaceId ? `/resource/space/${spaceId}/library/${libraryId}` : `/resource/library/${libraryId}`;

export const buildResourceFolderPath = (
  spaceId: string | null | undefined,
  libraryId: string,
  folderSlug: string,
) => `${buildResourceLibraryPath(spaceId, libraryId)}/${folderSlug}`;

export const buildResourcePreviewPath = (
  spaceId: string | null | undefined,
  fileId: string,
  libraryId?: string | null,
) => {
  const basePath = libraryId
    ? buildResourceLibraryPath(spaceId, libraryId)
    : buildResourceRootPath(spaceId);

  return `${basePath}?file=${encodeURIComponent(fileId)}`;
};

export const buildResourceSharedPath = () => '/resource/shared';

export const buildResourceTrashPath = (spaceId?: string | null) =>
  spaceId ? `/resource/space/${spaceId}/trash` : '/resource/trash';

export const buildResourceLibraryTrashPath = (
  spaceId: string | null | undefined,
  libraryId: string,
) => `${buildResourceLibraryPath(spaceId, libraryId)}/trash`;

export const buildSpaceSettingsPath = (spaceId: string) => `/resource/space/${spaceId}/settings`;

export const buildPublicResourceSharePath = (token: string) => `/share/r/${token}`;
