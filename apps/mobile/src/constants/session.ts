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
