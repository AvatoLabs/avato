export const ICON_CDN_BASE =
  'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files';

export const getProviderIconUrl = (providerId: string, theme: 'light' | 'dark' = 'light') =>
  `${ICON_CDN_BASE}/${theme}/${providerId}.png`;
