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
export const LEGACY_INBOX_AVATAR_PATHS = new Set([
  '/icons/icon-192x192.maskable.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.maskable.png',
  '/icons/icon-512x512.png',
]);

export const AVATO_INBOX_ICON_ASSET = require('../../assets/avato-icon.png');

export const isBuiltinInboxAvatar = (avatar?: string | null) => {
  const normalized = avatar?.trim();
  if (!normalized) return false;

  return LEGACY_INBOX_AVATAR_PATHS.has(normalized);
};
