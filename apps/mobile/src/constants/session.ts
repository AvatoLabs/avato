/**
 * Mobile session constants.
 *
 * Keep these local to the mobile app instead of importing workspace web packages,
 * because the Expo/Metro bundle does not resolve `@lobechat/*` workspace aliases.
 */

export const INBOX_SESSION_ID = 'inbox';

/**
 * Relative server asset path for the builtin Avato inbox avatar.
 * `useResolvedRemoteAsset` will resolve this against the configured server origin.
 */
export const DEFAULT_INBOX_AVATAR = '/icons/icon-192x192.png';

export const AVATO_INBOX_ICON_ASSET = require('../../assets/avato-icon.png');

/** Builtin inbox avatar URL from the server (single canonical path). */
export const isBuiltinInboxAvatar = (avatar?: string | null) => {
  const normalized = avatar?.trim();
  if (!normalized) return false;

  return normalized === DEFAULT_INBOX_AVATAR;
};
