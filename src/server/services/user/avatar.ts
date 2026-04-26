const USER_AVATAR_STORAGE_SCOPE = 'user-avatar';

export const buildUserAvatarStorageKey = (spaceId: string, fileName: string) =>
  `v2/spaces/${spaceId}/blobs/${USER_AVATAR_STORAGE_SCOPE}/${fileName}`;

export const buildLegacyUserAvatarStorageKey = (userId: string, fileName: string) =>
  `user/avatar/${userId}/${fileName}`;

export const buildUserAvatarRoute = (userId: string, fileName: string) =>
  `/webapi/user/avatar/${encodeURIComponent(userId)}/${encodeURIComponent(fileName)}`;

export const parseUserAvatarFileNameFromRoute = (avatarUrl: string, userId: string) => {
  const prefix = `/webapi/user/avatar/${encodeURIComponent(userId)}/`;
  if (!avatarUrl.startsWith(prefix)) return;

  const fileName = avatarUrl.slice(prefix.length).trim();
  return fileName ? decodeURIComponent(fileName) : undefined;
};
