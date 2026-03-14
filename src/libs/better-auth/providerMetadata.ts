import { type GlobalServerAuthProvider } from '@/types/serverConfig';

import { isBuiltinProvider, normalizeProviderId } from './utils/common';

const QR_CODE_PROVIDER_IDS = new Set(['wechat']);

const PROVIDER_LABELS: Record<string, string> = {
  'apple': 'Apple',
  'auth0': 'Auth0',
  'authentik': 'Authentik',
  'authelia': 'Authelia',
  'casdoor': 'Casdoor',
  'cloudflare-zero-trust': 'Cloudflare Zero Trust',
  'cognito': 'Amazon Cognito',
  'feishu': 'Feishu',
  'generic-oidc': 'OIDC',
  'github': 'GitHub',
  'google': 'Google',
  'keycloak': 'Keycloak',
  'logto': 'Logto',
  'microsoft': 'Microsoft',
  'okta': 'Okta',
  'wechat': 'WeChat',
  'zitadel': 'ZITADEL',
};

const formatProviderLabel = (provider: string) => {
  const normalized = provider
    .replaceAll(/[_-]+/g, ' ')
    .replaceAll(/\b\w/g, (char) => char.toUpperCase());

  return normalized;
};

export const getBetterAuthProviderMetadata = (
  providers: string[] = [],
): GlobalServerAuthProvider[] => {
  const registry = new Map<string, GlobalServerAuthProvider>();

  for (const provider of providers) {
    const id = normalizeProviderId(provider);

    if (registry.has(id)) continue;

    registry.set(id, {
      id,
      label: PROVIDER_LABELS[id] || formatProviderLabel(id),
      mode: QR_CODE_PROVIDER_IDS.has(id) ? 'qrcode' : 'redirect',
      type: isBuiltinProvider(id) ? 'builtin' : 'generic',
    });
  }

  return [...registry.values()];
};
